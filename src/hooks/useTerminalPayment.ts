/**
 * Terminal Payment Hook - Platform-Aware
 * 
 * This is the main entry point. It re-exports from the web version by default.
 * The native version is loaded dynamically only when running in a native app context.
 * 
 * IMPORTANT: The native module (@capacitor-community/stripe-terminal) is NEVER
 * statically imported in this file to prevent Vite/Rollup build failures.
 */

// Always export the web version for the build
// The native version will be used at runtime via the platform detection in components
export { useTerminalPayment } from './useTerminalPayment.web';

// Re-export types
export type { } from './useTerminalPayment.web';
