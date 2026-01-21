// useTerminalPayment - Native/Web payment processing hook
import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { isNativeApp, getPlatform, isStripeTerminalPluginAvailable } from '@/lib/platform';
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
let StripeTerminalAvailable: boolean | null = null; // Cache availability check
let TerminalConnectTypesEnum: any = {
  TapToPay: 'tap-to-pay',
  Bluetooth: 'bluetooth',
  Internet: 'internet',
};

// Re-export from platform.ts for backwards compatibility
export { isStripeTerminalPluginAvailable as isStripeTerminalAvailable } from '@/lib/platform';

/**
 * Load Stripe Terminal plugin at RUNTIME only in native context
 * Uses dynamic import to load the plugin module
 */
const loadStripeTerminal = async () => {
  if (!isNativeApp()) return null;
  if (StripeTerminalPlugin) return StripeTerminalPlugin;
  
  try {
    console.log('[TerminalPayment] Loading StripeTerminal via dynamic import...');
    
    // Dynamic import of the plugin module - this registers the plugin properly
    const module = await import('@capacitor-community/stripe-terminal');
    
    if (module?.StripeTerminal) {
      StripeTerminalPlugin = module.StripeTerminal;
      console.log('[TerminalPayment] ✅ Loaded StripeTerminal via dynamic import');
      console.log('[TerminalPayment] Available methods:', Object.keys(StripeTerminalPlugin));
      return StripeTerminalPlugin;
    }
    
    // Fallback: check Capacitor.Plugins
    const Capacitor = (window as any).Capacitor;
    if (Capacitor?.Plugins?.StripeTerminal) {
      StripeTerminalPlugin = Capacitor.Plugins.StripeTerminal;
      console.log('[TerminalPayment] ✅ Loaded StripeTerminal via Capacitor.Plugins fallback');
      return StripeTerminalPlugin;
    }
    
    // Plugin not found
    const availablePlugins = Object.keys(Capacitor?.Plugins || {});
    console.error('[TerminalPayment] ❌ StripeTerminal not available');
    console.error('[TerminalPayment] Available plugins:', availablePlugins);
    
    throw new Error(`StripeTerminal plugin not found. Available: [${availablePlugins.join(', ')}]. Rebuild with: npm run build && npx cap sync android`);
  } catch (err: any) {
    console.error('[TerminalPayment] Failed to load Stripe Terminal plugin:', err);
    throw new Error(`Plugin load failed: ${err.message}`);
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
  // CRITICAL: Must use TEST mode headers to match isTest: true in initialize()
  const fetchConnectionToken = useCallback(async (): Promise<string> => {
    console.log('[TerminalPayment] Fetching connection token (TEST MODE)...');
    const { data, error } = await supabase.functions.invoke('create-terminal-connection-token', {
      headers: {
        'x-force-test-mode': 'true', // MUST match isTest: true in SDK init
      },
    });
    if (error) {
      console.error('[TerminalPayment] Token fetch error:', error);
      throw new Error(error.message);
    }
    console.log('[TerminalPayment] Token received, mode:', data.stripeMode);
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
      // Note: addListener may not return a Promise in some Capacitor versions
      console.log('[TerminalPayment] Setting up token listener...');
      try {
        const listenerResult = StripeTerminal.addListener('requestedConnectionToken', async () => {
          console.log('[TerminalPayment] Token requested by SDK');
          try {
            const token = await fetchConnectionToken();
            await StripeTerminal.setConnectionToken({ token });
            console.log('[TerminalPayment] Token provided to SDK');
          } catch (tokenErr) {
            console.error('[TerminalPayment] Failed to provide token:', tokenErr);
          }
        });
        // Handle both Promise and non-Promise returns from addListener
        if (listenerResult && typeof listenerResult.then === 'function') {
          await listenerResult;
        }
        console.log('[TerminalPayment] Token listener set up successfully');
      } catch (listenerErr) {
        console.warn('[TerminalPayment] Listener setup warning (non-fatal):', listenerErr);
        // Continue - some plugin versions don't require awaiting the listener
      }
      
      // Initialize without tokenProviderEndpoint (we provide tokens manually)
      // TEMPORARY: Hardcoded to TEST MODE for hardware verification
      // TODO: Change back to false for production release builds
      console.log('[TerminalPayment] Initializing SDK...');
      console.log('[TerminalPayment] Platform:', getPlatform());
      console.log('[TerminalPayment] isTest: true (TEST MODE - HARDWARE VERIFICATION)');
      
      await StripeTerminal.initialize({
        isTest: true,  // HARDCODED FOR TEST BUILD
      });
      
      setIsInitialized(true);
      console.log('[TerminalPayment] ✅ Native SDK initialized successfully');
    } catch (err: any) {
      // Comprehensive error logging for Stripe Terminal errors
      console.error('[TerminalPayment] ❌ Init error - Full object:', JSON.stringify(err, null, 2));
      console.error('[TerminalPayment] Error code:', err.code || 'NO_CODE');
      console.error('[TerminalPayment] Error message:', err.message || 'NO_MESSAGE');
      console.error('[TerminalPayment] Error name:', err.name || 'NO_NAME');
      console.error('[TerminalPayment] Error data:', err.data || 'NO_DATA');
      
      const detailedError = `[${err.code || 'UNKNOWN'}] ${err.message || err}`;
      setError(detailedError);
      toast.error(`Terminal Init Error: ${detailedError}`);
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
      
      const discoveryConfig: any = { 
        type: terminalType,
        // Force real hardware discovery - required for Tap to Pay on Android
        // even when Stripe account is in Test Mode
        isSimulated: false,
      };
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
      // Comprehensive error logging - this is where "App Update Required" likely surfaces
      console.error('[TerminalPayment] ❌ Discovery error - Full object:', JSON.stringify(err, null, 2));
      console.error('[TerminalPayment] Error code:', err.code || 'NO_CODE');
      console.error('[TerminalPayment] Error message:', err.message || 'NO_MESSAGE');
      console.error('[TerminalPayment] Error name:', err.name || 'NO_NAME');
      console.error('[TerminalPayment] Error data:', err.data || 'NO_DATA');
      console.error('[TerminalPayment] Error localizedMessage:', err.localizedMessage || 'N/A');
      
      const detailedError = `[${err.code || 'UNKNOWN'}] ${err.message || err}`;
      setError(detailedError);
      toast.error(`Discovery Error: ${detailedError}`);
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
      console.error('[TerminalPayment] ❌ Connect error - Full object:', JSON.stringify(err, null, 2));
      console.error('[TerminalPayment] Error code:', err.code || 'NO_CODE');
      console.error('[TerminalPayment] Error message:', err.message || 'NO_MESSAGE');
      
      const detailedError = `[${err.code || 'UNKNOWN'}] ${err.message || err}`;
      setError(detailedError);
      toast.error(`Connect Error: ${detailedError}`);
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
    // ALWAYS ensure SDK is initialized before any operation
    // This prevents the "first tap fails, second tap works" race condition
    if (!isInitialized || !terminalRef.current) {
      console.log('[TerminalPayment] SDK not ready, initializing first...');
      await initializeNativeSDK();
      // Wait a moment for SDK to fully stabilize after initialization
      await new Promise(resolve => setTimeout(resolve, 300));
      if (!terminalRef.current) {
        throw new Error('Terminal not initialized');
      }
      console.log('[TerminalPayment] SDK initialization complete, proceeding with payment');
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
