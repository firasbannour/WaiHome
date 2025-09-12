// Charger les variables d'environnement
require('dotenv').config();

const AWS = require('aws-sdk');

// Configuration AWS - Utiliser la même que dynamodb.js
AWS.config.update({
  region: process.env.AWS_REGION || 'eu-north-1',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
});

const dynamodb = new AWS.DynamoDB.DocumentClient();

async function cleanupDuplicates() {
  try {
    console.log('🧹 Nettoyage des doublons dans DynamoDB...');
    
    // Récupérer tous les appareils
    const params = {
      TableName: 'WaiHomeShellyDevices'
    };
    
    const result = await dynamodb.scan(params).promise();
    const devices = result.Items;
    
    console.log(`📋 Total d'appareils trouvés: ${devices.length}`);
    
    // Grouper par siteName pour identifier les doublons
    const sitesMap = new Map();
    
    devices.forEach(device => {
      const siteName = device.siteName || 'Unknown';
      if (!sitesMap.has(siteName)) {
        sitesMap.set(siteName, []);
      }
      sitesMap.get(siteName).push(device);
    });
    
    // Identifier et supprimer les doublons
    let totalDeleted = 0;
    
    for (const [siteName, siteDevices] of sitesMap) {
      if (siteDevices.length > 1) {
        console.log(`🔍 Site "${siteName}" a ${siteDevices.length} appareils:`);
        
        // Garder le plus récent (updatedAt le plus récent)
        siteDevices.sort((a, b) => {
          const dateA = new Date(a.updatedAt || a.createdAt || 0);
          const dateB = new Date(b.updatedAt || b.createdAt || 0);
          return dateB - dateA;
        });
        
        const keepDevice = siteDevices[0];
        const deleteDevices = siteDevices.slice(1);
        
        console.log(`✅ Garder: ${keepDevice.id} (${keepDevice.updatedAt || keepDevice.createdAt})`);
        
        // Supprimer les doublons
        for (const deviceToDelete of deleteDevices) {
          console.log(`🗑️ Supprimer: ${deviceToDelete.id} (${deviceToDelete.updatedAt || deviceToDelete.createdAt})`);
          
          try {
            await dynamodb.delete({
              TableName: 'WaiHomeShellyDevices',
              Key: { id: deviceToDelete.id }
            }).promise();
            
            totalDeleted++;
            console.log(`✅ Supprimé: ${deviceToDelete.id}`);
          } catch (error) {
            console.error(`❌ Erreur suppression ${deviceToDelete.id}:`, error.message);
          }
        }
      }
    }
    
    console.log(`🎉 Nettoyage terminé! ${totalDeleted} doublons supprimés.`);
    
  } catch (error) {
    console.error('❌ Erreur lors du nettoyage:', error);
  }
}

// Exécuter le nettoyage
cleanupDuplicates();
