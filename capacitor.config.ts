import type { CapacitorConfig } from '@capacitor/cli';

// The Android app is a native shell around the live site: it loads Primegram over HTTPS, so every web release
// reaches users instantly without a new APK. Only native changes (plugins, permissions) need a new install.
const config: CapacitorConfig = {
  appId: 'com.primegram.app',
  appName: 'Primegram',
  webDir: 'dist',
  server: {
    url: 'https://primegramx.co.ke',
    cleartext: false,
    androidScheme: 'https',
    allowNavigation: ['primegramx.co.ke', 'www.primegramx.co.ke', '*.supabase.co'],
  },
};

export default config;
