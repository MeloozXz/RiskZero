import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'io.riskzero.app',
  appName: 'RiskZero',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  },
  plugins: {
    PrivacyScreen: {
      enable: true
    }
  }
};

export default config;
