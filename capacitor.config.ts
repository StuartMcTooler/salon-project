import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.744b93d1b5ba4b6b84e84219b1a2924b',
  appName: 'salon-project',
  webDir: 'dist',
  server: {
    // For development - hot reload from sandbox
    url: 'https://744b93d1-b5ba-4b6b-84e8-4219b1a2924b.lovableproject.com?forceHideBadge=true',
    cleartext: true
  },
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
