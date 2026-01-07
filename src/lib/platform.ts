import { Capacitor } from '@capacitor/core';

// Platform detection utilities
export const isNativeApp = (): boolean => Capacitor.isNativePlatform();
export const getPlatform = (): 'android' | 'ios' | 'web' => Capacitor.getPlatform() as any;
export const isAndroid = (): boolean => getPlatform() === 'android';
export const isIOS = (): boolean => getPlatform() === 'ios';

// Cached plugin availability check
let stripeTerminalAvailable: boolean | null = null;

// Check if Stripe Terminal plugin is available at runtime
export const isStripeTerminalPluginAvailable = (): boolean => {
  if (stripeTerminalAvailable !== null) return stripeTerminalAvailable;
  
  if (!isNativeApp()) {
    stripeTerminalAvailable = false;
    return false;
  }
  
  try {
    const CapacitorObj = (window as any).Capacitor;
    stripeTerminalAvailable = !!CapacitorObj?.Plugins?.StripeTerminal;
  } catch {
    stripeTerminalAvailable = false;
  }
  
  return stripeTerminalAvailable;
};

// Reset cache (for testing or when plugin loads late)
export const resetPluginAvailabilityCache = (): void => {
  stripeTerminalAvailable = null;
};

// Feature availability checks - now require plugin availability
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
