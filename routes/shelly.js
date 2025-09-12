const express = require('express');
const router = express.Router();
const { authenticateToken, requireUserOrAdmin } = require('../middleware/auth');
const { dbHelpers } = require('../config/dynamodb');

// Créer un nouvel appareil Shelly
router.post('/devices', authenticateToken, async (req, res) => {
  try {
    const { userId, deviceInfo } = req.body;
    
    if (!userId || !deviceInfo) {
      return res.status(400).json({ error: 'userId et deviceInfo sont requis' });
    }

    const deviceData = {
      id: `${userId}_${deviceInfo.deviceId}_${Date.now()}`,
      userId,
      deviceId: deviceInfo.deviceId,
      siteId: deviceInfo.siteId,
      siteName: deviceInfo.siteName,
      macAddress: deviceInfo.macAddress,
      ipAddress: deviceInfo.ipAddress,
      deviceName: deviceInfo.deviceName,
      connectionType: deviceInfo.connectionType,
      lastConnected: deviceInfo.lastConnected,
      rssi: deviceInfo.rssi,
      localName: deviceInfo.localName,
      components: deviceInfo.components || {}, // Inclure les composants détaillés
      status: deviceInfo.status || 'Connected',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await dbHelpers.createShellyDevice(deviceData);
    
    res.status(201).json({
      success: true,
      message: 'Appareil Shelly créé avec succès',
      data: deviceData
    });
  } catch (error) {
    console.error('Erreur lors de la création de l\'appareil Shelly:', error);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// Récupérer tous les appareils Shelly d'un utilisateur
router.get('/devices/:userId', authenticateToken, requireUserOrAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    
    const devices = await dbHelpers.getShellyDevicesByUserId(userId);
    
    res.json({
      success: true,
      data: devices
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des appareils Shelly:', error);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// Mettre à jour un appareil Shelly
router.put('/devices/:deviceId', authenticateToken, async (req, res) => {
  try {
    const { deviceId } = req.params;
    const updates = req.body;
    
    // Vérifier que l'utilisateur est propriétaire de l'appareil
    const device = await dbHelpers.getShellyDeviceById(deviceId);
    if (!device) {
      return res.status(404).json({ error: 'Appareil non trouvé' });
    }
    
    if (device.userId !== req.user.id && !req.user.isAdmin) {
      return res.status(403).json({ error: 'Accès non autorisé' });
    }
    
    updates.updatedAt = new Date().toISOString();
    const updatedDevice = await dbHelpers.updateShellyDevice(deviceId, updates);
    
    res.json({
      success: true,
      message: 'Appareil Shelly mis à jour avec succès',
      data: updatedDevice
    });
  } catch (error) {
    console.error('Erreur lors de la mise à jour de l\'appareil Shelly:', error);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// Supprimer un appareil Shelly
router.delete('/devices/:deviceId', authenticateToken, async (req, res) => {
  try {
    const { deviceId } = req.params;
    
    // Vérifier que l'utilisateur est propriétaire de l'appareil
    const device = await dbHelpers.getShellyDeviceById(deviceId);
    if (!device) {
      return res.status(404).json({ error: 'Appareil non trouvé' });
    }
    
    if (device.userId !== req.user.id && !req.user.isAdmin) {
      return res.status(403).json({ error: 'Accès non autorisé' });
    }
    
    await dbHelpers.deleteShellyDevice(deviceId);
    
    res.json({
      success: true,
      message: 'Appareil Shelly supprimé avec succès'
    });
  } catch (error) {
    console.error('Erreur lors de la suppression de l\'appareil Shelly:', error);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// Récupérer les statistiques des appareils Shelly
router.get('/stats/:userId', authenticateToken, requireUserOrAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    
    const devices = await dbHelpers.getShellyDevicesByUserId(userId);
    
    const stats = {
      totalDevices: devices.length,
      connectedDevices: devices.filter(d => d.lastConnected && 
        new Date(d.lastConnected) > new Date(Date.now() - 24 * 60 * 60 * 1000)).length,
      bleDevices: devices.filter(d => d.connectionType === 'BLE').length,
      wifiDevices: devices.filter(d => d.connectionType === 'WIFI').length,
      lastActivity: devices.length > 0 ? 
        Math.max(...devices.map(d => new Date(d.lastConnected).getTime())) : null
    };
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des statistiques:', error);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// NOUVELLES ROUTES POUR LES ÉTATS DES COMPOSANTS

// Sauvegarder l'état d'un composant
router.post('/component-state', authenticateToken, async (req, res) => {
  try {
    const { siteId, userId, componentType, state, timestamp, deviceId } = req.body;
    
    if (!siteId || !userId || !componentType || state === undefined) {
      return res.status(400).json({ 
        error: 'siteId, userId, componentType et state sont requis' 
      });
    }

    // Vérifier que l'utilisateur est propriétaire du site
    const site = await dbHelpers.getSitesByUserId(userId);
    const userSite = site.find(s => s.siteId === siteId);
    
    if (!userSite && !req.user.isAdmin) {
      return res.status(403).json({ error: 'Accès non autorisé à ce site' });
    }

    const componentData = {
      componentId: `${siteId}_${componentType}_${Date.now()}`,
      siteId,
      userId,
      componentType,
      state: Boolean(state),
      timestamp: timestamp || new Date().toISOString(),
      deviceId: deviceId || `${siteId}_${componentType}`,
      lastUpdated: new Date().toISOString()
    };

    // Sauvegarder dans DynamoDB
    await dbHelpers.saveComponentState(componentData);
    
    res.status(201).json({
      success: true,
      message: 'État du composant sauvegardé avec succès',
      data: componentData
    });
  } catch (error) {
    console.error('Erreur lors de la sauvegarde de l\'état du composant:', error);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// Récupérer les états des composants d'un site
router.get('/component-states/:siteId', authenticateToken, async (req, res) => {
  try {
    const { siteId } = req.params;
    const { userId } = req.query;
    
    if (!userId) {
      return res.status(400).json({ error: 'userId est requis' });
    }

    // Vérifier que l'utilisateur est propriétaire du site
    const site = await dbHelpers.getSitesByUserId(userId);
    const userSite = site.find(s => s.siteId === siteId);
    
    if (!userSite && !req.user.isAdmin) {
      return res.status(403).json({ error: 'Accès non autorisé à ce site' });
    }

    const componentStates = await dbHelpers.getComponentStatesBySite(siteId);
    
    // Grouper par type de composant et prendre le plus récent
    const latestStates = {};
    componentStates.forEach(state => {
      if (!latestStates[state.componentType] || 
          new Date(state.timestamp) > new Date(latestStates[state.componentType].timestamp)) {
        latestStates[state.componentType] = state;
      }
    });
    
    res.json({
      success: true,
      data: latestStates
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des états des composants:', error);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// Mettre à jour l'état d'un composant
router.put('/component-state/:componentId', authenticateToken, async (req, res) => {
  try {
    const { componentId } = req.params;
    const updates = req.body;
    
    // Vérifier que l'utilisateur est propriétaire du composant
    const component = await dbHelpers.getComponentStateById(componentId);
    if (!component) {
      return res.status(404).json({ error: 'État du composant non trouvé' });
    }
    
    if (component.userId !== req.user.id && !req.user.isAdmin) {
      return res.status(403).json({ error: 'Accès non autorisé' });
    }
    
    updates.lastUpdated = new Date().toISOString();
    const updatedComponent = await dbHelpers.updateComponentState(componentId, updates);
    
    res.json({
      success: true,
      message: 'État du composant mis à jour avec succès',
      data: updatedComponent
    });
  } catch (error) {
    console.error('Erreur lors de la mise à jour de l\'état du composant:', error);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// Récupérer l'historique des états d'un composant
router.get('/component-history/:siteId/:componentType', authenticateToken, async (req, res) => {
  try {
    const { siteId, componentType } = req.params;
    const { userId, limit = 50 } = req.query;
    
    if (!userId) {
      return res.status(400).json({ error: 'userId est requis' });
    }

    // Vérifier que l'utilisateur est propriétaire du site
    const site = await dbHelpers.getSitesByUserId(userId);
    const userSite = site.find(s => s.siteId === siteId);
    
    if (!userSite && !req.user.isAdmin) {
      return res.status(403).json({ error: 'Accès non autorisé à ce site' });
    }

    const history = await dbHelpers.getComponentStateHistory(siteId, componentType, parseInt(limit));
    
    res.json({
      success: true,
      data: history
    });
  } catch (error) {
    console.error('Erreur lors de la récupération de l\'historique:', error);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// Supprimer l'état d'un composant
router.delete('/component-state/:componentId', authenticateToken, async (req, res) => {
  try {
    const { componentId } = req.params;
    
    // Vérifier que l'utilisateur est propriétaire du composant
    const component = await dbHelpers.getComponentStateById(componentId);
    if (!component) {
      return res.status(404).json({ error: 'État du composant non trouvé' });
    }
    
    if (component.userId !== req.user.id && !req.user.isAdmin) {
      return res.status(403).json({ error: 'Accès non autorisé' });
    }
    
    await dbHelpers.deleteComponentState(componentId);
    
    res.json({
      success: true,
      message: 'État du composant supprimé avec succès'
    });
  } catch (error) {
    console.error('Erreur lors de la suppression de l\'état du composant:', error);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// NOUVEAU : Endpoint pour publier des commandes MQTT vers Shelly
router.post('/mqtt/publish', authenticateToken, async (req, res) => {
  try {
    const { topic, message } = req.body;
    
    if (!topic || !message) {
      return res.status(400).json({ error: 'topic et message sont requis' });
    }

    // Vérifier que l'utilisateur est connecté
    if (!req.user || !req.user.id) {
      return res.status(401).json({ error: 'Utilisateur non authentifié' });
    }

    console.log('📤 Publication MQTT:', { topic, message, userId: req.user.id });

    // Publier le message MQTT via AWS IoT
    const mqttClient = req.app.get('mqttClient');
    if (!mqttClient) {
      return res.status(500).json({ error: 'Client MQTT non disponible' });
    }

    // Publier le message
    await mqttClient.publish(topic, JSON.stringify(message), { qos: 1 });

    console.log('✅ Message MQTT publié avec succès sur', topic);

    res.json({
      success: true,
      message: 'Commande MQTT envoyée avec succès',
      data: { topic, message }
    });

  } catch (error) {
    console.error('❌ Erreur publication MQTT:', error);
    res.status(500).json({ error: 'Erreur lors de l\'envoi de la commande MQTT' });
  }
});

module.exports = router; 