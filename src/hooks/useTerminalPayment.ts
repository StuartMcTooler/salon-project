import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { isNativeApp, getPlatform } from '@/lib/platform';
import { toast } from 'sonner';

// Type definitions
type ConnectionType = 'internet' | 'bluetooth' | 'tap_to_pay';
type DiscoveryMethod = 'localMobile' | 'bluetoothScan' | 'internet';

interface TerminalConfig {
  connectionType: ConnectionType;
  readerId?: string;
  readerName?: string;
}

interface PaymentResult {
  success: boolean;
  paymentIntentId?: string;
  error?: string;
}

// Lazy load the Capacitor plugin only in native context
let StripeTerminalPlugin: any = null;

const loadStripeTerminal = async () => {
  if (!isNativeApp()) return null;
  if (StripeTerminalPlugin) return StripeTerminalPlugin;
  
  const module = await import('@capacitor-community/stripe-terminal');
  StripeTerminalPlugin = module.StripeTerminal;
  return StripeTerminalPlugin;
};

export const useTerminalPayment = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [connectedReader, setConnectedReader] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [discoveredReaders, setDiscoveredReaders] = useState<any[]>([]);
  
  const terminalRef = useRef<any>(null);

  // Fetch connection token for native SDK
  const fetchConnectionToken = useCallback(async (): Promise<string> => {
    const { data, error } = await supabase.functions.invoke('create-terminal-connection-token');
    if (error) throw new Error(error.message);
    return data.secret;
  }, []);

  // Initialize native SDK
  const initializeNativeSDK = useCallback(async () => {
    if (!isNativeApp() || isInitialized) return;
    
    try {
      const StripeTerminal = await loadStripeTerminal();
      if (!StripeTerminal) throw new Error('Failed to load Stripe Terminal plugin');
      
      terminalRef.current = StripeTerminal;
      
      // Initialize with token provider
      await StripeTerminal.initialize({
        tokenProviderEndpoint: '', // We'll provide tokens manually
        isTest: false, // Set based on your Stripe mode
      });
      
      // Set initial connection token
      const token = await fetchConnectionToken();
      await StripeTerminal.setConnectionToken({ token });
      
      setIsInitialized(true);
      console.log('[TerminalPayment] Native SDK initialized');
    } catch (err: any) {
      console.error('[TerminalPayment] Init error:', err);
      setError(err.message);
    }
  }, [isInitialized, fetchConnectionToken]);

  // Discover readers based on connection type
  const discoverReaders = useCallback(async (connectionType: ConnectionType) => {
    setError(null);
    
    if (!isNativeApp()) {
      // For web, we don't "discover" - we use configured reader ID
      return [];
    }
    
    try {
      if (!isInitialized) await initializeNativeSDK();
      
      const StripeTerminal = terminalRef.current;
      if (!StripeTerminal) throw new Error('Terminal not initialized');
      
      let discoveryMethod: DiscoveryMethod;
      
      switch (connectionType) {
        case 'tap_to_pay':
          discoveryMethod = 'localMobile'; // Uses phone's NFC
          break;
        case 'bluetooth':
          discoveryMethod = 'bluetoothScan';
          break;
        default:
          discoveryMethod = 'internet';
      }
      
      console.log(`[TerminalPayment] Discovering readers: ${discoveryMethod}`);
      
      const result = await StripeTerminal.discoverReaders({
        simulated: false,
        discoveryMethod,
      });
      
      setDiscoveredReaders(result.readers || []);
      return result.readers || [];
    } catch (err: any) {
      console.error('[TerminalPayment] Discovery error:', err);
      setError(err.message);
      return [];
    }
  }, [isInitialized, initializeNativeSDK]);

  // Connect to a reader
  const connectReader = useCallback(async (reader: any) => {
    if (!isNativeApp()) return;
    
    try {
      const StripeTerminal = terminalRef.current;
      if (!StripeTerminal) throw new Error('Terminal not initialized');
      
      await StripeTerminal.connectReader({ reader });
      setConnectedReader(reader);
      console.log('[TerminalPayment] Connected to reader:', reader.serialNumber || reader.id);
    } catch (err: any) {
      console.error('[TerminalPayment] Connect error:', err);
      setError(err.message);
      throw err;
    }
  }, []);

  // Process payment - THE FORK
  const processPayment = useCallback(async (
    amount: number,
    config: TerminalConfig,
    appointmentId?: string,
    customerEmail?: string
  ): Promise<PaymentResult> => {
    setIsProcessing(true);
    setError(null);

    try {
      if (isNativeApp() && (config.connectionType === 'tap_to_pay' || config.connectionType === 'bluetooth')) {
        // === NATIVE PATH: Use Stripe Terminal SDK ===
        return await processNativePayment(amount, config.connectionType, appointmentId, customerEmail);
      } else {
        // === WEB PATH: Use Server-Driven API ===
        return await processServerDrivenPayment(amount, config.readerId!, appointmentId, customerEmail);
      }
    } catch (err: any) {
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setIsProcessing(false);
    }
  }, [connectedReader, discoverReaders, connectReader]);

  // Native payment flow (Tap to Pay / Bluetooth)
  const processNativePayment = async (
    amount: number,
    connectionType: ConnectionType,
    appointmentId?: string,
    customerEmail?: string
  ): Promise<PaymentResult> => {
    const StripeTerminal = terminalRef.current;
    if (!StripeTerminal) throw new Error('Terminal not initialized');

    // Step 1: Ensure we have a connected reader
    if (!connectedReader) {
      const readers = await discoverReaders(connectionType);
      if (readers.length === 0) {
        throw new Error(
          connectionType === 'tap_to_pay' 
            ? 'Tap to Pay is not available on this device' 
            : 'No Bluetooth readers found nearby'
        );
      }
      await connectReader(readers[0]);
    }

    // Step 2: Create PaymentIntent on server
    const { data: intentData, error: intentError } = await supabase.functions.invoke(
      'create-terminal-payment-intent',
      { body: { amount, appointmentId, customerEmail } }
    );
    
    if (intentError) throw new Error(intentError.message);

    // Step 3: Collect payment method (user taps card or phone presents NFC)
    console.log('[TerminalPayment] Collecting payment method...');
    toast.info(connectionType === 'tap_to_pay' ? 'Ready - Tap card on phone' : 'Present card to reader');
    
    await StripeTerminal.collectPaymentMethod({
      paymentIntentClientSecret: intentData.clientSecret,
    });

    // Step 4: Process the payment
    console.log('[TerminalPayment] Processing payment...');
    const processResult = await StripeTerminal.processPayment();
    
    // Step 5: Update appointment status
    if (appointmentId) {
      await supabase
        .from('salon_appointments')
        .update({ payment_status: 'paid' })
        .eq('id', appointmentId);
    }

    toast.success('Payment successful!');
    return {
      success: true,
      paymentIntentId: processResult.paymentIntent?.id || intentData.paymentIntentId,
    };
  };

  // Server-driven payment flow (WiFi readers)
  const processServerDrivenPayment = async (
    amount: number,
    readerId: string,
    appointmentId?: string,
    customerEmail?: string
  ): Promise<PaymentResult> => {
    // Use existing edge function
    const { data, error } = await supabase.functions.invoke('create-terminal-payment', {
      body: { amount, readerId, appointmentId, customerEmail }
    });
    
    if (error) throw new Error(error.message);
    
    toast.success('Payment initiated on terminal');
    return {
      success: true,
      paymentIntentId: data.paymentIntentId,
    };
  };

  return {
    // State
    isProcessing,
    isInitialized,
    connectedReader,
    discoveredReaders,
    error,
    
    // Actions
    initializeNativeSDK,
    discoverReaders,
    connectReader,
    processPayment,
    
    // Platform info
    isNative: isNativeApp(),
    platform: getPlatform(),
  };
};
