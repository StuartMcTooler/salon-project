import { Capacitor } from '@capacitor/core';

// Platform detection utilities
export const isNativeApp = (): boolean => Capacitor.isNativePlatform();
export const getPlatform = (): 'android' | 'ios' | 'web' => Capacitor.getPlatform() as any;
export const isAndroid = (): boolean => getPlatform() === 'android';
export const isIOS = (): boolean => getPlatform() === 'ios';

// Check if Stripe Terminal plugin is available at runtime
// IMPORTANT: For native Android, we assume plugin is available and defer actual
// detection to the async loading phase in useTerminalPayment. This prevents
// false "App Update Required" warnings from synchronous detection race conditions.
export const isStripeTerminalPluginAvailable = (): boolean => {
  if (!isNativeApp()) {
    return false;
  }
  
  // On native platforms, assume plugin is available.
  // Actual availability is verified during async initialization in useTerminalPayment.
  // The plugin is dynamically loaded there, and any real errors will surface then.
  console.log('[Platform] Native app detected - assuming StripeTerminal available (verified async)');
  return true;
};

// Feature availability checks - require plugin availability
export const canUseTapToPay = (): boolean => {
  if (!isNativeApp()) return false;
  if (!isAndroid()) return false; // Tap to Pay on Android only for now
  return isStripeTerminalPluginAvailable();
};

export const canUseBluetoothReader = (): boolean => {
  if (!isNativeApp()) return false;
  return isStripeTerminalPluginAvailable();
};

export const canUseInternetReader = (): boolean => {
  // Internet/WiFi readers work everywhere (server-driven)
  return true;
};

// Get available payment methods for current platform
export const getAvailablePaymentMethods = () => {
  const methods: Array<'tap_to_pay' | 'bluetooth' | 'internet'> = ['internet'];
  
  if (canUseTapToPay()) {
    methods.unshift('tap_to_pay'); // Preferred when available
  }
  if (canUseBluetoothReader()) {
    methods.push('bluetooth');
  }
  
  return methods;
};
