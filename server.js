// Charger les variables d'environnement
require('dotenv').config();

// Supprimer les avertissements AWS SDK
process.env.AWS_SDK_JS_SUPPRESS_MAINTENANCE_MODE_MESSAGE = '1';

const express = require('express');
const cors = require('cors');
const { dbHelpers } = require('./config/dynamodb');

// NOUVEAU : Import MQTT standard (connexion mTLS vers AWS IoT)
const mqtt = require('mqtt');

// Configuration AWS IoT
const awsIotConfig = require('./aws-iot-config');

const app = express();
const PORT = process.env.PORT || 8080;

// NOUVEAU : Variables pour AWS IoT
let mqttConnection = null;
let isMqttConnected = false;

// NOUVEAU : Configuration AWS IoT
const AWS_IOT_CONFIG = {
  key: process.env.AWS_IOT_PRIVATE_KEY || awsIotConfig.certificates.privateKey,
  cert: process.env.AWS_IOT_CERTIFICATE || awsIotConfig.certificates.certificate,
  ca: process.env.AWS_IOT_ROOT_CA || awsIotConfig.certificates.rootCA,
  clientId: awsIotConfig.mqtt.clientId,
  endpoint: process.env.AWS_IOT_ENDPOINT || awsIotConfig.endpoint
};

// NOUVEAU : Fonction de connexion AWS IoT
const connectToAWSIoT = async () => {
  try {
    console.log('🔗 Tentative de connexion à AWS IoT...');
    console.log('📡 Endpoint:', AWS_IOT_CONFIG.endpoint);
    
    // Vérifier si on est en mode développement ou si l'endpoint n'est pas configuré
    if (process.env.NODE_ENV === 'development' && 
        !AWS_IOT_CONFIG.endpoint.includes('amazonaws.com')) {
      console.log(' Mode développement - connexion AWS IoT simulée');
      isMqttConnected = true;
      return;
    }
    
    // Vérifier si les certificats existent
    const fs = require('fs');
    if (!fs.existsSync(AWS_IOT_CONFIG.key) || !fs.existsSync(AWS_IOT_CONFIG.cert) || !fs.existsSync(AWS_IOT_CONFIG.ca)) {
      console.log('⚠️ Certificats AWS IoT non trouvés, utilisation du mode développement');
      isMqttConnected = true;
      return;
    }
    
    // Connexion réelle AWS IoT via MQTT standard (mTLS)
    const config = {
      key: fs.readFileSync(AWS_IOT_CONFIG.key),
      cert: fs.readFileSync(AWS_IOT_CONFIG.cert),
      ca: fs.readFileSync(AWS_IOT_CONFIG.ca),
      clientId: AWS_IOT_CONFIG.clientId,
      host: AWS_IOT_CONFIG.endpoint,
      port: 8883,
      protocol: 'mqtts',
      clean: true,
      keepalive: 30,
      reconnectPeriod: 5000,
      connectTimeout: 15000,
      rejectUnauthorized: true,
    };

    mqttConnection = mqtt.connect(config);

    mqttConnection.on('connect', () => {
      console.log('✅ Connecté à AWS IoT MQTT');
      isMqttConnected = true;
      subscribeToShellyTopics();
    });

    mqttConnection.on('message', (topic, message) => {
      handleMqttMessage(topic, message);
    });

    mqttConnection.on('error', (err) => {
      console.error('❌ Échec connexion MQTT:', err);
      isMqttConnected = false;
    });

    mqttConnection.on('close', () => {
      console.log('🔌 Connexion MQTT fermée');
      isMqttConnected = false;
    });
    
  } catch (error) {
    console.error('❌ Erreur connexion AWS IoT:', error);
    // En cas d'erreur, on continue sans MQTT
    isMqttConnected = false;
  }
};

// NOUVEAU : S'abonner aux topics Shelly
const subscribeToShellyTopics = async () => {
  if (!mqttConnection || !isMqttConnected) return;
  
  try {
    mqttConnection.subscribe('shelly/+/data', { qos: 1 }, (err) => {
      if (err) console.error('❌ Erreur abonnement shelly/+/data:', err);
    });
    mqttConnection.subscribe('shelly/+/status', { qos: 1 }, (err) => {
      if (err) console.error('❌ Erreur abonnement shelly/+/status:', err);
    });
    console.log('📡 Abonnés aux topics: shelly/+/data et shelly/+/status');
  } catch (error) {
    console.error('❌ Erreur abonnement topics:', error);
  }
};

// NOUVEAU : Gérer les messages MQTT reçus
const handleMqttMessage = async (topic, message) => {
  try {
    console.log(`📥 Message MQTT reçu sur ${topic}:`, message.toString());
    
    const data = JSON.parse(message.toString());
    
    if (topic.includes('/data')) {
      // Données Shelly reçues - mettre à jour DynamoDB
      await updateShellyDeviceRealTime(data);
    } else if (topic.includes('/status')) {
      // Statut Shelly reçu - log pour debug
      console.log(' Statut Shelly reçu:', data);
    }
    
  } catch (error) {
    console.error('❌ Erreur traitement message MQTT:', error);
  }
};

// NOUVEAU : Mettre à jour DynamoDB avec les données temps réel
const updateShellyDeviceRealTime = async (shellyData) => {
  try {
    const { deviceId, macAddress, siteId, components, power, timestamp } = shellyData;
    
    console.log('🔄 Mise à jour temps réel pour site:', siteId);
    
    // Recherche élargie : par siteId, deviceId, ou macAddress
    const allDevices = await dbHelpers.getAllShellyDevices();
    const device = allDevices.find(d => {
      const bySite = 
        d.siteId === siteId || 
        d.deviceInfo?.siteId === siteId ||
        d.siteName === siteId;
      
      const byDeviceId = 
        d.deviceId === deviceId ||
        d.deviceInfo?.deviceId === deviceId;
      
      const byMac = 
        d.macAddress && macAddress && 
        d.macAddress.toUpperCase() === String(macAddress).toUpperCase();
      
      return bySite || byDeviceId || byMac;
    });
    
    if (device) {
      // Mettre à jour avec les données temps réel
      const updates = {
        components: components || {},
        solids: power?.total || power || 0,
        lastUpdated: timestamp || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: 'Connected' // Shelly est connecté s'il envoie des données
      };
      
      await dbHelpers.updateShellyDevice(device.id, updates);
      console.log('✅ Appareil mis à jour en temps réel:', siteId);
      
    } else {
      console.log('⚠️ Appareil non trouvé pour site:', siteId);
      console.log('ℹ️ Tentative de création/upsert automatique...');
      
      try {
        // Créer un appareil minimal s'il n'existe pas
        const newDeviceData = {
          deviceId: deviceId || 'unknown',
          macAddress: macAddress || 'unknown',
          siteId: siteId,
          siteName: 'Home', // Nom par défaut
          status: 'Connected',
          components: components || {},
          solids: power?.total || power || 0,
          lastUpdated: timestamp || new Date().toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        
        // Utiliser le premier utilisateur disponible ou créer un utilisateur par défaut
        const allUsers = await dbHelpers.getAllUsers();
        const defaultUserId = allUsers.length > 0 ? allUsers[0].id : 'default-user';
        
        // Ajouter l'userId au deviceData
        newDeviceData.userId = defaultUserId;
        newDeviceData.id = deviceId || `device-${Date.now()}`; // Générer un ID unique
        
        await dbHelpers.createShellyDevice(newDeviceData);
        console.log('✅ Nouvel appareil créé automatiquement pour:', siteId);
        
      } catch (createError) {
        console.error('❌ Erreur création automatique appareil:', createError);
      }
    }
    
  } catch (error) {
    console.error('❌ Erreur mise à jour temps réel:', error);
  }
};

// NOUVEAU : Publier un message MQTT
const publishMqttMessage = async (topic, message) => {
  try {
    const payload = JSON.stringify(message);
    
    // En mode développement, simuler l'envoi seulement si pas de vrais certificats
    if (process.env.NODE_ENV === 'development' && 
        !AWS_IOT_CONFIG.endpoint.includes('amazonaws.com')) {
      console.log(`📡 [DEV] Message simulé sur ${topic}:`, payload);
      return true;
    }
    
    // Vérifier la connexion MQTT réelle
    if (!mqttConnection || !isMqttConnected) {
      console.log('⚠️ MQTT non connecté, message non envoyé');
      return false;
    }
    
    // Envoi réel MQTT standard
    await new Promise((resolve, reject) => {
      mqttConnection.publish(topic, payload, { qos: 1 }, (err) => {
        if (err) return reject(err);
        return resolve();
      });
    });
    console.log(`✅ Message publié sur ${topic}:`, payload);
    return true;
    
  } catch (error) {
    console.error('❌ Erreur publication MQTT:', error);
    return false;
  }
};

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    mqtt: isMqttConnected ? 'Connected' : 'Disconnected'
  });
});

// Test route
app.get('/test', (req, res) => {
  res.json({ message: 'Server working!', timestamp: new Date().toISOString() });
});

// API test
app.get('/api/test', (req, res) => {
  res.json({ message: 'API working!', timestamp: new Date().toISOString() });
});

// NOUVELLE ROUTE : Envoyer des commandes à Shelly via AWS IoT
app.post('/api/shelly/command/:siteId', async (req, res) => {
  try {
    const { siteId } = req.params;
    const { component, action, value } = req.body;
    
    console.log(`📤 Commande pour ${siteId}:`, { component, action, value });
    
    if (!component || !action) {
      return res.status(400).json({ 
        success: false, 
        error: 'component et action sont requis' 
      });
    }
    
    // Construire le message de commande
    const commandMessage = {
      component: component,
      action: action,
      value: value,
      timestamp: new Date().toISOString(),
      source: 'mobile-app',
      requestId: Date.now().toString()
    };
    
    // Publier la commande sur AWS IoT
    const commandTopic = `shelly/${siteId}/command`;
    const published = await publishMqttMessage(commandTopic, commandMessage);
    
    if (published) {
      console.log('✅ Commande publiée sur AWS IoT');
      
      // Mettre à jour DynamoDB avec le nouvel état
      try {
        const allDevices = await dbHelpers.getAllShellyDevices();
        const device = allDevices.find(d => 
          d.siteId === siteId || 
          d.deviceInfo?.siteId === siteId ||
          d.siteName === siteId ||
          d.id === siteId
        );
        
        if (device) {
          // Déterminer le nouvel état du composant
          let newComponentState = false;
          if (action === 'on' || action === 'true') {
            newComponentState = true;
          } else if (action === 'off' || action === 'false') {
            newComponentState = false;
          } else if (action === 'toggle') {
            // Inverser l'état actuel
            const currentState = device.components?.[component] || false;
            newComponentState = !currentState;
          }
          
          // Mettre à jour les composants
          const updatedComponents = {
            ...(device.components || {}),
            [component]: newComponentState
          };
          
          await dbHelpers.updateShellyDevice(device.id, {
            components: updatedComponents,
            lastUpdated: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
          
          console.log(`✅ État mis à jour dans DynamoDB: ${component} = ${newComponentState}`);
        }
      } catch (dbError) {
        console.log('⚠️ Erreur mise à jour DynamoDB:', dbError.message);
      }
      
      res.json({
        success: true,
        message: `Commande ${action} envoyée au composant ${component}`,
        data: commandMessage,
        mqtt: 'published',
        remote: true
      });
    } else {
      res.json({
        success: false,
        message: 'Commande enregistrée localement (MQTT non disponible)',
        data: commandMessage,
        mqtt: 'local'
      });
    }
    
  } catch (error) {
    console.error('❌ Erreur envoi commande:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// NOUVELLE ROUTE : Statut MQTT
app.get('/api/mqtt/status', (req, res) => {
  res.json({
    connected: isMqttConnected,
    endpoint: AWS_IOT_CONFIG.endpoint,
    clientId: AWS_IOT_CONFIG.clientId,
    timestamp: new Date().toISOString()
  });
});

// Shelly devices routes
app.get('/api/shelly/devices/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    console.log(`📥 GET /api/shelly/devices/${userId}`);
    
    const devices = await dbHelpers.getShellyDevicesByUserId(userId);
    
    res.json({
      success: true,
      data: devices
    });
  } catch (error) {
    console.error('❌ Erreur lors de la récupération des appareils:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Erreur lors de la récupération des appareils' 
    });
  }
});

app.post('/api/shelly/devices', async (req, res) => {
  try {
    const deviceInfo = req.body;
    console.log(`📥 POST /api/shelly/devices`, deviceInfo);
    console.log('🔍 Components reçus:', deviceInfo.components);
    
    // Extraire correctement l'ID utilisateur
    let userId;
    if (typeof deviceInfo.userId === 'object' && deviceInfo.userId.data) {
      userId = deviceInfo.userId.data;
    } else if (typeof deviceInfo.userId === 'string') {
      userId = deviceInfo.userId;
    } else {
      throw new Error('Format userId invalide');
    }
    
    // Construire un identifiant unique par (userId, deviceId, siteId)
    const incomingDeviceId = deviceInfo.deviceId || deviceInfo.deviceInfo?.deviceId || 'unknown';
    const incomingSiteId = deviceInfo.siteId || deviceInfo.deviceInfo?.siteId || 'unknown';
    // Fallback: si l'app envoie encore les valeurs par défaut, générer des IDs uniques
    const uniqueSuffix = Date.now().toString(36).slice(-6);
    const normalizedDeviceId = (incomingDeviceId === 'shelly-main-device')
      ? `shelly-${uniqueSuffix}`
      : incomingDeviceId;
    const normalizedSiteId = (incomingSiteId === 'main-site')
      ? `site-${uniqueSuffix}`
      : incomingSiteId;
    const stableId = `${userId}_${normalizedDeviceId}_${normalizedSiteId}`;
    
    console.log(' Identifiants reçus:');
    console.log(`   DeviceId (in): ${incomingDeviceId} -> (used): ${normalizedDeviceId}`);
    console.log(`   SiteId (in): ${incomingSiteId} -> (used): ${normalizedSiteId}`);
    console.log(`   ID composé: ${stableId}`);
    
    const deviceData = {
      id: stableId,
      userId: userId, // Utiliser l'ID extrait
      deviceId: normalizedDeviceId,
      siteId: normalizedSiteId,
      siteName: deviceInfo.siteName || deviceInfo.deviceInfo?.siteName || 'Unknown Site',
      macAddress: deviceInfo.macAddress || deviceInfo.deviceInfo?.macAddress || 'N/A',
      ipAddress: deviceInfo.ipAddress || deviceInfo.deviceInfo?.ipAddress || 'N/A',
      deviceName: deviceInfo.deviceName || deviceInfo.deviceInfo?.deviceName || 'Unknown Device',
      connectionType: deviceInfo.connectionType || deviceInfo.deviceInfo?.connectionType || 'UNKNOWN',
      lastConnected: deviceInfo.lastConnected || deviceInfo.deviceInfo?.lastConnected || new Date().toISOString(),
      status: deviceInfo.status || 'Not Connected',
      solids: deviceInfo.solids || 0,
      notificationsEnabled: deviceInfo.notificationsEnabled || false,
      // Composants (défauts + fusion des clés entrantes)
      components: {
        pump: false,
        auger: false,
        heater: false,
        highWaterAlarm: false,
        emergency: false,
        binReplaced: false,
        heaterStarted: false,
        ...(deviceInfo.components || {})
      },
      lastUpdated: deviceInfo.lastUpdated || new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    console.log('📤 Données à sauvegarder dans DynamoDB:', deviceData);
    console.log(' Components à sauvegarder:', deviceData.components);

    // Vérifier si l'appareil existe déjà
    const existingDevice = await dbHelpers.getShellyDeviceById(stableId);
    
    if (existingDevice) {
      // Mettre à jour l'appareil existant (inclure nom du site et identifiants utiles)
      console.log(' Mise à jour de l\'appareil existant:', stableId);
      const updatedDevice = await dbHelpers.updateShellyDevice(stableId, {
        // Champs dynamiques envoyés par l'app
        siteId: deviceData.siteId,
        siteName: deviceData.siteName,
        deviceId: deviceData.deviceId,
        deviceName: deviceData.deviceName,
        macAddress: deviceData.macAddress,
        ipAddress: deviceData.ipAddress,
        connectionType: deviceData.connectionType,
        lastConnected: deviceData.lastConnected,
        status: deviceData.status,
        solids: deviceData.solids,
        notificationsEnabled: deviceData.notificationsEnabled,
        // Composants: fusionner avec l'existant pour préserver les clés
        components: {
          ...(existingDevice.components || {}),
          ...(deviceData.components || {})
        },
        lastUpdated: deviceData.lastUpdated,
        updatedAt: deviceData.updatedAt
      });
      
      res.json({
        success: true,
        message: 'Shelly device updated successfully',
        data: updatedDevice
      });
    } else {
      // Créer un nouvel appareil
      console.log(' Création d\'un nouvel appareil:', stableId);
      await dbHelpers.createShellyDevice(deviceData);
      
      res.json({
        success: true,
        message: 'Shelly device created successfully',
        data: deviceData
      });
    }
  } catch (error) {
    console.error('❌ Erreur lors de la sauvegarde:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Mettre à jour les composants/attributs d'un appareil existant (sans créer un nouvel élément)
app.put('/api/shelly/devices/:id', async (req, res) => {
  try {
    const idParam = req.params.id;
    const body = req.body || {};

    // Chercher d'abord par id direct
    let existing = await dbHelpers.getShellyDeviceById(idParam);
    let targetId = idParam;

    // Si introuvable, tenter de reconstruire l'ID composé depuis le corps
    if (!existing) {
      const userId = (typeof body.userId === 'object' && body.userId?.data) ? body.userId.data : body.userId;
      const deviceId = body.deviceId || body.deviceInfo?.deviceId;
      const siteId = body.siteId || body.deviceInfo?.siteId;
      if (userId && deviceId && siteId) {
        targetId = `${userId}_${deviceId}_${siteId}`;
        existing = await dbHelpers.getShellyDeviceById(targetId);
      }
    }

    if (!existing) {
      // Fallback tolérant: tenter une mise à jour via le helper qui sait scanner par siteId/deviceId
      try {
        console.log('⚠️ Appareil introuvable par ID direct, tentative de mise à jour tolérante...', { idParam });
        const tolerantUpdated = await dbHelpers.updateShellyDevice(targetId, body);
        return res.json({ success: true, message: 'Update (tolerant) successful', data: tolerantUpdated });
      } catch (e) {
        return res.status(404).json({ success: false, error: 'Device not found for update' });
      }
    }

    // Fusion des composants
    const mergedComponents = {
      pump: false,
      auger: false,
      heater: false,
      highWaterAlarm: false,
      emergency: false,
      binReplaced: false,
      heaterStarted: false,
      ...(existing.components || {}),
      ...(body.components || {})
    };

    console.log('📤 Body reçu:', body);
    console.log('📤 notificationsEnabled dans body:', body.notificationsEnabled);
    console.log('📤 notificationsEnabled existant:', existing.notificationsEnabled);
    
    const payload = {
      // champs optionnels côté app
      siteName: body.siteName ?? existing.siteName,
      status: body.status ?? existing.status,
      ipAddress: body.ipAddress ?? existing.ipAddress,
      deviceName: body.deviceName ?? existing.deviceName,
      connectionType: body.connectionType ?? existing.connectionType,
      lastConnected: body.lastConnected ?? existing.lastConnected,
      notificationsEnabled: body.notificationsEnabled ?? existing.notificationsEnabled,
      components: mergedComponents,
      lastUpdated: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    console.log('📤 Payload final:', payload);
    console.log('📤 notificationsEnabled dans payload:', payload.notificationsEnabled);

    const updated = await dbHelpers.updateShellyDevice(targetId, payload);

    return res.json({ success: true, message: 'Update successful', data: updated });
  } catch (error) {
    console.error('❌ Erreur lors de la mise à jour:', error);
    return res.status(500).json({ success: false, error: 'Erreur lors de la mise à jour' });
  }
});

// Route DELETE pour supprimer un appareil Shelly
app.delete('/api/shelly/devices/:deviceId', async (req, res) => {
  try {
    const { deviceId } = req.params;
    console.log(`🗑️ DELETE /api/shelly/devices/${deviceId}`);

    // Récupérer tous les appareils et faire une recherche tolérante
    const allDevices = await dbHelpers.getAllShellyDevices();
    const deviceToDelete = allDevices.find((device) =>
      device.id === deviceId ||
      device.deviceId === deviceId ||
      device.siteId === deviceId ||
      device.macAddress === deviceId ||
      device.ipAddress === deviceId
    );

    if (!deviceToDelete) {
      console.log(`⚠️ Appareil/identifiant ${deviceId} non trouvé — suppression idempotente`);
      // Idempotent: on répond succès même si déjà supprimé ou introuvable
      return res.json({ success: true, message: 'No device to delete' });
    }

    console.log(`🗑️ Suppression de l'appareil avec id: ${deviceToDelete.id}`);
    await dbHelpers.deleteShellyDevice(deviceToDelete.id);

    res.json({ success: true, message: 'Shelly device deleted successfully' });
  } catch (error) {
    console.error('❌ Erreur lors de la suppression:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Erreur lors de la suppression de l\'appareil' 
    });
  }
});

// NOUVELLES ROUTES POUR LES ÉTATS DES COMPOSANTS

// Sauvegarder l'état d'un composant
app.post('/api/shelly/component-state', async (req, res) => {
  try {
    const { siteId, userId, componentType, state, timestamp, deviceId } = req.body;
    console.log(`📥 POST /api/shelly/component-state`, { siteId, userId, componentType, state });
    
    if (!siteId || !userId || !componentType || state === undefined) {
      return res.status(400).json({ 
        error: 'siteId, userId, componentType et state sont requis' 
      });
    }

    // Créer un ID unique et stable pour ce composant sur ce site
    const componentId = `${siteId}_${componentType}`;
    
    // Vérifier si l'état existe déjà
    let existingState = null;
    try {
      existingState = await dbHelpers.getComponentStateById(componentId);
    } catch (error) {
      // L'état n'existe pas encore, c'est normal
      console.log(`ℹ️ Nouvel état pour ${componentType} sur le site ${siteId}`);
    }

    const componentData = {
      componentId: componentId, // ID unique et stable
      siteId,
      userId,
      componentType,
      state: Boolean(state),
      timestamp: timestamp || new Date().toISOString(),
      deviceId: deviceId || `${siteId}_${componentType}`,
      lastUpdated: new Date().toISOString()
    };

    let result;
    if (existingState) {
      // Mettre à jour l'état existant
      console.log(`🔄 Mise à jour de l'état existant pour ${componentType}`);
      result = await dbHelpers.updateComponentState(componentId, {
        state: Boolean(state),
        timestamp: timestamp || new Date().toISOString(),
        lastUpdated: new Date().toISOString()
      });
    } else {
      // Créer un nouvel état
      console.log(`➕ Création d'un nouvel état pour ${componentType}`);
      await dbHelpers.saveComponentState(componentData);
      result = componentData;
    }
    
    res.status(200).json({
      success: true,
              message: existingState ? 'Component state updated successfully' : 'Component state created successfully',
      data: result,
      isUpdate: !!existingState
    });
  } catch (error) {
    console.error('Erreur lors de la sauvegarde de l\'état du composant:', error);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// Récupérer les états des composants d'un site
app.get('/api/shelly/component-states/:siteId', async (req, res) => {
  try {
    const { siteId } = req.params;
    const { userId } = req.query;
    console.log(`📥 GET /api/shelly/component-states/${siteId}`, { userId });
    
    if (!userId) {
      return res.status(400).json({ error: 'userId est requis' });
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
app.put('/api/shelly/component-state/:componentId', async (req, res) => {
  try {
    const { componentId } = req.params;
    const updates = req.body;
    console.log(`📥 PUT /api/shelly/component-state/${componentId}`, updates);
    
    // Vérifier que l'état du composant existe
    const component = await dbHelpers.getComponentStateById(componentId);
    if (!component) {
      return res.status(404).json({ error: 'État du composant non trouvé' });
    }
    
    updates.lastUpdated = new Date().toISOString();
    const updatedComponent = await dbHelpers.updateComponentState(componentId, updates);
    
    res.json({
      success: true,
      message: 'Component state updated successfully',
      data: updatedComponent
    });
  } catch (error) {
    console.error('Erreur lors de la mise à jour de l\'état du composant:', error);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// Récupérer l'historique des états d'un composant
app.get('/api/shelly/component-history/:siteId/:componentType', async (req, res) => {
  try {
    const { siteId, componentType } = req.params;
    const { userId, limit = 50 } = req.query;
    console.log(`📥 GET /api/shelly/component-history/${siteId}/${componentType}`, { userId, limit });
    
    if (!userId) {
      return res.status(400).json({ error: 'userId est requis' });
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
app.delete('/api/shelly/component-state/:componentId', async (req, res) => {
  try {
    const { componentId } = req.params;
    console.log(`🗑️ DELETE /api/shelly/component-state/${componentId}`);
    
    // Vérifier que l'état du composant existe
    const component = await dbHelpers.getComponentStateById(componentId);
    if (!component) {
      return res.status(404).json({ error: 'État du composant non trouvé' });
    }
    
    await dbHelpers.deleteComponentState(componentId);
    
    res.json({
      success: true,
      message: 'Component state deleted successfully'
    });
  } catch (error) {
    console.error('Erreur lors de la suppression de l\'état du composant:', error);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ 
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Gestionnaire d'erreurs global pour les erreurs non gérées
process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err);
  // Ne pas arrêter le processus
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  // Ne pas arrêter le processus
});

// Démarrer le serveur
app.listen(PORT, '0.0.0.0', async () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`✅ Server accessible at: http://192.168.100.193:${PORT}`);
  console.log(`✅ Health check: http://192.168.100.193:${PORT}/health`);
  console.log(`✅ MQTT status: http://192.168.100.193:${PORT}/api/mqtt/status`);
  console.log(`✅ Shelly devices: http://192.168.100.193:${PORT}/api/shelly/devices/:userId`);
  console.log(`✅ Component states: http://192.168.100.193:${PORT}/api/shelly/component-states/:siteId`);
  console.log(`✅ Component history: http://192.168.100.193:${PORT}/api/shelly/component-history/:siteId/:componentType`);
  console.log(`✅ Shelly commands: http://192.168.100.193:${PORT}/api/shelly/command/:siteId`);
  console.log(`🔗 Connecté à AWS DynamoDB - Région: ${process.env.AWS_REGION || 'eu-north-1'}`);
  
  // NOUVEAU : Connecter à AWS IoT après démarrage du serveur
  await connectToAWSIoT();
});

module.exports = app;