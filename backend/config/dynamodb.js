// Charger les variables d'environnement
require('dotenv').config();

const AWS = require('aws-sdk');

// Configuration AWS - Utiliser les vraies credentials
AWS.config.update({
  region: process.env.AWS_REGION || 'eu-north-1',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
});

// Table names
const TABLES = {
  USERS: 'waihome-users',
  SITES: 'waihome-sites',
  SHELLY_DATA: 'waihome-shelly-data',
  ADMIN_LOGS: 'waihome-admin-logs',
  SHELLY_DEVICES: 'WaiHomeShellyDevices' // Ajout de la table manquante
};

// DynamoDB instance
const dynamodb = new AWS.DynamoDB.DocumentClient();
const dynamodbAdmin = new AWS.DynamoDB();

// Fonction pour créer automatiquement toutes les tables nécessaires
const ensureAllTables = async () => {
  try {
    console.log('🔍 Vérification et création de toutes les tables nécessaires...');
    
    // Configuration des tables
    const tablesConfig = [
      {
        name: TABLES.USERS,
        keySchema: [{ AttributeName: 'userId', KeyType: 'HASH' }],
        attributeDefinitions: [{ AttributeName: 'userId', AttributeType: 'S' }]
      },
      {
        name: TABLES.SITES,
        keySchema: [{ AttributeName: 'siteId', KeyType: 'HASH' }],
        attributeDefinitions: [{ AttributeName: 'siteId', AttributeType: 'S' }]
      },
      {
        name: TABLES.SHELLY_DEVICES,
        keySchema: [{ AttributeName: 'id', KeyType: 'HASH' }],
        attributeDefinitions: [{ AttributeName: 'id', AttributeType: 'S' }]
      },
      {
        name: TABLES.SHELLY_DATA,
        keySchema: [{ AttributeName: 'id', KeyType: 'HASH' }],
        attributeDefinitions: [{ AttributeName: 'id', AttributeType: 'S' }]
      },
      {
        name: TABLES.ADMIN_LOGS,
        keySchema: [{ AttributeName: 'id', KeyType: 'HASH' }],
        attributeDefinitions: [{ AttributeName: 'id', AttributeType: 'S' }]
      }
    ];
    
    // Créer chaque table si elle n'existe pas
    for (const tableConfig of tablesConfig) {
      try {
        console.log(`🔍 Vérification de la table ${tableConfig.name}...`);
        
        // Vérifier si la table existe
        await dynamodbAdmin.describeTable({ TableName: tableConfig.name }).promise();
        console.log(`✅ Table ${tableConfig.name} existe déjà`);
        
      } catch (error) {
        if (error.code === 'ResourceNotFoundException') {
          console.log(`📋 Table ${tableConfig.name} non trouvée - création en cours...`);
          
          const tableParams = {
            TableName: tableConfig.name,
            KeySchema: tableConfig.keySchema,
            AttributeDefinitions: tableConfig.attributeDefinitions,
            ProvisionedThroughput: {
              ReadCapacityUnits: 5,
              WriteCapacityUnits: 5
            }
          };
          
          // Créer la table
          await dynamodbAdmin.createTable(tableParams).promise();
          
          // Attendre que la table soit active
          console.log(`⏳ Attente de l'activation de la table ${tableConfig.name}...`);
          await dynamodbAdmin.waitFor('tableExists', { TableName: tableConfig.name }).promise();
          
          console.log(`✅ Table ${tableConfig.name} créée avec succès !`);
          
        } else {
          console.error(`❌ Erreur lors de la vérification de ${tableConfig.name}:`, error);
        }
      }
    }
    
    console.log('✅ Toutes les tables sont prêtes !');
    
  } catch (error) {
    console.error('❌ Erreur lors de la création des tables:', error);
    // Ne pas bloquer l'application si la création échoue
  }
};

// Helper functions for DynamoDB operations
const dbHelpers = {
  // Create user
  async createUser(userData) {
    const params = {
      TableName: TABLES.USERS,
      Item: {
        userId: userData.userId,
        email: userData.email,
        name: userData.name,
        role: userData.role || 'user',
        password: userData.password,
        createdAt: new Date().toISOString(),
        lastLogin: new Date().toISOString()
      }
    };
    
    return await dynamodb.put(params).promise();
  },

  // Get user by ID
  async getUserById(userId) {
    const params = {
      TableName: TABLES.USERS,
      Key: { userId }
    };
    
    const result = await dynamodb.get(params).promise();
    return result.Item;
  },

  // Get user by email
  async getUserByEmail(email) {
    const params = {
      TableName: TABLES.USERS,
      IndexName: 'email-index',
      KeyConditionExpression: 'email = :email',
      ExpressionAttributeValues: {
        ':email': email
      }
    };
    
    const result = await dynamodb.query(params).promise();
    return result.Items[0];
  },

  // Create site
  async createSite(siteData) {
    const params = {
      TableName: TABLES.SITES,
      Item: {
        siteId: siteData.siteId,
        userId: siteData.userId,
        siteName: siteData.siteName,
        siteType: siteData.siteType,
        status: siteData.status || 'disconnected',
        solidsLevel: siteData.solidsLevel || 0,
        notificationsEnabled: siteData.notificationsEnabled || false,
        createdAt: new Date().toISOString(),
        lastUpdate: new Date().toISOString()
      }
    };
    
    return await dynamodb.put(params).promise();
  },

  // Get sites by user ID
  async getSitesByUserId(userId) {
    const params = {
      TableName: TABLES.SITES,
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': userId
      }
    };
    
    const result = await dynamodb.query(params).promise();
    return result.Items;
  },

  // Update site
  async updateSite(siteId, userId, updates) {
    const updateExpression = [];
    const expressionAttributeNames = {};
    const expressionAttributeValues = {};
    
    Object.keys(updates).forEach(key => {
      updateExpression.push(`#${key} = :${key}`);
      expressionAttributeNames[`#${key}`] = key;
      expressionAttributeValues[`:${key}`] = updates[key];
    });
    
    updateExpression.push('#lastUpdate = :lastUpdate');
    expressionAttributeValues[':lastUpdate'] = new Date().toISOString();
    
    const params = {
      TableName: TABLES.SITES,
      Key: { siteId, userId },
      UpdateExpression: `SET ${updateExpression.join(', ')}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: 'ALL_NEW'
    };
    
    return await dynamodb.update(params).promise();
  },

  // Save Shelly data
  async saveShellyData(data) {
    const params = {
      TableName: TABLES.SHELLY_DATA,
      Item: {
        dataId: data.dataId,
        siteId: data.siteId,
        deviceId: data.deviceId,
        sensorType: data.sensorType,
        value: data.value,
        timestamp: new Date().toISOString()
      }
    };
    
    return await dynamodb.put(params).promise();
  },

  // Get Shelly data by site
  async getShellyDataBySite(siteId, limit = 100) {
    const params = {
      TableName: TABLES.SHELLY_DATA,
      KeyConditionExpression: 'siteId = :siteId',
      ExpressionAttributeValues: {
        ':siteId': siteId
      },
      ScanIndexForward: false, // Most recent first
      Limit: limit
    };
    
    const result = await dynamodb.query(params).promise();
    return result.Items;
  },

  // Get all users (admin only)
  async getAllUsers() {
    const params = {
      TableName: TABLES.USERS
    };
    
    const result = await dynamodb.scan(params).promise();
    return result.Items;
  },

  // Get all sites (admin only)
  async getAllSites() {
    const params = {
      TableName: TABLES.SITES
    };
    
    const result = await dynamodb.scan(params).promise();
    return result.Items;
  },

  // Update user
  async updateUser(userId, updates) {
    const updateExpression = [];
    const expressionAttributeNames = {};
    const expressionAttributeValues = {};
    
    Object.keys(updates).forEach(key => {
      updateExpression.push(`#${key} = :${key}`);
      expressionAttributeNames[`#${key}`] = key;
      expressionAttributeValues[`:${key}`] = updates[key];
    });
    
    const params = {
      TableName: TABLES.USERS,
      Key: { userId },
      UpdateExpression: `SET ${updateExpression.join(', ')}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: 'ALL_NEW'
    };
    
    return await dynamodb.update(params).promise();
  },

  // Delete user
  async deleteUser(userId) {
    const params = {
      TableName: TABLES.USERS,
      Key: { userId }
    };
    
    return await dynamodb.delete(params).promise();
  },

  // Delete site
  async deleteSite(siteId, userId) {
    const params = {
      TableName: TABLES.SITES,
      Key: { siteId, userId }
    };
    
    return await dynamodb.delete(params).promise();
  },

  // Save admin log
  async saveAdminLog(logData) {
    const params = {
      TableName: TABLES.ADMIN_LOGS,
      Item: {
        logId: logData.logId,
        action: logData.action,
        adminId: logData.adminId,
        targetId: logData.targetId,
        details: logData.details,
        timestamp: new Date().toISOString()
      }
    };
    
    return await dynamodb.put(params).promise();
  },

  // Get admin logs
  async getAdminLogs(limit = 100) {
    const params = {
      TableName: TABLES.ADMIN_LOGS,
      ScanIndexForward: false, // Most recent first
      Limit: limit
    };
    
    const result = await dynamodb.scan(params).promise();
    return result.Items;
  },

  // Méthodes pour les appareils Shelly
  async createShellyDevice(deviceData) {
    try {
      const params = {
        TableName: TABLES.SHELLY_DEVICES, // Utiliser la constante définie
        Item: deviceData
      };
      
      await dynamodb.put(params).promise();
      return { success: true, data: deviceData };
    } catch (error) {
      console.error('Erreur lors de la création de l\'appareil Shelly:', error);
      throw error;
    }
  },

  async getShellyDeviceById(deviceId) {
    try {
      const params = {
        TableName: TABLES.SHELLY_DEVICES,
        Key: {
          id: deviceId
        },
        ConsistentRead: true
      };
      
      const result = await dynamodb.get(params).promise();
      return result.Item;
    } catch (error) {
      console.error('Erreur lors de la récupération de l\'appareil Shelly:', error);
      throw error;
    }
  },

  async getShellyDevicesByUserId(userId) {
    try {
      const params = {
        TableName: TABLES.SHELLY_DEVICES,
        FilterExpression: 'userId = :userId',
        ExpressionAttributeValues: {
          ':userId': userId
        },
        ConsistentRead: true
      };
      
      const result = await dynamodb.scan(params).promise();
      return result.Items || [];
    } catch (error) {
      console.error('Erreur lors de la récupération des appareils Shelly:', error);
      throw error;
    }
  },

  async getAllShellyDevices() {
    try {
      const params = {
        TableName: TABLES.SHELLY_DEVICES,
        ConsistentRead: true
      };
      
      const result = await dynamodb.scan(params).promise();
      return result.Items || [];
    } catch (error) {
      console.error('Erreur lors de la récupération de tous les appareils Shelly:', error);
      throw error;
    }
  },

  async updateShellyDevice(deviceId, updates) {
    try {
      console.log('🔄 Tentative de mise à jour Shelly avec ID:', deviceId);
      console.log('📤 Données de mise à jour:', updates);
      
      // D'abord, essayer de trouver l'appareil par différents moyens
      let foundDevice = null;
      
      // 1. Essayer avec l'ID exact
      try {
        const getParams = {
          TableName: TABLES.SHELLY_DEVICES,
          Key: { id: deviceId }
        };
        const getResult = await dynamodb.get(getParams).promise();
        if (getResult.Item) {
          foundDevice = getResult.Item;
          console.log('✅ Appareil trouvé avec ID exact:', deviceId);
        }
      } catch (error) {
        console.log('❌ Appareil non trouvé avec ID exact:', deviceId);
      }
      
              // 2. Si pas trouvé, essayer de chercher par siteId ou deviceId
        if (!foundDevice) {
          try {
            const scanParams = {
              TableName: TABLES.SHELLY_DEVICES,
              FilterExpression: 'siteId = :siteId OR deviceId = :deviceId',
              ExpressionAttributeValues: {
                ':siteId': deviceId,
                ':deviceId': deviceId
              }
            };
          const scanResult = await dynamodb.scan(scanParams).promise();
          if (scanResult.Items && scanResult.Items.length > 0) {
            foundDevice = scanResult.Items[0];
            console.log('✅ Appareil trouvé par scan avec ID:', foundDevice.id);
            deviceId = foundDevice.id; // Utiliser l'ID trouvé
          }
        } catch (error) {
          console.log('❌ Aucun appareil trouvé par scan');
        }
      }
      
      // Si aucun appareil trouvé, retourner une erreur
      if (!foundDevice) {
        console.log('❌ Aucun appareil trouvé avec ID:', deviceId);
        throw new Error(`Appareil non trouvé avec ID: ${deviceId}`);
      }
      
      // Mise à jour de l'appareil existant
      const updateExpression = [];
      const expressionAttributeNames = {};
      const expressionAttributeValues = {};
      
      Object.keys(updates).forEach(key => {
        if (key !== 'id') {
          updateExpression.push(`#${key} = :${key}`);
          expressionAttributeNames[`#${key}`] = key;
          expressionAttributeValues[`:${key}`] = updates[key];
        }
      });
      
      const params = {
        TableName: TABLES.SHELLY_DEVICES,
        Key: {
          id: deviceId
        },
        UpdateExpression: `SET ${updateExpression.join(', ')}`,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
        ReturnValues: 'ALL_NEW'
      };
      
      const result = await dynamodb.update(params).promise();
      console.log('✅ Appareil mis à jour avec succès');
      return result.Attributes;
    } catch (error) {
      console.error('❌ Erreur lors de la mise à jour de l\'appareil Shelly:', error);
      throw error;
    }
  },

  async deleteShellyDevice(deviceId) {
    try {
      const params = {
        TableName: TABLES.SHELLY_DEVICES,
        Key: {
          id: deviceId
        }
      };
      
      await dynamodb.delete(params).promise();
      return { success: true, message: 'Appareil Shelly supprimé avec succès' };
    } catch (error) {
      console.error('Erreur lors de la suppression de l\'appareil Shelly:', error);
      throw error;
    }
  },

  // NOUVELLES FONCTIONS POUR LES ÉTATS DES COMPOSANTS

  // Sauvegarder l'état d'un composant
  async saveComponentState(componentData) {
    try {
      const params = {
        TableName: 'WaiHomeComponentStates',
        Item: componentData
      };
      
      await dynamodb.put(params).promise();
      return { success: true, data: componentData };
    } catch (error) {
      console.error('Erreur lors de la sauvegarde de l\'état du composant:', error);
      throw error;
    }
  },

  // Récupérer l'état d'un composant par ID
  async getComponentStateById(componentId) {
    try {
      const params = {
        TableName: 'WaiHomeComponentStates',
        Key: {
          componentId: componentId
        },
        ConsistentRead: true
      };
      
      const result = await dynamodb.get(params).promise();
      return result.Item || null; // Retourner null si l'élément n'existe pas
    } catch (error) {
      console.error('Erreur lors de la récupération de l\'état du composant:', error);
      return null; // Retourner null en cas d'erreur
    }
  },

  // Récupérer tous les états des composants d'un site
  async getComponentStatesBySite(siteId) {
    try {
      const params = {
        TableName: 'WaiHomeComponentStates',
        FilterExpression: 'siteId = :siteId',
        ExpressionAttributeValues: {
          ':siteId': siteId
        },
        ConsistentRead: true
      };
      
      const result = await dynamodb.scan(params).promise();
      return result.Items || [];
    } catch (error) {
      console.error('Erreur lors de la récupération des états des composants:', error);
      throw error;
    }
  },

  // Mettre à jour l'état d'un composant
  async updateComponentState(componentId, updates) {
    try {
      const updateExpression = [];
      const expressionAttributeNames = {};
      const expressionAttributeValues = {};
      
      Object.keys(updates).forEach(key => {
        if (key !== 'componentId') {
          updateExpression.push(`#${key} = :${key}`);
          expressionAttributeNames[`#${key}`] = key;
          expressionAttributeValues[`:${key}`] = updates[key];
        }
      });
      
      const params = {
        TableName: 'WaiHomeComponentStates',
        Key: {
          componentId: componentId
        },
        UpdateExpression: `SET ${updateExpression.join(', ')}`,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
        ReturnValues: 'ALL_NEW'
      };
      
      const result = await dynamodb.update(params).promise();
      return result.Attributes;
    } catch (error) {
      console.error('Erreur lors de la mise à jour de l\'état du composant:', error);
      throw error;
    }
  },

  // Récupérer l'historique des états d'un composant
  async getComponentStateHistory(siteId, componentType, limit = 50) {
    try {
      const params = {
        TableName: 'WaiHomeComponentStates',
        FilterExpression: 'siteId = :siteId AND componentType = :componentType',
        ExpressionAttributeValues: {
          ':siteId': siteId,
          ':componentType': componentType
        },
        ConsistentRead: true,
        Limit: limit
      };
      
      const result = await dynamodb.scan(params).promise();
      const items = result.Items || [];
      
      // Trier par timestamp décroissant (plus récent en premier)
      return items.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    } catch (error) {
      console.error('Erreur lors de la récupération de l\'historique:', error);
      throw error;
    }
  },

  // Récupérer l'état le plus récent d'un composant
  async getLatestComponentState(siteId, componentType) {
    try {
      const history = await this.getComponentStateHistory(siteId, componentType, 1);
      return history.length > 0 ? history[0] : null;
    } catch (error) {
      console.error('Erreur lors de la récupération de l\'état le plus récent:', error);
      throw error;
    }
  },

  // Supprimer l'état d'un composant
  async deleteComponentState(componentId) {
    try {
      const params = {
        TableName: 'WaiHomeComponentStates',
        Key: {
          componentId: componentId
        }
      };
      
      await dynamodb.delete(params).promise();
      return { success: true, message: 'État du composant supprimé avec succès' };
    } catch (error) {
      console.error('Erreur lors de la suppression de l\'état du composant:', error);
      throw error;
    }
  }
};

// Créer un utilisateur par défaut si aucun n'existe (TEMPORAIREMENT DÉSACTIVÉ - Problème de permissions AWS)
const ensureDefaultUser = async () => {
  try {
    console.log('🔍 Vérification de l\'existence d\'un utilisateur par défaut...');
    
    // Vérifier s'il y a des utilisateurs
    const users = await dbHelpers.getAllUsers();
    
    if (!users || users.length === 0) {
      console.log('⚠️ Aucun utilisateur trouvé - Création d\'utilisateur par défaut DÉSACTIVÉE (problème de permissions AWS)');
      console.log('💡 Pour résoudre : Ajouter la permission dynamodb:PutItem à l\'utilisateur amplify-user');
      console.log('📋 Utilisateur par défaut temporaire : default@waihome.com / default-password');
    } else {
      console.log('✅ Utilisateurs existants trouvés:', users.length);
    }
  } catch (error) {
    console.log('⚠️ Impossible de vérifier les utilisateurs (problème de permissions AWS)');
    console.log('💡 Pour résoudre : Ajouter la permission dynamodb:Scan à l\'utilisateur amplify-user');
    // Ne pas bloquer l'application si la vérification échoue
  }
};

// Fonction d'initialisation complète qui attend que les tables soient prêtes
const initializeDatabase = async () => {
  try {
    console.log('🚀 Initialisation complète de la base de données...');
    
    // 1. Créer toutes les tables d'abord
    await ensureAllTables();
    
    // 2. Attendre un peu que les tables soient complètement actives
    console.log('⏳ Attente de la stabilisation des tables...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // 3. Créer l'utilisateur par défaut
    await ensureDefaultUser();
    
    console.log('✅ Base de données initialisée avec succès !');
    
  } catch (error) {
    console.error('❌ Erreur lors de l\'initialisation de la base de données:', error);
  }
};

// Démarrer l'initialisation complète
initializeDatabase();

module.exports = { dynamodb, TABLES, dbHelpers }; 