// @ts-nocheck
/**
 * Native version of useTerminalPayment
 * This file contains the Capacitor Stripe Terminal SDK integration
 * It is ONLY imported in native app context via dynamic import
 * 
 * @ts-nocheck is used because the Capacitor plugin types are only available
 * at runtime in native builds, not during web build type checking
 */
import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getPlatform } from '@/lib/platform';
import { toast } from 'sonner';
// This import is safe here because this file is only loaded in native context
import { StripeTerminal, TerminalConnectTypes } from '@capacitor-community/stripe-terminal';

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

export const useTerminalPayment = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [connectedReader, setConnectedReader] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [discoveredReaders, setDiscoveredReaders] = useState<any[]>([]);
  
  const terminalRef = useRef<typeof StripeTerminal | null>(null);

  // Fetch connection token for native SDK
  const fetchConnectionToken = useCallback(async (): Promise<string> => {
    console.log('[TerminalPayment:Native] Fetching connection token...');
    const { data, error } = await supabase.functions.invoke('create-terminal-connection-token');
    if (error) {
      console.error('[TerminalPayment:Native] Token fetch error:', error);
      throw new Error(error.message);
    }
    console.log('[TerminalPayment:Native] Token received');
    return data.secret;
  }, []);

  // Initialize native SDK
  const initializeNativeSDK = useCallback(async () => {
    if (isInitialized) {
      console.log('[TerminalPayment:Native] Already initialized');
      return;
    }
    
    try {
      console.log('[TerminalPayment:Native] Initializing Stripe Terminal SDK...');
      terminalRef.current = StripeTerminal;
      
      // Set up connection token listener BEFORE initialize
      console.log('[TerminalPayment:Native] Setting up token listener...');
      StripeTerminal.addListener('requestedConnectionToken', async () => {
        console.log('[TerminalPayment:Native] Token requested by SDK');
        try {
          const token = await fetchConnectionToken();
          await StripeTerminal.setConnectionToken({ token });
          console.log('[TerminalPayment:Native] Token provided to SDK');
        } catch (err) {
          console.error('[TerminalPayment:Native] Failed to provide token:', err);
        }
      });
      
      // Initialize without tokenProviderEndpoint (we provide tokens manually)
      console.log('[TerminalPayment:Native] Initializing SDK...');
      await StripeTerminal.initialize({
        isTest: false,
      });
      
      setIsInitialized(true);
      console.log('[TerminalPayment:Native] ✅ SDK initialized successfully');
    } catch (err: any) {
      console.error('[TerminalPayment:Native] ❌ Init error:', err);
      setError(err.message);
      throw err;
    }
  }, [isInitialized, fetchConnectionToken]);

  // Discover readers based on connection type
  const discoverReaders = useCallback(async (connectionType: ConnectionType, locationId?: string) => {
    setError(null);
    
    try {
      if (!isInitialized) {
        console.log('[TerminalPayment:Native] SDK not initialized, initializing now...');
        await initializeNativeSDK();
      }
      
      if (!terminalRef.current) throw new Error('Terminal not initialized');
      
      // Map connection type to plugin's TerminalConnectTypes
      let terminalType: string;
      switch (connectionType) {
        case 'tap_to_pay':
          terminalType = TerminalConnectTypes?.TapToPay || 'tap-to-pay';
          break;
        case 'bluetooth':
          terminalType = TerminalConnectTypes?.Bluetooth || 'bluetooth';
          break;
        default:
          terminalType = TerminalConnectTypes?.Internet || 'internet';
      }
      
      const discoveryConfig: any = { type: terminalType };
      if (locationId) {
        discoveryConfig.locationId = locationId;
      }
      
      console.log(`[TerminalPayment:Native] 🔍 Discovering readers:`, discoveryConfig);
      
      const result = await StripeTerminal.discoverReaders(discoveryConfig);
      
      console.log(`[TerminalPayment:Native] ✅ Found ${result.readers?.length || 0} readers`);
      setDiscoveredReaders(result.readers || []);
      return result.readers || [];
    } catch (err: any) {
      console.error('[TerminalPayment:Native] ❌ Discovery error:', err);
      setError(err.message);
      return [];
    }
  }, [isInitialized, initializeNativeSDK]);

  // Connect to a reader
  const connectReader = useCallback(async (reader: any) => {
    try {
      if (!terminalRef.current) throw new Error('Terminal not initialized');
      
      console.log('[TerminalPayment:Native] Connecting to reader:', reader.serialNumber || reader.label);
      await StripeTerminal.connectReader({ reader });
      setConnectedReader(reader);
      console.log('[TerminalPayment:Native] ✅ Connected to reader');
    } catch (err: any) {
      console.error('[TerminalPayment:Native] ❌ Connect error:', err);
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
    if (!terminalRef.current) {
      console.log('[TerminalPayment:Native] SDK not ready, initializing...');
      await initializeNativeSDK();
      if (!terminalRef.current) {
        throw new Error('Terminal not initialized');
      }
    }

    // Step 1: Ensure we have a connected reader
    if (!connectedReader) {
      console.log('[TerminalPayment:Native] No connected reader, discovering...');
      const readers = await discoverReaders(connectionType, locationId);
      
      if (readers.length === 0) {
        const errorMsg = connectionType === 'tap_to_pay' 
          ? `Tap to Pay is not available. Make sure NFC is enabled. LocationId: ${locationId || 'MISSING'}` 
          : 'No Bluetooth readers found nearby';
        throw new Error(errorMsg);
      }
      
      console.log('[TerminalPayment:Native] Auto-connecting to first reader...');
      await connectReader(readers[0]);
    }

    // Step 2: Create PaymentIntent on server
    console.log('[TerminalPayment:Native] Creating PaymentIntent...');
    const { data: intentData, error: intentError } = await supabase.functions.invoke(
      'create-terminal-payment-intent',
      { body: { amount, appointmentId, customerEmail } }
    );
    
    if (intentError) throw new Error(intentError.message);
    console.log('[TerminalPayment:Native] PaymentIntent created:', intentData.paymentIntentId);

    // Step 3: Collect payment method
    console.log('[TerminalPayment:Native] Collecting payment method...');
    toast.info(connectionType === 'tap_to_pay' ? 'Ready - Tap card on phone' : 'Present card to reader');
    
    await StripeTerminal.collectPaymentMethod({
      paymentIntent: intentData.clientSecret,
    });
    console.log('[TerminalPayment:Native] Payment method collected');

    // Step 4: Confirm the payment
    console.log('[TerminalPayment:Native] Confirming payment...');
    await StripeTerminal.confirmPaymentIntent();
    console.log('[TerminalPayment:Native] ✅ Payment confirmed!');
    
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
      if (config.connectionType === 'tap_to_pay' || config.connectionType === 'bluetooth') {
        console.log('[TerminalPayment:Native] Using NATIVE SDK path');
        return await processNativePayment(amount, config.connectionType, appointmentId, customerEmail, config.locationId);
      } else {
        console.log('[TerminalPayment:Native] Using SERVER-DRIVEN path');
        return await processServerDrivenPayment(amount, config.readerId!, appointmentId, customerEmail);
      }
    } catch (err: any) {
      console.error('[TerminalPayment:Native] Payment error:', err);
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
    isNative: true,
    platform: getPlatform(),
  };
};
