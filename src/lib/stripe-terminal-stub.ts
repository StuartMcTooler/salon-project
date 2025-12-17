// Stub module for @capacitor-community/stripe-terminal
// This is used during web builds where the native plugin isn't available
// The real module is loaded dynamically at runtime only in native app context

export const StripeTerminal = {
  initialize: async (_options?: any) => { throw new Error('Stripe Terminal not available in web build'); },
  setConnectionToken: async (_options?: any) => { throw new Error('Stripe Terminal not available in web build'); },
  discoverReaders: async (_options?: any) => { throw new Error('Stripe Terminal not available in web build'); },
  connectReader: async (_options?: any) => { throw new Error('Stripe Terminal not available in web build'); },
  collectPaymentMethod: async (_options?: any) => { throw new Error('Stripe Terminal not available in web build'); },
  confirmPaymentIntent: async (_options?: any) => { throw new Error('Stripe Terminal not available in web build'); },
  cancelDiscoverReaders: async () => { throw new Error('Stripe Terminal not available in web build'); },
  disconnectReader: async () => { throw new Error('Stripe Terminal not available in web build'); },
  cancelCollectPaymentMethod: async () => { throw new Error('Stripe Terminal not available in web build'); },
  addListener: (_event: string, _callback: (...args: any[]) => void) => ({ remove: () => {} }),
  removeAllListeners: async () => {},
};

export const TerminalConnectTypes = {
  TapToPay: 'tap-to-pay',
  Bluetooth: 'bluetooth',
  Internet: 'internet',
};

export default { StripeTerminal, TerminalConnectTypes };
