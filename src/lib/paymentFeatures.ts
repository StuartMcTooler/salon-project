export const isTapToPayEnabled = (): boolean =>
  import.meta.env.VITE_ENABLE_TAP_TO_PAY === 'true';

export const isBluetoothReadersEnabled = (): boolean =>
  import.meta.env.VITE_ENABLE_BLUETOOTH_READERS === 'true';

export const availableStaffTerminalTypes = (): string[] =>
  [
    ...(isTapToPayEnabled() ? ['tap_to_pay'] : []),
    ...(isBluetoothReadersEnabled() ? ['bluetooth'] : []),
    'business_reader',
  ];
