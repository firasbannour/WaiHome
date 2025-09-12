// Script de test pour vérifier la synchronisation des états avec AWS DynamoDB
const { ShellyService } = require('./services/shellyService');
const { AuthService } = require('./services/authService');

async function testAWSSync() {
  try {
    console.log('🧪 Test de synchronisation AWS...');
    
    // Récupérer l'utilisateur actuel
    const currentUserId = await AuthService.getCurrentUserId();
    if (!currentUserId) {
      console.log('❌ Utilisateur non connecté');
      return;
    }
    
    console.log('👤 Utilisateur connecté:', currentUserId);
    
    // Récupérer tous les appareils de l'utilisateur
    const result = await ShellyService.getUserShellyDevices(currentUserId);
    
    if (result.success && result.data) {
      const devices = result.data.data || result.data;
      console.log(`📱 ${devices.length} appareils trouvés dans AWS`);
      
      devices.forEach((device, index) => {
        console.log(`\n📋 Appareil ${index + 1}:`);
        console.log(`   Site: ${device.siteName}`);
        console.log(`   Device ID: ${device.deviceId}`);
        console.log(`   IP: ${device.ipAddress}`);
        console.log(`   Status: ${device.status}`);
        
        if (device.components) {
          console.log('   🔧 Composants:');
          console.log(`     Pump: ${device.components.pump ? 'ON' : 'OFF'}`);
          console.log(`     Auger: ${device.components.auger ? 'ON' : 'OFF'}`);
          console.log(`     Heater: ${device.components.heater ? 'ON' : 'OFF'}`);
          console.log(`     High Water Alarm: ${device.components.highWaterAlarm ? 'ON' : 'OFF'}`);
          console.log(`     Emergency: ${device.components.emergency ? 'ON' : 'OFF'}`);
          console.log(`     Bin Replaced: ${device.components.binReplaced ? 'YES' : 'NO'}`);
          console.log(`     Heater Started: ${device.components.heaterStarted ? 'YES' : 'NO'}`);
        } else {
          console.log('   ⚠️ Aucun composant trouvé');
        }
        
        console.log(`   📅 Dernière mise à jour: ${device.lastUpdated}`);
      });
      
    } else {
      console.log('❌ Erreur lors de la récupération des appareils:', result.error);
    }
    
  } catch (error) {
    console.error('❌ Erreur lors du test:', error);
  }
}

// Exécuter le test
testAWSSync();

