import { useMemo } from 'react';
import * as Platform from '@/lib/platform';

export const usePlatform = () => {
  return useMemo(() => ({
    isNative: Platform.isNativeApp(),
    platform: Platform.getPlatform(),
    isAndroid: Platform.isAndroid(),
    isIOS: Platform.isIOS(),
    canUseTapToPay: Platform.canUseTapToPay(),
    canUseBluetoothReader: Platform.canUseBluetoothReader(),
    canUseInternetReader: Platform.canUseInternetReader(),
    availablePaymentMethods: Platform.getAvailablePaymentMethods(),
  }), []);
};
