import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.trinity.school',
  appName: 'Trinity School Online',
  webDir: 'www',
  
  // Point to production URL - Android app loads the web app from here
  server: {
    url: 'https://trinityfamilyschool.vercel.app',
    cleartext: false,
    androidScheme: 'https'
  },
  
  // Plugin configurations
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert']
    },
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#000000',
      showSpinner: true,
      androidSpinnerStyle: 'large',
      spinnerColor: '#ffffff'
    }
  },
  
  // Android specific configuration
  android: {
    allowMixedContent: true, // Allow loading Firebase and other resources
    captureInput: true,
    webContentsDebuggingEnabled: true // Enable debugging to see errors
  }
};

export default config;
