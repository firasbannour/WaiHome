// Mock pour react-native-wifi-reborn
class WifiManager {
  loadWifiList() {
    console.log('Mock: loadWifiList called');
    return Promise.resolve([
      {
        SSID: 'Mock WiFi',
        BSSID: '00:11:22:33:44:55',
        capabilities: 'WPA2',
        frequency: 2412,
        level: -50,
        timestamp: Date.now(),
      }
    ]);
  }
  
  // Added: reScanAndLoadWifiList used by MainPage
  async reScanAndLoadWifiList() {
    console.log('Mock: reScanAndLoadWifiList called');
    return this.loadWifiList();
  }
  
  connectToProtectedSSID(ssid?: string, password?: string) {
    console.log('Mock: connectToProtectedSSID called', ssid, password);
    return Promise.resolve(true);
  }
  
  disconnect() {
    console.log('Mock: disconnect called');
    return Promise.resolve(true);
  }
  
  getCurrentWifiSSID() {
    console.log('Mock: getCurrentWifiSSID called');
    return Promise.resolve('Mock WiFi');
  }
  
  isEnabled() {
    console.log('Mock: isEnabled called');
    return Promise.resolve(true);
  }
  
  setEnabled(enabled: boolean) {
    console.log('Mock: setEnabled called', enabled);
    return Promise.resolve(true);
  }
}

export default new WifiManager();
