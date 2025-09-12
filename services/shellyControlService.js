/**
 * Service pour contrôler les sorties physiques du Shelly Pro 4PM
 * Mapping des sorties :
 * - OUTPUT-0 (id: 0) → Pump (Pompe)
 * - OUTPUT-1 (id: 1) → Auger (Vis sans fin)
 * - OUTPUT-2 (id: 2) → Heater (Chauffage)
 * - OUTPUT-3 (id: 3) → High Water (Alarme niveau d'eau)
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// Mapping des composants vers les IDs de sortie Shelly
export const SHELLY_OUTPUTS = {
  pump: 0,        // OUTPUT-0
  auger: 1,       // OUTPUT-1  
  heater: 2,      // OUTPUT-2
  highWater: 3    // OUTPUT-3
};

/**
 * Contrôle une sortie physique du Shelly
 * @param {string} siteId - ID du site
 * @param {number} outputId - ID de la sortie Shelly (0-3)
 * @param {boolean} isOn - État à appliquer (true = ON, false = OFF)
 * @returns {Promise<boolean>} - Succès de l'opération
 */
export const controlShellyOutput = async (siteId, outputId, isOn) => {
  try {
    console.log(`🔧 Contrôle Shelly Output ${outputId} -> ${isOn ? 'ON' : 'OFF'}`);
    
    // Récupérer l'IP du Shelly depuis les données du site
    const sitesJson = await AsyncStorage.getItem('sites');
    if (!sitesJson) {
      console.error('❌ Aucun site trouvé dans AsyncStorage');
      return false;
    }
    
    const sites = JSON.parse(sitesJson);
    const currentSite = sites.find((s) => s.id === siteId);
    
    if (!currentSite) {
      console.error('❌ Site non trouvé:', siteId);
      return false;
    }
    
    if (!currentSite.deviceInfo || !currentSite.deviceInfo.ipAddress) {
      console.error('❌ IP Shelly non trouvée dans les données du site');
      return false;
    }
    
    const shellyIP = currentSite.deviceInfo.ipAddress;
    console.log(`📡 Envoi commande à Shelly ${shellyIP}`);
    
    const url = `http://${shellyIP}/rpc/Switch.Set`;
    const payload = {
      id: outputId,
      on: isOn
    };
    
    console.log(`📤 URL: ${url}`);
    console.log(`📤 Payload:`, payload);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log(`✅ Shelly Output ${outputId} ${isOn ? 'ON' : 'OFF'} - Réponse:`, result);
      return true;
    } else {
      console.error(`❌ Erreur Shelly Output ${outputId} - Status: ${response.status}`);
      const errorText = await response.text();
      console.error(`❌ Erreur détail:`, errorText);
      return false;
    }
    
  } catch (error) {
    console.error('❌ Erreur contrôle Shelly:', error);
    return false;
  }
};

/**
 * Contrôle une sortie Shelly par nom de composant
 * @param {string} siteId - ID du site
 * @param {string} componentName - Nom du composant ('pump', 'auger', 'heater', 'highWater')
 * @param {boolean} isOn - État à appliquer
 * @returns {Promise<boolean>} - Succès de l'opération
 */
export const controlShellyComponent = async (siteId, componentName, isOn) => {
  const outputId = SHELLY_OUTPUTS[componentName];
  if (outputId === undefined) {
    console.error(`❌ Composant inconnu: ${componentName}`);
    return false;
  }
  
  return await controlShellyOutput(siteId, outputId, isOn);
};

/**
 * Vérifie l'état d'une sortie Shelly
 * @param {string} siteId - ID du site
 * @param {number} outputId - ID de la sortie Shelly (0-3)
 * @returns {Promise<Object|null>} - État de la sortie ou null si erreur
 */
export const getShellyOutputStatus = async (siteId, outputId) => {
  try {
    console.log(`🔍 Vérification état Shelly Output ${outputId}`);
    
    const sitesJson = await AsyncStorage.getItem('sites');
    if (!sitesJson) {
      console.error('❌ Aucun site trouvé dans AsyncStorage');
      return null;
    }
    
    const sites = JSON.parse(sitesJson);
    const currentSite = sites.find((s) => s.id === siteId);
    
    if (!currentSite || !currentSite.deviceInfo || !currentSite.deviceInfo.ipAddress) {
      console.error('❌ IP Shelly non trouvée');
      return null;
    }
    
    const shellyIP = currentSite.deviceInfo.ipAddress;
    const url = `http://${shellyIP}/rpc/Switch.GetStatus`;
    const payload = { id: outputId };
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log(`✅ État Shelly Output ${outputId}:`, result);
      return result;
    } else {
      console.error(`❌ Erreur récupération état Output ${outputId}`);
      return null;
    }
    
  } catch (error) {
    console.error('❌ Erreur récupération état Shelly:', error);
    return null;
  }
};

/**
 * Teste la connectivité avec le Shelly
 * @param {string} siteId - ID du site
 * @returns {Promise<boolean>} - Connectivité OK
 */
export const testShellyConnectivity = async (siteId) => {
  try {
    console.log(`🔍 Test de connectivité Shelly pour site: ${siteId}`);
    
    const sitesJson = await AsyncStorage.getItem('sites');
    if (!sitesJson) {
      console.error('❌ Aucun site trouvé dans AsyncStorage');
      return false;
    }
    
    const sites = JSON.parse(sitesJson);
    const currentSite = sites.find((s) => s.id === siteId);
    
    if (!currentSite || !currentSite.deviceInfo || !currentSite.deviceInfo.ipAddress) {
      console.error('❌ IP Shelly non trouvée');
      return false;
    }
    
    const shellyIP = currentSite.deviceInfo.ipAddress;
    const url = `http://${shellyIP}/shelly`;
    
    const response = await fetch(url, {
      method: 'GET',
      timeout: 5000
    });
    
    if (response.ok) {
      console.log(`✅ Shelly ${shellyIP} accessible`);
      return true;
    } else {
      console.error(`❌ Shelly ${shellyIP} non accessible - Status: ${response.status}`);
      return false;
    }
    
  } catch (error) {
    console.error('❌ Erreur test connectivité Shelly:', error);
    return false;
  }
};

/**
 * Récupère les informations du device Shelly
 * @param {string} siteId - ID du site
 * @returns {Promise<Object|null>} - Informations du device ou null si erreur
 */
export const getShellyDeviceInfo = async (siteId) => {
  try {
    console.log(`🔍 Récupération infos device Shelly pour site: ${siteId}`);
    
    const sitesJson = await AsyncStorage.getItem('sites');
    if (!sitesJson) {
      console.error('❌ Aucun site trouvé dans AsyncStorage');
      return null;
    }
    
    const sites = JSON.parse(sitesJson);
    const currentSite = sites.find((s) => s.id === siteId);
    
    if (!currentSite || !currentSite.deviceInfo || !currentSite.deviceInfo.ipAddress) {
      console.error('❌ IP Shelly non trouvée');
      return null;
    }
    
    const shellyIP = currentSite.deviceInfo.ipAddress;
    const url = `http://${shellyIP}/rpc/Shelly.GetDeviceInfo`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({})
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log(`✅ Infos device Shelly:`, result);
      return result;
    } else {
      console.error(`❌ Erreur récupération infos device`);
      return null;
    }
    
  } catch (error) {
    console.error('❌ Erreur récupération infos device Shelly:', error);
    return null;
  }
};

export default {
  SHELLY_OUTPUTS,
  controlShellyOutput,
  controlShellyComponent,
  getShellyOutputStatus,
  testShellyConnectivity,
  getShellyDeviceInfo
};
