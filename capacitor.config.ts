/// <reference types="@capawesome/capacitor-live-update" />
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'fr.pixelmon_france.daem0ns.arntags',
  appName: 'Arntags',
  webDir: 'dist',
  ios: {
    contentInset: 'automatic'
  },
  plugins: {
    LiveUpdate: {
      appId: '890094d4-9547-4aa9-b990-d78ca350b960',
      defaultChannel: 'default',
      autoUpdateStrategy: 'background',
      readyTimeout: 10000,
    },
  },
};

export default config;
