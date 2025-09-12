// app/layout.tsx
// Load polyfills FIRST in _layout since expo-router might not load index.js polyfills in time
import '../polyfills';

import { Stack } from "expo-router";
import { NotificationProvider } from "../context/NotificationContext";
import { Amplify } from 'aws-amplify';
import awsconfig from '../src/aws-exports';

// Configure Amplify for expo-router
console.log('🔧 _layout.tsx: Configuring Amplify...');
console.log('🔍 _layout.tsx: Crypto check before Amplify config:');
console.log('- global.crypto:', !!global.crypto);
console.log('- global.crypto.getRandomValues:', !!global.crypto?.getRandomValues);
console.log('- global.getRandomBase64:', !!global.getRandomBase64);

console.log('📋 Amplify config:', awsconfig);
try {
  Amplify.configure(awsconfig);
  console.log('✅ Amplify configured successfully in _layout');
} catch (error) {
  console.error('❌ Amplify configuration failed:', error);
}

export default function RootLayout() {
  return (
    <NotificationProvider>
      <Stack
        screenOptions={{
          headerShown: false,
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="MainPage" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="signup" options={{ headerShown: false }} />
        <Stack.Screen name="confirmSignup" options={{ headerShown: false }} />
        <Stack.Screen name="forgotPassword" options={{ headerShown: false }} />
        <Stack.Screen name="profile" options={{ headerShown: false }} />
        <Stack.Screen name="SiteDetails" options={{ headerShown: false }} />
        <Stack.Screen name="AlertHistory" options={{ headerShown: false }} />
        <Stack.Screen name="NotificationHistory" options={{ headerShown: false }} />
        <Stack.Screen name="DetailsAuger" options={{ headerShown: false }} />
        <Stack.Screen name="DetailsHeater" options={{ headerShown: false }} />
        <Stack.Screen name="DetailsHighWater" options={{ headerShown: false }} />
        <Stack.Screen name="DetailsPump" options={{ headerShown: false }} />
      </Stack>
    </NotificationProvider>
  );
}
