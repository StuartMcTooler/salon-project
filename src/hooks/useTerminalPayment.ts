import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { isNativeApp, getPlatform } from '@/lib/platform';
import { toast } from 'sonner';

// Type definitions
type ConnectionType = 'internet' | 'bluetooth' | 'tap_to_pay';

interface TerminalConfig {
  connectionType: ConnectionType;
  readerId?: string;
  readerName?: string;
  locationId?: string;
}

interface PaymentResult {
  success: boolean;
  paymentIntentId?: string;
  error?: string;
}

// Native plugin reference - loaded dynamically at runtime only
let StripeTerminalPlugin: any = null;
let TerminalConnectTypesEnum: any = {
  TapToPay: 'tap-to-pay',
  Bluetooth: 'bluetooth',
  Internet: 'internet',
};

/**
 * Load Stripe Terminal plugin at RUNTIME only in native context
 * Uses Capacitor.Plugins - NO static imports of the native module
 */
const loadStripeTerminal = async () => {
  if (!isNativeApp()) return null;
  if (StripeTerminalPlugin) return StripeTerminalPlugin;
  
  try {
    // Access via Capacitor.Plugins at runtime (available in native builds)
    const Capacitor = (window as any).Capacitor;
    if (Capacitor?.Plugins?.StripeTerminal) {
      StripeTerminalPlugin = Capacitor.Plugins.StripeTerminal;
      console.log('[TerminalPayment] Loaded StripeTerminal via Capacitor.Plugins');
      return StripeTerminalPlugin;
    }
    
    // If not available via Plugins, the native module isn't installed
    throw new Error('StripeTerminal not found in Capacitor.Plugins');
  } catch (err) {
    console.error('[TerminalPayment] Failed to load Stripe Terminal plugin:', err);
    throw new Error('Stripe Terminal plugin not available. Please rebuild the native app with: npm run build && npx cap sync android');
  }
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
    console.log('[TerminalPayment] Fetching connection token...');
    const { data, error } = await supabase.functions.invoke('create-terminal-connection-token');
    if (error) {
      console.error('[TerminalPayment] Token fetch error:', error);
      throw new Error(error.message);
    }
    console.log('[TerminalPayment] Token received');
    return data.secret;
  }, []);

  // Initialize native SDK
  const initializeNativeSDK = useCallback(async () => {
    if (!isNativeApp()) {
      console.log('[TerminalPayment] Not native app, skipping SDK init');
      return;
    }
    if (isInitialized) {
      console.log('[TerminalPayment] Already initialized');
      return;
    }
    
    try {
      console.log('[TerminalPayment] Loading Stripe Terminal plugin...');
      const StripeTerminal = await loadStripeTerminal();
      if (!StripeTerminal) throw new Error('Failed to load Stripe Terminal plugin');
      
      terminalRef.current = StripeTerminal;
      
      // Set up connection token listener BEFORE initialize
      console.log('[TerminalPayment] Setting up token listener...');
      StripeTerminal.addListener('requestedConnectionToken', async () => {
        console.log('[TerminalPayment] Token requested by SDK');
        try {
          const token = await fetchConnectionToken();
          await StripeTerminal.setConnectionToken({ token });
          console.log('[TerminalPayment] Token provided to SDK');
        } catch (err) {
          console.error('[TerminalPayment] Failed to provide token:', err);
        }
      });
      
      // Initialize without tokenProviderEndpoint (we provide tokens manually)
      console.log('[TerminalPayment] Initializing SDK...');
      await StripeTerminal.initialize({
        isTest: false,
      });
      
      setIsInitialized(true);
      console.log('[TerminalPayment] ✅ Native SDK initialized successfully');
    } catch (err: any) {
      console.error('[TerminalPayment] ❌ Init error:', err);
      setError(err.message);
      throw err;
    }
  }, [isInitialized, fetchConnectionToken]);

  // Discover readers based on connection type
  const discoverReaders = useCallback(async (connectionType: ConnectionType, locationId?: string) => {
    setError(null);
    
    if (!isNativeApp()) {
      console.log('[TerminalPayment] Not native, skipping discovery');
      return [];
    }
    
    try {
      if (!isInitialized) {
        console.log('[TerminalPayment] SDK not initialized, initializing now...');
        await initializeNativeSDK();
      }
      
      const StripeTerminal = terminalRef.current;
      if (!StripeTerminal) throw new Error('Terminal not initialized');
      
      // Map our connection type to plugin's TerminalConnectTypes
      let terminalType: string;
      switch (connectionType) {
        case 'tap_to_pay':
          terminalType = TerminalConnectTypesEnum?.TapToPay || 'tap-to-pay';
          break;
        case 'bluetooth':
          terminalType = TerminalConnectTypesEnum?.Bluetooth || 'bluetooth';
          break;
        default:
          terminalType = TerminalConnectTypesEnum?.Internet || 'internet';
      }
      
      const discoveryConfig: any = { type: terminalType };
      if (locationId) {
        discoveryConfig.locationId = locationId;
      }
      
      console.log(`[TerminalPayment] 🔍 Discovering readers with config:`, discoveryConfig);
      console.log(`[TerminalPayment] Platform: ${getPlatform()}, ConnectionType: ${connectionType}`);
      
      const result = await StripeTerminal.discoverReaders(discoveryConfig);
      
      console.log(`[TerminalPayment] ✅ Found ${result.readers?.length || 0} readers`);
      setDiscoveredReaders(result.readers || []);
      return result.readers || [];
    } catch (err: any) {
      console.error('[TerminalPayment] ❌ Discovery error:', err);
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
      
      console.log('[TerminalPayment] Connecting to reader:', reader.serialNumber || reader.label);
      await StripeTerminal.connectReader({ reader });
      setConnectedReader(reader);
      console.log('[TerminalPayment] ✅ Connected to reader');
    } catch (err: any) {
      console.error('[TerminalPayment] ❌ Connect error:', err);
      setError(err.message);
      throw err;
    }
  }, []);

  // Native payment flow (Tap to Pay / Bluetooth)
  const processNativePayment = async (
    amount: number,
    connectionType: ConnectionType,
    appointmentId?: string,
    customerEmail?: string,
    locationId?: string
  ): Promise<PaymentResult> => {
    const StripeTerminal = terminalRef.current;
    if (!StripeTerminal) {
      console.log('[TerminalPayment] SDK not ready, initializing...');
      await initializeNativeSDK();
      if (!terminalRef.current) {
        throw new Error('Terminal not initialized');
      }
    }

    // Step 1: Ensure we have a connected reader
    if (!connectedReader) {
      console.log('[TerminalPayment] No connected reader, discovering...');
      console.log(`[TerminalPayment] Using locationId: "${locationId || 'NOT PROVIDED'}"`);
      
      const readers = await discoverReaders(connectionType, locationId);
      
      if (readers.length === 0) {
        const errorMsg = connectionType === 'tap_to_pay' 
          ? `Tap to Pay is not available. Make sure NFC is enabled. LocationId: ${locationId || 'MISSING'}` 
          : 'No Bluetooth readers found nearby';
        throw new Error(errorMsg);
      }
      
      console.log('[TerminalPayment] Auto-connecting to first reader...');
      await connectReader(readers[0]);
    }

    // Step 2: Create PaymentIntent on server
    console.log('[TerminalPayment] Creating PaymentIntent on server...');
    const { data: intentData, error: intentError } = await supabase.functions.invoke(
      'create-terminal-payment-intent',
      { body: { amount, appointmentId, customerEmail } }
    );
    
    if (intentError) throw new Error(intentError.message);
    console.log('[TerminalPayment] PaymentIntent created:', intentData.paymentIntentId);

    // Step 3: Collect payment method
    console.log('[TerminalPayment] Collecting payment method...');
    toast.info(connectionType === 'tap_to_pay' ? 'Ready - Tap card on phone' : 'Present card to reader');
    
    await terminalRef.current.collectPaymentMethod({
      paymentIntent: intentData.clientSecret,
    });
    console.log('[TerminalPayment] Payment method collected');

    // Step 4: Confirm the payment
    console.log('[TerminalPayment] Confirming payment...');
    await terminalRef.current.confirmPaymentIntent();
    console.log('[TerminalPayment] ✅ Payment confirmed!');
    
    // Step 5: Update appointment status
    if (appointmentId) {
      await supabase
        .from('salon_appointments')
        .update({ payment_status: 'paid', payment_method: 'card_present' })
        .eq('id', appointmentId);
    }

    toast.success('Payment successful!');
    return {
      success: true,
      paymentIntentId: intentData.paymentIntentId,
    };
  };

  // Server-driven payment flow (WiFi readers)
  const processServerDrivenPayment = async (
    amount: number,
    readerId: string,
    appointmentId?: string,
    customerEmail?: string
  ): Promise<PaymentResult> => {
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
        console.log('[TerminalPayment] Using NATIVE SDK path');
        return await processNativePayment(amount, config.connectionType, appointmentId, customerEmail, config.locationId);
      } else {
        // === WEB PATH: Use Server-Driven API ===
        console.log('[TerminalPayment] Using SERVER-DRIVEN path');
        return await processServerDrivenPayment(amount, config.readerId!, appointmentId, customerEmail);
      }
    } catch (err: any) {
      console.error('[TerminalPayment] Payment error:', err);
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setIsProcessing(false);
    }
  }, [connectedReader, discoverReaders, connectReader]);

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
