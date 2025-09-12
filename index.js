// 🔴 Load comprehensive polyfills absolutely first
import './polyfills';

console.log('🚀 Index.js: Polyfills loaded, now loading expo-router...');

// For expo-router, just load the entry point - Amplify config goes in _layout
import 'expo-router/entry';
