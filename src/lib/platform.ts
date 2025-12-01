import { Capacitor } from '@capacitor/core';

// Platform detection utilities
export const isNativeApp = (): boolean => Capacitor.isNativePlatform();
export const getPlatform = (): 'android' | 'ios' | 'web' => Capacitor.getPlatform() as any;
export const isAndroid = (): boolean => getPlatform() === 'android';
export const isIOS = (): boolean => getPlatform() === 'ios';

// Feature availability checks
export const canUseTapToPay = (): boolean => {
  if (!isNativeApp()) return false;
  // Tap to Pay requires native SDK on both iOS and Android
  return true;
};

export const canUseBluetoothReader = (): boolean => {
  if (!isNativeApp()) return false;
  // Bluetooth readers work on native apps only
  return true;
};

export const canUseInternetReader = (): boolean => {
  // Internet/WiFi readers work everywhere (server-driven)
  return true;
};

// Get available payment methods for current platform
export const getAvailablePaymentMethods = () => {
  const methods: Array<'tap_to_pay' | 'bluetooth' | 'internet'> = ['internet'];
  
  if (isNativeApp()) {
    methods.unshift('tap_to_pay'); // Preferred on native
    methods.push('bluetooth');
  }
  
  return methods;
};
