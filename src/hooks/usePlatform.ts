import * as Platform from '@/lib/platform';

export const usePlatform = () => {
  // Don't memoize - platform detection must be fresh each time
  // to handle cases where Capacitor initializes after first render
  return {
    isNative: Platform.isNativeApp(),
    platform: Platform.getPlatform(),
    isAndroid: Platform.isAndroid(),
    isIOS: Platform.isIOS(),
    canUseTapToPay: Platform.canUseTapToPay(),
    canUseBluetoothReader: Platform.canUseBluetoothReader(),
    canUseInternetReader: Platform.canUseInternetReader(),
    availablePaymentMethods: Platform.getAvailablePaymentMethods(),
    // Expose raw plugin availability for UI messaging
    isStripeTerminalPluginAvailable: Platform.isStripeTerminalPluginAvailable(),
  };
};
