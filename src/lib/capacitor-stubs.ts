// Empty stubs for native-only Capacitor plugins
// These are never used - native plugins are loaded via window.Capacitor.Plugins at runtime
// This file exists purely to satisfy Vite/Rollup during web builds

export const StripeTerminal = {};
export const TerminalConnectTypes = {
  TapToPay: 'tap-to-pay',
  Bluetooth: 'bluetooth', 
  Internet: 'internet',
};

export default { StripeTerminal, TerminalConnectTypes };
