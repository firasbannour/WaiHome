// services/remoteControlService.js
// Service pour contrôler les Shelly à distance via AWS IoT

const BACKEND_URL = 'https://waihome-3.onrender.com';

/**
 * Service pour contrôler les Shelly à distance via AWS IoT
 */
class RemoteControlService {
  
  /**
   * Envoyer une commande à un Shelly via AWS IoT
   * @param {string} siteId - ID du site/device
   * @param {string} component - Nom du composant (pump, auger, heater, highWater)
   * @param {string} action - Action à effectuer (on, off, toggle)
   * @param {any} value - Valeur optionnelle
   * @returns {Promise<Object>} - Résultat de l'opération
   */
  async sendRemoteCommand(siteId, component, action, value = null) {
    try {
      console.log(`📡 Commande à distance: ${component} ${action} sur ${siteId}`);
      
      const response = await fetch(`${BACKEND_URL}/api/shelly/command/${siteId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          component,
          action,
          value
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        console.log('✅ Commande à distance envoyée avec succès:', result);
        return {
          success: true,
          message: result.message,
          remote: result.remote || false,
          data: result.data
        };
      } else {
        console.error('❌ Erreur commande à distance:', result.error);
        return {
          success: false,
          error: result.error,
          message: result.message
        };
      }
      
    } catch (error) {
      console.error('❌ Erreur réseau commande à distance:', error);
      return {
        success: false,
        error: 'Erreur de connexion au serveur',
        details: error.message
      };
    }
  }
  
  /**
   * Contrôler un composant spécifique
   * @param {string} siteId - ID du site
   * @param {string} component - Nom du composant
   * @param {boolean} isOn - État à appliquer
   * @returns {Promise<Object>} - Résultat
   */
  async controlComponent(siteId, component, isOn) {
    const action = isOn ? 'on' : 'off';
    return await this.sendRemoteCommand(siteId, component, action);
  }
  
  /**
   * Basculer l'état d'un composant
   * @param {string} siteId - ID du site
   * @param {string} component - Nom du composant
   * @returns {Promise<Object>} - Résultat
   */
  async toggleComponent(siteId, component) {
    return await this.sendRemoteCommand(siteId, component, 'toggle');
  }
  
  /**
   * Vérifier le statut MQTT du backend
   * @returns {Promise<Object>} - Statut MQTT
   */
  async checkMqttStatus() {
    try {
      const response = await fetch(`${BACKEND_URL}/api/mqtt/status`);
      const status = await response.json();
      
      return {
        success: true,
        connected: status.connected,
        endpoint: status.endpoint,
        timestamp: status.timestamp
      };
    } catch (error) {
      return {
        success: false,
        error: 'Impossible de vérifier le statut MQTT',
        details: error.message
      };
    }
  }
  
  /**
   * Tester la connectivité à distance
   * @param {string} siteId - ID du site à tester
   * @returns {Promise<Object>} - Résultat du test
   */
  async testRemoteConnectivity(siteId) {
    try {
      console.log('🧪 Test de connectivité à distance pour:', siteId);
      
      // Test 1: Vérifier MQTT
      const mqttStatus = await this.checkMqttStatus();
      if (!mqttStatus.success || !mqttStatus.connected) {
        return {
          success: false,
          error: 'MQTT non connecté',
          mqttStatus
        };
      }
      
      // Test 2: Envoyer une commande de test
      const testResult = await this.sendRemoteCommand(siteId, 'test', 'ping', {
        timestamp: new Date().toISOString(),
        test: true
      });
      
      return {
        success: true,
        mqttStatus,
        testResult,
        message: 'Connectivité à distance opérationnelle'
      };
      
    } catch (error) {
      return {
        success: false,
        error: 'Erreur lors du test de connectivité',
        details: error.message
      };
    }
  }
}

// Export singleton
export const remoteControlService = new RemoteControlService();
export default remoteControlService;
