import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.stuartmcmullen.salonproject',
  appName: 'Bookd',
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
