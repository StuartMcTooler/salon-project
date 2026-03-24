// useTerminalPayment - Native/Web payment processing hook
import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { isNativeApp, getPlatform, isStripeTerminalPluginAvailable, isAndroid } from '@/lib/platform';
import { StripeTapToPay as StripeTapToPayNative } from '@/lib/stripeTapToPay';
import { getTestModeHeaders, type StripeMode } from '@/hooks/useTestModeOverride';
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

const isCanceledTerminalError = (err: any): boolean => {
  const message = err?.errorMessage || err?.message || String(err || '');
  return message.includes('The command was canceled') || message.includes('error_code=2020');
};

const withTimeout = async <T>(promise: Promise<T>, ms: number, label: string): Promise<T> => {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`${label} timed out after ${Math.round(ms / 1000)}s`));
    }, ms);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
};

// Native plugin reference - loaded dynamically at runtime only
let StripeTapToPayPlugin: any = null;
let StripeTapToPayAvailable: boolean | null = null; // Cache availability check
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
const loadStripeTapToPay = () => {
  if (!isNativeApp()) return null;
  if (StripeTapToPayPlugin) return StripeTapToPayPlugin;
  
  try {
    const Capacitor = (window as any).Capacitor;
    const pluginCandidate = Capacitor?.Plugins?.StripeTapToPay || StripeTapToPayNative;
    if (pluginCandidate) {
      StripeTapToPayPlugin = pluginCandidate;
      const methodProbe = {
        initialize: typeof pluginCandidate.initialize,
        addListener: typeof pluginCandidate.addListener,
        setConnectionToken: typeof pluginCandidate.setConnectionToken,
        discoverReaders: typeof pluginCandidate.discoverReaders,
        connectReader: typeof pluginCandidate.connectReader,
        disconnectReader: typeof pluginCandidate.disconnectReader,
        collectPaymentMethod: typeof pluginCandidate.collectPaymentMethod,
        confirmPaymentIntent: typeof pluginCandidate.confirmPaymentIntent,
        cancelPaymentIntent: typeof pluginCandidate.cancelPaymentIntent,
        isDeviceCapable: typeof pluginCandidate.isDeviceCapable,
      };
      console.log('[TerminalPayment] ✅ Loaded StripeTapToPay via Capacitor.Plugins');
      console.log('[TerminalPayment] Method probe:', methodProbe);
      console.log('[TerminalPayment] Own property names:', Object.getOwnPropertyNames(pluginCandidate));
      return StripeTapToPayPlugin;
    }
    
    // Plugin not found
    const availablePlugins = Object.keys(Capacitor?.Plugins || {});
    console.error('[TerminalPayment] ❌ StripeTapToPay not available');
    console.error('[TerminalPayment] Available plugins:', availablePlugins);
    
    throw new Error(`StripeTapToPay plugin not found. Available: [${availablePlugins.join(', ')}]. Rebuild with: npm run build && npx cap sync`);
  } catch (err: any) {
    console.error('[TerminalPayment] Failed to load Stripe Terminal plugin:', err);
    throw new Error(`Plugin load failed: ${err.message}`);
  }
};

// Initialization mutex - prevents concurrent initialization attempts
let initializationPromise: Promise<void> | null = null;
let initializationStartedAt: number | null = null;
let tokenListenerRegistered = false;
let inFlightConnectionTokenPromise: Promise<string> | null = null;

const getForcedStripeMode = (): StripeMode => {
  try {
    const storedMode = localStorage.getItem('FORCE_STRIPE_MODE');
    if (storedMode === 'test' || storedMode === 'live') {
      return storedMode;
    }
  } catch {
    // Ignore localStorage access failures in native/webview edge cases
  }
  return 'default';
};

export const useTerminalPayment = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [connectedReader, setConnectedReader] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [discoveredReaders, setDiscoveredReaders] = useState<any[]>([]);
  const [debugStage, setDebugStage] = useState<string>('idle');
  
  const terminalRef = useRef<any>(null);

  // Fetch connection token for native SDK
  // CRITICAL: Must use TEST mode headers to match isTest: true in initialize()
  const fetchConnectionToken = useCallback(async (): Promise<string> => {
    if (inFlightConnectionTokenPromise) {
      console.log('[TerminalPayment] Reusing in-flight connection token request');
      return inFlightConnectionTokenPromise;
    }

    inFlightConnectionTokenPromise = (async () => {
      const headers = getTestModeHeaders();
      const stripeMode = getForcedStripeMode();
      console.log('[TerminalPayment] Fetching connection token...', { stripeMode, headers });
      const { data, error } = await supabase.functions.invoke('create-terminal-connection-token', {
        headers,
      });
      if (error) {
        console.error('[TerminalPayment] Token fetch error:', error);
        throw new Error(error.message);
      }
      console.log('[TerminalPayment] Token received, mode:', data.stripeMode);
      return data.secret;
    })();

    try {
      return await inFlightConnectionTokenPromise;
    } finally {
      inFlightConnectionTokenPromise = null;
    }
  }, []);

  // Initialize native SDK with mutex to prevent concurrent init attempts
  const initializeNativeSDK = useCallback(async () => {
    console.log('[TerminalPayment] initializeNativeSDK() entered');
    setDebugStage('enter initializeNativeSDK');
    if (!isNativeApp()) {
      console.log('[TerminalPayment] Not native app, skipping SDK init');
      setDebugStage('skip initializeNativeSDK (not native)');
      return;
    }
    
    // If already initialized (check ref synchronously, not state)
    if (terminalRef.current) {
      console.log('[TerminalPayment] Already initialized (terminalRef populated)');
      setDebugStage('already initialized');
      return;
    }
    
    // If initialization is already in progress, give it a short window to complete.
    // If it looks stale, clear it so a fresh init can start instead of hanging forever.
    if (initializationPromise) {
      const ageMs = initializationStartedAt ? Date.now() - initializationStartedAt : null;
      console.log('[TerminalPayment] Initialization already in progress, waiting...', { ageMs });
      setDebugStage(ageMs && ageMs > 5000 ? 'stale initialization detected' : 'waiting for existing initialization');

      try {
        await withTimeout(initializationPromise, 5000, 'existing initialization');
        return;
      } catch (waitErr) {
        console.warn('[TerminalPayment] Existing initialization timed out or failed, resetting and retrying...', waitErr);
        initializationPromise = null;
        initializationStartedAt = null;
        terminalRef.current = null;
        setIsInitialized(false);
        setDebugStage('reset stale initialization');
      }
    }
    
    // Start initialization with mutex lock
    initializationStartedAt = Date.now();
    initializationPromise = (async () => {
      try {
        console.log('[TerminalPayment] Loading Stripe Terminal plugin...');
        setDebugStage('loading plugin');
        const StripeTapToPay = loadStripeTapToPay();
        if (!StripeTapToPay) throw new Error('Failed to load StripeTapToPay plugin');
        
        terminalRef.current = StripeTapToPay;
        
        // Set up connection token listener BEFORE initialize
        console.log('[TerminalPayment] Setting up token listener...');
        setDebugStage('setting token listener');
        try {
          if (!tokenListenerRegistered) {
            tokenListenerRegistered = true;
            const listenerResult = StripeTapToPay.addListener('requestedConnectionToken', async () => {
              console.log('[TerminalPayment] Token requested by SDK');
              try {
                const token = await fetchConnectionToken();
                await StripeTapToPay.setConnectionToken({ token });
                console.log('[TerminalPayment] Token provided to SDK');
              } catch (tokenErr) {
                console.error('[TerminalPayment] Failed to provide token:', tokenErr);
              }
            });

            // Capacitor listener registration can return a thenable proxy on iOS; don't let it block init.
            if (listenerResult && typeof listenerResult.then === 'function') {
              Promise.resolve(listenerResult)
                .then(() => console.log('[TerminalPayment] Token listener registration confirmed'))
                .catch((listenerErr: any) => console.warn('[TerminalPayment] Listener setup warning (non-fatal):', listenerErr));
            } else {
              console.log('[TerminalPayment] Token listener registered synchronously');
            }
          } else {
            console.log('[TerminalPayment] Token listener already registered');
          }

          console.log('[TerminalPayment] Continuing without waiting for token listener promise');
        } catch (listenerErr) {
          console.warn('[TerminalPayment] Listener setup warning (non-fatal):', listenerErr);
        }
        
        // Initialize SDK
        console.log('[TerminalPayment] Initializing SDK...');
        console.log('[TerminalPayment] Platform:', getPlatform());
        const stripeMode = getForcedStripeMode();
        const isTest = stripeMode !== 'live';
        console.log('[TerminalPayment] initialize() mode:', { stripeMode, isTest });
        
        console.log('[TerminalPayment] Calling native initialize()...');
        setDebugStage('calling native initialize');
        await withTimeout(
          StripeTapToPay.initialize({
            isTest,
          }),
          12000,
          'initialize'
        );
        console.log('[TerminalPayment] Native initialize() resolved');
        setDebugStage('native initialize resolved');
        
        setIsInitialized(true);
        console.log('[TerminalPayment] ✅ Native SDK initialized successfully');
        setDebugStage('initialized');
      } catch (err: any) {
        // Clear terminalRef on failure so retry is possible
        terminalRef.current = null;
        
        console.error('[TerminalPayment] ❌ Init error - Full object:', JSON.stringify(err, null, 2));
        console.error('[TerminalPayment] Error code:', err.code || 'NO_CODE');
        console.error('[TerminalPayment] Error message:', err.message || 'NO_MESSAGE');
        
        const detailedError = `[${err.code || 'UNKNOWN'}] ${err.message || err}`;
        setError(detailedError);
        setDebugStage(`init failed: ${detailedError}`);
        toast.error(`Terminal Init Error: ${detailedError}`);
        throw err;
      } finally {
        // Release the mutex
        initializationPromise = null;
        initializationStartedAt = null;
      }
    })();
    
    await initializationPromise;
    console.log('[TerminalPayment] initializeNativeSDK() complete');
    setDebugStage('initializeNativeSDK complete');
  }, [fetchConnectionToken]);

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
    console.log('[TerminalPayment] discoverReadersInternal start', { connectionType, locationId });
    setDebugStage(`discover start: ${connectionType}`);
    
    // For Tap to Pay, check device capability first
    if (connectionType === 'tap_to_pay') {
      console.log('[TerminalPayment] 📱 Checking Tap to Pay device capability...');
      try {
        if (typeof StripeTerminal.isDeviceCapable === 'function') {
          setDebugStage('checking device capability');
          const capable = await StripeTerminal.isDeviceCapable();
          console.log('[TerminalPayment] Device capable:', capable);
          const capableValue = typeof capable === 'object' && capable !== null && 'value' in capable ? capable.value : capable;
          if (!capableValue) {
            throw new Error('This device does not support Tap to Pay. Check: 1) NFC enabled in Settings, 2) Google Wallet installed with payment card, 3) Device supports HCE');
          }
        } else {
          console.warn('[TerminalPayment] isDeviceCapable is not a function on plugin');
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
    
    console.log('[TerminalPayment] Calling native discoverReaders()...');
    setDebugStage('calling native discoverReaders');
    const discoverTimeoutMs = 45000;
    console.log('[TerminalPayment] Waiting up to', discoverTimeoutMs, 'ms for native discoverReaders()');
    const result = await withTimeout(
      StripeTerminal.discoverReaders(discoveryConfig),
      discoverTimeoutMs,
      'discoverReaders'
    );
    
    console.log(`[TerminalPayment] ✅ Found ${result.readers?.length || 0} readers`);
    setDebugStage(`discover resolved: ${result.readers?.length || 0} readers`);
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
    locationId?: string
  ): Promise<PaymentResult> => {
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
      await initializeNativeSDK();
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
      console.log('[TerminalPayment] discoverReadersInternal returned', readers);
      
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
    const paymentHeaders = getTestModeHeaders();
    const stripeMode = getForcedStripeMode();
    const { data: intentData, error: intentError } = await supabase.functions.invoke(
      'create-terminal-payment-intent',
      {
        headers: paymentHeaders,
        body: { amount, appointmentId, customerEmail, forceStripeMode: stripeMode }
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
    console.log('[TerminalPayment] processPayment() called', { amount, config, appointmentId });
    setIsProcessing(true);
    setError(null);

    try {
      setDebugStage(`processPayment start: ${config.connectionType}`);
      if (isNativeApp() && (config.connectionType === 'tap_to_pay' || config.connectionType === 'bluetooth')) {
        // === NATIVE PATH: Use Stripe Terminal SDK ===
        console.log('[TerminalPayment] Using NATIVE SDK path');
        setDebugStage(`native path: ${config.connectionType}`);
        return await processNativePayment(amount, config.connectionType, appointmentId, customerEmail, config.locationId);
      } else {
        // === WEB PATH: Use Server-Driven API ===
        console.log('[TerminalPayment] Using SERVER-DRIVEN path');
        setDebugStage('server-driven path');
        return await processServerDrivenPayment(amount, config.readerId!, appointmentId, customerEmail);
      }
    } catch (err: any) {
      if (isCanceledTerminalError(err)) {
        console.warn('[TerminalPayment] Payment canceled:', err);
        setError('Payment canceled');
        setDebugStage('payment canceled');
        return { success: false, error: 'Payment canceled' };
      }

      console.error('[TerminalPayment] Payment error:', err);
      setError(err.message);
      setDebugStage(`payment failed: ${err.message}`);
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
    debugStage,
    
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
