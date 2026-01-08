import { Capacitor } from '@capacitor/core';

// Platform detection utilities
export const isNativeApp = (): boolean => Capacitor.isNativePlatform();
export const getPlatform = (): 'android' | 'ios' | 'web' => Capacitor.getPlatform() as any;
export const isAndroid = (): boolean => getPlatform() === 'android';
export const isIOS = (): boolean => getPlatform() === 'ios';

// Check if Stripe Terminal plugin is available at runtime
// Note: NO CACHING - plugin may load after initial check during hot reload
export const isStripeTerminalPluginAvailable = (): boolean => {
  if (!isNativeApp()) {
    return false;
  }
  
  try {
    // Check multiple possible plugin locations
    const CapacitorObj = (window as any).Capacitor;
    
    // Method 1: Check Capacitor.Plugins.StripeTerminal (registered plugins)
    if (CapacitorObj?.Plugins?.StripeTerminal) {
      console.log('[Platform] StripeTerminal found at Capacitor.Plugins.StripeTerminal');
      return true;
    }
    
    // Method 2: Check if plugin is registered via registerPlugin
    // The plugin exports its instance which gets added to Capacitor
    if (CapacitorObj?.registeredPlugins?.has?.('StripeTerminal')) {
      console.log('[Platform] StripeTerminal found in registeredPlugins');
      return true;
    }
    
    // Method 3: Try dynamic import check (async would be better but keeping sync for now)
    // If we reach here, plugin is not available
    console.log('[Platform] StripeTerminal plugin not found');
    return false;
  } catch (e) {
    console.error('[Platform] Error checking StripeTerminal:', e);
    return false;
  }
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
