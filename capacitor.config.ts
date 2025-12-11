import type { CapacitorConfig } from '@capacitor/cli';

// Set to true for development hot-reload, false for production builds
const USE_DEV_SERVER = false;

const config: CapacitorConfig = {
  appId: 'app.lovable.744b93d1b5ba4b6b84e84219b1a2924b',
  appName: 'salon-project',
  webDir: 'dist',
  // Only use dev server URL when explicitly enabled for local development
  ...(USE_DEV_SERVER && {
    server: {
      url: 'https://744b93d1-b5ba-4b6b-84e8-4219b1a2924b.lovableproject.com?forceHideBadge=true',
      cleartext: true
    }
  }),
  plugins: {
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"]
    },
    StripeTerminal: {
      // Plugin configuration handled at runtime
    }
  }
};

export default config;
