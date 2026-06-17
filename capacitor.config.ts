import type { CapacitorConfig } from '@capacitor/cli';

const config = {
  appId: 'ie.bookd.salon',
  appName: 'Bookd',
  webDir: 'dist',
  packageClassList: [
    'AppPlugin',
    'CAPCameraPlugin',
    'GeolocationPlugin',
    'App.StripeTapToPayPlugin',
  ],
  plugins: {
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"]
    },
    StripeTerminal: {
      // Plugin configuration handled at runtime
    }
  }
} as CapacitorConfig & { packageClassList: string[] };

export default config;
