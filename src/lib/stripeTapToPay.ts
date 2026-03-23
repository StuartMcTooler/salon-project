import { registerPlugin } from '@capacitor/core';

// Minimal JS wrapper for the native StripeTapToPay plugin.
// This ensures Capacitor registers the plugin on the JS side.
export const StripeTapToPay = registerPlugin<any>('StripeTapToPay');
