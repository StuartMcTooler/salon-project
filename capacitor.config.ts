import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.744b93d1b5ba4b6b84e84219b1a2924b',
  appName: 'salon-project',
  webDir: 'dist',
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
