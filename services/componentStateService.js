import AsyncStorage from '@react-native-async-storage/async-storage';
import { controlShellyComponent } from './shellyControlService';

// Types de composants supportés
export const COMPONENT_TYPES = {
  PUMP: 'pump',
  AUGER: 'auger', 
  HEATER: 'heater',
  HIGH_WATER: 'highWater',
  BIN_REPLACED: 'binReplaced',
  EMERGENCY_HEATER: 'emergencyHeater'
};

/**
 * Service pour synchroniser les états des composants avec DynamoDB
 */
class ComponentStateService {
  
  /**
   * Change l'état d'un composant et synchronise avec DynamoDB
   * @param {string} siteId - ID du site
   * @param {string} componentType - Type de composant (pump, auger, heater, etc.)
   * @param {boolean} newState - Nouvel état (true = ON, false = OFF)
   * @param {string} userId - ID de l'utilisateur (optionnel)
   * @returns {Promise<Object>} - Résultat de l'opération
   */
  async updateComponentState(siteId, componentType, newState, userId = null) {
    try {
      console.log(`🔄 Mise à jour état composant: ${componentType} -> ${newState ? 'ON' : 'OFF'}`);
      
      // 1. Contrôler la sortie physique Shelly
      const shellySuccess = await controlShellyComponent(siteId, componentType, newState);
      
      if (!shellySuccess) {
        console.error(`❌ Échec du contrôle Shelly pour ${componentType}`);
        return {
          success: false,
          error: 'Échec du contrôle Shelly',
          componentType,
          newState
        };
      }
      
      // 2. Mettre à jour l'état local dans AsyncStorage
      const localUpdateSuccess = await this.updateLocalComponentState(siteId, componentType, newState);
      
      // 3. Synchroniser avec DynamoDB (mise à jour ou création)
      const dynamoUpdateSuccess = await this.syncToDynamoDB(siteId, componentType, newState, userId);
      
      return {
        success: true,
        shellySuccess,
        localUpdateSuccess,
        dynamoUpdateSuccess,
        componentType,
        newState,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      console.error(`❌ Erreur mise à jour état composant ${componentType}:`, error);
      return {
        success: false,
        error: error.message,
        componentType,
        newState
      };
    }
  }
  
  /**
   * Met à jour l'état local dans AsyncStorage
   */
  async updateLocalComponentState(siteId, componentType, newState) {
    try {
      const sitesJson = await AsyncStorage.getItem('sites');
      if (!sitesJson) {
        console.error('❌ Aucun site trouvé dans AsyncStorage');
        return false;
      }
      
      const sites = JSON.parse(sitesJson);
      const siteIndex = sites.findIndex(s => s.id === siteId);
      
      if (siteIndex === -1) {
        console.error('❌ Site non trouvé:', siteId);
        return false;
      }
      
      // Mettre à jour l'état du composant
      if (!sites[siteIndex].componentStates) {
        sites[siteIndex].componentStates = {};
      }
      
      sites[siteIndex].componentStates[componentType] = {
        state: newState,
        lastUpdated: new Date().toISOString()
      };
      
      // Sauvegarder les modifications
      await AsyncStorage.setItem('sites', JSON.stringify(sites));
      console.log(`✅ État local mis à jour: ${componentType} = ${newState}`);
      
      return true;
      
    } catch (error) {
      console.error('❌ Erreur mise à jour état local:', error);
      return false;
    }
  }
  
  /**
   * Synchronise l'état avec DynamoDB (mise à jour ou création)
   */
  async syncToDynamoDB(siteId, componentType, newState, userId = null) {
    try {
      // Si userId n'est pas fourni, essayer de le récupérer depuis AsyncStorage
      if (!userId) {
        const userData = await AsyncStorage.getItem('userData');
        if (userData) {
          const user = JSON.parse(userData);
          userId = user.userId;
        }
      }
      
      if (!userId) {
        console.warn('⚠️ UserId non disponible pour la synchronisation DynamoDB');
        return false;
      }
      
      // Créer un ID unique pour ce composant sur ce site
      const componentId = `${siteId}_${componentType}`;
      
      // Préparer les données pour DynamoDB
      const componentData = {
        componentId: componentId, // ID unique et stable
        siteId,
        userId,
        componentType,
        state: newState,
        timestamp: new Date().toISOString(),
        deviceId: `${siteId}_${componentType}`,
        lastUpdated: new Date().toISOString()
      };
      
      // Appel API pour sauvegarder/mettre à jour dans DynamoDB
      const response = await fetch('http://192.168.100.193:8080/api/shelly/component-state', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(componentData)
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log(`✅ État synchronisé avec DynamoDB: ${componentType}`);
        return true;
      } else {
        console.error(`❌ Erreur synchronisation DynamoDB: ${response.status}`);
        return false;
      }
      
    } catch (error) {
      console.error('❌ Erreur synchronisation DynamoDB:', error);
      return false;
    }
  }
  
  /**
   * Récupère l'état actuel d'un composant
   */
  async getComponentState(siteId, componentType) {
    try {
      const sitesJson = await AsyncStorage.getItem('sites');
      if (!sitesJson) {
        return null;
      }
      
      const sites = JSON.parse(sitesJson);
      const site = sites.find(s => s.id === siteId);
      
      if (!site || !site.componentStates) {
        return null;
      }
      
      return site.componentStates[componentType] || null;
      
    } catch (error) {
      console.error('❌ Erreur récupération état composant:', error);
      return null;
    }
  }
  
  /**
   * Récupère tous les états des composants d'un site
   */
  async getAllComponentStates(siteId) {
    try {
      const sitesJson = await AsyncStorage.getItem('sites');
      if (!sitesJson) {
        return {};
      }
      
      const sites = JSON.parse(sitesJson);
      const site = sites.find(s => s.id === siteId);
      
      if (!site || !site.componentStates) {
        return {};
      }
      
      return site.componentStates;
      
    } catch (error) {
      console.error('❌ Erreur récupération états composants:', error);
      return {};
    }
  }
  
  /**
   * Synchronise tous les états depuis DynamoDB
   */
  async syncFromDynamoDB(siteId, userId = null) {
    try {
      if (!userId) {
        const userData = await AsyncStorage.getItem('userData');
        if (userData) {
          const user = JSON.parse(userData);
          userId = user.userId;
        }
      }
      
      if (!userId) {
        console.warn('⚠️ UserId non disponible pour la synchronisation');
        return false;
      }
      
      const response = await fetch(`http://192.168.100.193:8080/api/shelly/component-states/${siteId}?userId=${userId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const result = await response.json();
        
        if (result.success && result.data) {
          // Mettre à jour les états locaux
          const sitesJson = await AsyncStorage.getItem('sites');
          if (sitesJson) {
            const sites = JSON.parse(sitesJson);
            const siteIndex = sites.findIndex(s => s.id === siteId);
            
            if (siteIndex !== -1) {
              if (!sites[siteIndex].componentStates) {
                sites[siteIndex].componentStates = {};
              }
              
              // Mettre à jour avec les données de DynamoDB
              Object.keys(result.data).forEach(componentType => {
                sites[siteIndex].componentStates[componentType] = result.data[componentType];
              });
              
              await AsyncStorage.setItem('sites', JSON.stringify(sites));
              console.log('✅ États synchronisés depuis DynamoDB');
              return true;
            }
          }
        }
      }
      
      return false;
      
    } catch (error) {
      console.error('❌ Erreur synchronisation depuis DynamoDB:', error);
      return false;
    }
  }
}

// Instance singleton
const componentStateService = new ComponentStateService();

export default componentStateService;
