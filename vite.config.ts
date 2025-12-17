import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

const capacitorNativeExternals = [
  '@capacitor-community/stripe-terminal'
];

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    // Handle native-only Capacitor plugins that don't exist during web builds
    {
      name: 'capacitor-native-externals',
      resolveId(id: string) {
        if (capacitorNativeExternals.includes(id)) {
          return { id, external: true };
        }
        return null;
      },
      load(id: string) {
        if (capacitorNativeExternals.includes(id)) {
          // Return empty module for native-only packages
          return 'export default {}; export const StripeTerminal = {}; export const TerminalConnectTypes = {};';
        }
        return null;
      },
    },
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  define: {
    __BUILD_TIMESTAMP__: JSON.stringify(new Date().toISOString()),
  },
  build: {
    rollupOptions: {
      external: capacitorNativeExternals,
    },
  },
}));
