// useTerminalPayment - Native/Web payment processing hook
import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { isNativeApp, getPlatform, isStripeTerminalPluginAvailable, isAndroid } from '@/lib/platform';
import type { StripeMode } from '@/hooks/useTestModeOverride';
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

const getHeadersForStripeMode = (forceStripeMode?: StripeMode): Record<string, string> => {
  if (forceStripeMode === 'test') return { 'x-force-test-mode': 'true' };
  if (forceStripeMode === 'live') return { 'x-force-live-mode': 'true' };
  return {};
};

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

// Initialization mutex - prevents concurrent initialization attempts
let initializationPromise: Promise<void> | null = null;

export const useTerminalPayment = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [connectedReader, setConnectedReader] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [discoveredReaders, setDiscoveredReaders] = useState<any[]>([]);
  
  const terminalRef = useRef<any>(null);
  const forceStripeModeRef = useRef<StripeMode | undefined>(undefined);
  const initializedStripeModeRef = useRef<'test' | 'live' | null>(null);

  // Fetch connection token for native SDK
  const fetchConnectionToken = useCallback(async (): Promise<string> => {
    const forceStripeMode = forceStripeModeRef.current;
    const headers = getHeadersForStripeMode(forceStripeMode);
    console.log('[TerminalPayment] Fetching connection token, override headers:', headers, 'forceStripeMode:', forceStripeMode ?? 'default');
    const { data, error } = await supabase.functions.invoke('create-terminal-connection-token', {
      body: forceStripeMode ? { forceStripeMode } : {},
      headers,
    });
    if (error) {
      console.error('[TerminalPayment] Token fetch error:', error);
      throw new Error(error.message);
    }
    console.log('[TerminalPayment] Token received, mode:', data.stripeMode);
    return data.secret;
  }, []);

  // Initialize native SDK with mutex to prevent concurrent init attempts
  const initializeNativeSDK = useCallback(async (forceStripeMode?: StripeMode) => {
    forceStripeModeRef.current = forceStripeMode;

    if (!isNativeApp()) {
      console.log('[TerminalPayment] Not native app, skipping SDK init');
      return;
    }

    const desiredMode = forceStripeMode === 'test' ? 'test' : 'live';
    
    // If already initialized with the correct environment, keep it.
    if (terminalRef.current && initializedStripeModeRef.current === desiredMode) {
      console.log('[TerminalPayment] Already initialized for mode:', desiredMode);
      return;
    }

    // If environment changed, reset the SDK so test/live cannot leak across sessions.
    if (terminalRef.current && initializedStripeModeRef.current !== desiredMode) {
      console.log('[TerminalPayment] Stripe environment changed, resetting SDK:', {
        from: initializedStripeModeRef.current,
        to: desiredMode,
      });

      try {
        if (connectedReader && typeof terminalRef.current.disconnectReader === 'function') {
          await terminalRef.current.disconnectReader();
        }
      } catch (disconnectError) {
        console.warn('[TerminalPayment] Failed to disconnect existing reader during reset:', disconnectError);
      }

      terminalRef.current = null;
      setConnectedReader(null);
      setDiscoveredReaders([]);
      setIsInitialized(false);
      initializedStripeModeRef.current = null;
    }
    
    // If initialization is already in progress, wait for it
    if (initializationPromise) {
      console.log('[TerminalPayment] Initialization already in progress, waiting...');
      await initializationPromise;
      return;
    }
    
    // Start initialization with mutex lock
    initializationPromise = (async () => {
      try {
        console.log('[TerminalPayment] Loading Stripe Terminal plugin...');
        const StripeTerminal = await loadStripeTerminal();
        if (!StripeTerminal) throw new Error('Failed to load Stripe Terminal plugin');
        
        terminalRef.current = StripeTerminal;
        
        // Set up connection token listener BEFORE initialize
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
        }
        
        // Initialize SDK
        console.log('[TerminalPayment] Initializing SDK...');
        console.log('[TerminalPayment] Platform:', getPlatform());
        console.log('[TerminalPayment] Stripe SDK mode:', desiredMode);
        
        await StripeTerminal.initialize({
          isTest: desiredMode === 'test',
        });
        
        setIsInitialized(true);
        initializedStripeModeRef.current = desiredMode;
        console.log('[TerminalPayment] ✅ Native SDK initialized successfully');
      } catch (err: any) {
        // Clear terminalRef on failure so retry is possible
        terminalRef.current = null;
        initializedStripeModeRef.current = null;
        
        console.error('[TerminalPayment] ❌ Init error - Full object:', JSON.stringify(err, null, 2));
        console.error('[TerminalPayment] Error code:', err.code || 'NO_CODE');
        console.error('[TerminalPayment] Error message:', err.message || 'NO_MESSAGE');
        
        const detailedError = `[${err.code || 'UNKNOWN'}] ${err.message || err}`;
        setError(detailedError);
        toast.error(`Terminal Init Error: ${detailedError}`);
        throw err;
      } finally {
        // Release the mutex
        initializationPromise = null;
      }
    })();
    
    await initializationPromise;
  }, [connectedReader, fetchConnectionToken]);

  // Request Android location permissions using Capacitor Geolocation plugin
  const requestLocationPermission = useCallback(async (): Promise<boolean> => {
    if (!isAndroid()) {
      console.log('[TerminalPayment] Not Android, skipping location permission request');
      return true; // iOS handles permissions differently
    }

    try {
      console.log('[TerminalPayment] 📍 Requesting Android location permission...');
      
      // Dynamic import to avoid breaking the bundle
      const { Geolocation } = await import('@capacitor/geolocation');
      
      // Check current permission status
      let permStatus;
      try {
        permStatus = await Geolocation.checkPermissions();
        console.log('[TerminalPayment] Current permission status:', permStatus.location);
      } catch (checkErr) {
        console.warn('[TerminalPayment] Permission check failed, will request:', checkErr);
        permStatus = { location: 'prompt' };
      }
      
      // Accept any non-denied state as potentially granted
      if (permStatus.location === 'granted' || permStatus.location === 'limited') {
        console.log('[TerminalPayment] ✅ Location permission already granted:', permStatus.location);
        return true;
      }
      
      // If denied, we can't proceed
      if (permStatus.location === 'denied') {
        console.warn('[TerminalPayment] ⚠️ Location permission was denied previously');
        toast.error('Location permission denied. Please enable in Settings > Apps > salon-project > Permissions.');
        return false;
      }
      
      // Request permission (status is 'prompt' or 'prompt-with-rationale')
      console.log('[TerminalPayment] Requesting permission...');
      const result = await Geolocation.requestPermissions({ permissions: ['location'] });
      console.log('[TerminalPayment] Permission request result:', result.location);
      
      // Accept any non-denied result
      if (result.location !== 'denied') {
        console.log('[TerminalPayment] ✅ Location permission granted:', result.location);
        return true;
      } else {
        console.warn('[TerminalPayment] ⚠️ Location permission denied');
        toast.error('Location permission is required for Tap to Pay.');
        return false;
      }
    } catch (err: any) {
      console.error('[TerminalPayment] Location permission error:', err);
      
      // If Geolocation plugin fails, try to proceed anyway
      // The Stripe SDK will give us the real error if location is truly needed
      console.warn('[TerminalPayment] ⚠️ Geolocation plugin error, proceeding anyway...');
      return true;
    }
  }, []);

  // Internal discovery function (called after permissions/init are handled)
  const discoverReadersInternal = useCallback(async (connectionType: ConnectionType, locationId?: string) => {
    const StripeTerminal = terminalRef.current;
    if (!StripeTerminal) throw new Error('Terminal not initialized');
    
    // For Tap to Pay, check device capability first
    if (connectionType === 'tap_to_pay' && isAndroid()) {
      console.log('[TerminalPayment] 📱 Checking Tap to Pay device capability...');
      try {
        // The plugin may have a method to check NFC availability
        if (typeof StripeTerminal.isDeviceCapable === 'function') {
          const capable = await StripeTerminal.isDeviceCapable();
          console.log('[TerminalPayment] Device capable:', capable);
          if (!capable) {
            throw new Error('This device does not support Tap to Pay. Check: 1) NFC enabled in Settings, 2) Google Wallet installed with payment card, 3) Device supports HCE');
          }
        }
      } catch (capErr: any) {
        console.warn('[TerminalPayment] Capability check:', capErr.message);
        // Continue anyway - let the SDK give us the real error
      }
    }
    
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
      isSimulated: false, // Real hardware discovery
    };
    if (locationId) {
      discoveryConfig.locationId = locationId;
    }
    
    console.log(`[TerminalPayment] 🔍 Discovering readers with config:`, discoveryConfig);
    console.log(`[TerminalPayment] Platform: ${getPlatform()}, ConnectionType: ${connectionType}`);
    console.log(`[TerminalPayment] LocationId: ${locationId || 'NOT PROVIDED'}`);
    
    const result = await StripeTerminal.discoverReaders(discoveryConfig);
    
    console.log(`[TerminalPayment] ✅ Found ${result.readers?.length || 0} readers`);
    setDiscoveredReaders(result.readers || []);
    return result.readers || [];
  }, []);

  // Public discover readers function (handles permissions + init + discovery)
  const discoverReaders = useCallback(async (connectionType: ConnectionType, locationId?: string) => {
    setError(null);
    
    if (!isNativeApp()) {
      console.log('[TerminalPayment] Not native, skipping discovery');
      return [];
    }
    
    try {
      // Request location permission on Android BEFORE SDK operations
      if (isAndroid() && (connectionType === 'tap_to_pay' || connectionType === 'bluetooth')) {
        const hasPermission = await requestLocationPermission();
        if (!hasPermission) {
          setError('Location permission denied');
          return [];
        }
      }

      // Use terminalRef for synchronous check (not async React state)
      if (!terminalRef.current) {
        console.log('[TerminalPayment] SDK not initialized, initializing now...');
        await initializeNativeSDK();
        // Increased stabilization delay for native bridge settling
        await new Promise(resolve => setTimeout(resolve, 800));
        if (!terminalRef.current) {
          throw new Error('Terminal initialization failed');
        }
      }
      
      return await discoverReadersInternal(connectionType, locationId);
    } catch (err: any) {
      console.error('[TerminalPayment] ❌ Discovery error - Full object:', JSON.stringify(err, null, 2));
      console.error('[TerminalPayment] Error code:', err.code || 'NO_CODE');
      console.error('[TerminalPayment] Error message:', err.message || 'NO_MESSAGE');
      
      const detailedError = `[${err.code || 'UNKNOWN'}] ${err.message || err}`;
      setError(detailedError);
      toast.error(`Discovery Error: ${detailedError}`);
      return [];
    }
  }, [isInitialized, initializeNativeSDK, requestLocationPermission, discoverReadersInternal]);

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
    locationId?: string,
    forceStripeMode?: StripeMode
  ): Promise<PaymentResult> => {
    forceStripeModeRef.current = forceStripeMode;

    // Step 0: Request location permission FIRST on Android (before SDK init)
    if (isAndroid() && (connectionType === 'tap_to_pay' || connectionType === 'bluetooth')) {
      console.log('[TerminalPayment] Checking Android permissions before SDK init...');
      const hasPermission = await requestLocationPermission();
      if (!hasPermission) {
        throw new Error('Location permission is required for Tap to Pay');
      }
    }

    // Step 1: ALWAYS ensure SDK is initialized before any operation
    // Use terminalRef (synchronous) not isInitialized (async React state)
    // This prevents the "first tap fails, second tap works" race condition
    if (!terminalRef.current) {
      console.log('[TerminalPayment] SDK not ready, initializing first...');
      await initializeNativeSDK(forceStripeMode);
      // Increased stabilization delay (800ms) for native bridge settling
      await new Promise(resolve => setTimeout(resolve, 800));
      if (!terminalRef.current) {
        throw new Error('Terminal not initialized after init attempt');
      }
      console.log('[TerminalPayment] SDK initialization complete, proceeding with payment');
    }

    // Step 2: Ensure we have a connected reader
    if (!connectedReader) {
      console.log('[TerminalPayment] No connected reader, discovering...');
      console.log(`[TerminalPayment] Using locationId: "${locationId || 'NOT PROVIDED'}"`);
      
      // discoverReaders no longer needs to check permissions - we did it above
      const readers = await discoverReadersInternal(connectionType, locationId);
      
      if (readers.length === 0) {
        const errorMsg = connectionType === 'tap_to_pay' 
          ? `Tap to Pay is not available. Make sure NFC is enabled in Settings and Google Wallet is installed.` 
          : 'No Bluetooth readers found nearby';
        throw new Error(errorMsg);
      }
      
      console.log('[TerminalPayment] Auto-connecting to first reader...');
      await connectReader(readers[0]);
    }

    // Step 2: Create PaymentIntent on server
    console.log('[TerminalPayment] Creating PaymentIntent on server...');
    const headers = getHeadersForStripeMode(forceStripeMode);
    const { data: intentData, error: intentError } = await supabase.functions.invoke(
      'create-terminal-payment-intent',
      { 
        body: { amount, appointmentId, customerEmail, forceStripeMode },
        headers,
      }
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
    customerEmail?: string,
    forceStripeMode?: StripeMode
  ): Promise<PaymentResult> => {
    const headers = getHeadersForStripeMode(forceStripeMode);
    const { data, error } = await supabase.functions.invoke('create-terminal-payment', {
      body: { amount, readerId, appointmentId, customerEmail, forceStripeMode },
      headers,
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
    customerEmail?: string,
    forceStripeMode?: StripeMode
  ): Promise<PaymentResult> => {
    setIsProcessing(true);
    setError(null);

    try {
      if (isNativeApp() && (config.connectionType === 'tap_to_pay' || config.connectionType === 'bluetooth')) {
        // === NATIVE PATH: Use Stripe Terminal SDK ===
        console.log('[TerminalPayment] Using NATIVE SDK path');
        return await processNativePayment(amount, config.connectionType, appointmentId, customerEmail, config.locationId, forceStripeMode);
      } else {
        // === WEB PATH: Use Server-Driven API ===
        console.log('[TerminalPayment] Using SERVER-DRIVEN path');
        return await processServerDrivenPayment(amount, config.readerId!, appointmentId, customerEmail, forceStripeMode);
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
