import { AuthService } from './authService';

export class ShellyService {
  // URL de base pour l'API - Peut être changée pour les tests
  static get API_BASE_URL() {
    // Pour les tests avec d'autres utilisateurs, change cette URL
    return 'https://waihome-3.onrender.com/api';
    // Exemple pour un backend déployé : return 'https://ton-backend.onrender.com/api';
  }

  // Test de connectivité au backend
  static async testConnection() {
    try {
      console.log('🔍 Test de connectivité au backend...');
      console.log('📍 URL testée: https://waihome-3.onrender.com/health');
      
      // Test avec timeout et gestion d'erreur améliorée (augmenté à 20s + 1 retry)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000);
      
      const response = await fetch('https://waihome-3.onrender.com/health', {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const data = await response.json();
        console.log('✅ Backend connection successful:', data);
        return { success: true, data };
      } else {
        console.error('❌ Backend connection error:', response.status);
        return { success: false, error: `HTTP ${response.status}` };
      }
    } catch (error) {
      console.error('❌ Backend connectivity error:', error);
      
      // Détails de l'erreur
      if (error.name === 'AbortError') {
        // Petite attente puis un retry unique pour les cold starts Render
        try {
          console.log('⏳ Timeout 20s – nouvel essai unique...');
          await new Promise(r => setTimeout(r, 1500));
          const ctrl2 = new AbortController();
          const to2 = setTimeout(() => ctrl2.abort(), 20000);
          const res2 = await fetch('https://waihome-3.onrender.com/health', { method: 'GET', signal: ctrl2.signal });
          clearTimeout(to2);
          if (res2.ok) {
            const data2 = await res2.json();
            console.log('✅ Backend connection successful (retry):', data2);
            return { success: true, data: data2 };
          }
        } catch {}
        return { success: false, error: 'Connection timeout (20s)' };
      } else if (error.message.includes('Network request failed')) {
        return { success: false, error: 'Network unreachable - check connectivity' };
      } else if (error.message.includes('fetch')) {
        return { success: false, error: 'Fetch error - check network permissions' };
      }
      
      return { success: false, error: error.message };
    }
  }

  // Sauvegarder les coordonnées Shelly d'un utilisateur
  static async saveShellyDevice(userId, deviceInfo) {
    try {
      // Test de connectivité d'abord (ne bloque plus immédiatement en cas d'échec)
      const connectionTest = await this.testConnection();
      if (!connectionTest.success) {
        console.error('⚠️ Backend not immediately reachable, proceeding with save attempt:', connectionTest.error);
      }

      const token = await AuthService.getCurrentUser();
      if (!token) {
        throw new Error('Utilisateur non authentifié');
      }

      console.log('💾 Saving Shelly device:', deviceInfo);

      const response = await fetch(`${this.API_BASE_URL}/shelly/devices`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          // Normaliser userId (peut être { success, data } selon l'appelant)
          userId: (userId && typeof userId === 'object' && 'data' in userId) ? userId.data : userId,
          // Mettre tous les champs de l'appareil au niveau racine (pas de deviceInfo imbriqué)
          ...deviceInfo,
          siteId: deviceInfo.siteId || deviceInfo.deviceId,
          // S'assurer que components est bien présent au niveau racine
          components: deviceInfo.components || {},
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ HTTP Error:', response.status, errorText);
        throw new Error(`HTTP Error: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      console.log('✅ Shelly device saved successfully:', result);
      return { success: true, data: result };
    } catch (error) {
      console.error('❌ Error saving Shelly device:', error);
      return { success: false, error: error.message };
    }
  }

  // Récupérer tous les appareils Shelly d'un utilisateur
  static async getUserShellyDevices(userId) {
    try {
      // Normaliser l'identifiant utilisateur
      const normalizedUserId = (userId && typeof userId === 'object' && 'data' in userId)
        ? userId.data
        : userId;
      // Test de connectivité d'abord
      const connectionTest = await this.testConnection();
      if (!connectionTest.success) {
        console.error('❌ Unable to connect to backend:', connectionTest.error);
        
        // Essayer avec une URL alternative
        console.log('🔄 Trying alternative URL...');
        const alternativeTest = await this.testAlternativeConnection();
        if (!alternativeTest.success) {
          return { success: false, error: `Connection impossible: ${connectionTest.error}` };
        }
      }

      const token = await AuthService.getCurrentUser();
      if (!token) {
        throw new Error('Utilisateur non authentifié');
      }

      console.log('🔗 Attempting to retrieve Shelly devices for:', normalizedUserId);
      
      const response = await fetch(`${this.API_BASE_URL}/shelly/devices/${normalizedUserId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Erreur HTTP: ${response.status}`);
      }

      const result = await response.json().catch(() => null);
      console.log('✅ Shelly devices retrieved successfully:', result);
      
      // Garantir que data est toujours un tableau
      if (result && result.success && result.data) {
        return { 
          success: true, 
          data: Array.isArray(result.data) ? result.data : [] 
        };
      } else {
        return { success: true, data: [] };
      }
    } catch (error) {
      console.error('❌ Error retrieving Shelly devices:', error);
      return { success: false, error: error.message };
    }
  }

  // Test de connexion alternative
  static async testAlternativeConnection() {
    try {
      console.log('🔄 Testing alternative connection...');
      
      // Essayer avec l'IP locale
      const localResponse = await fetch('https://waihome-3.onrender.com/health', {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });
      
      if (localResponse.ok) {
        console.log('✅ Local connection successful');
        return { success: true, data: 'localhost' };
      }
    } catch (error) {
      console.log('❌ Local connection failed:', error.message);
    }
    
    return { success: false, error: 'Aucune connexion alternative disponible' };
  }

  // Mettre à jour un appareil Shelly
  static async updateShellyDevice(deviceId, updates) {
    try {
      console.log('🔄 updateShellyDevice appelé avec deviceId:', deviceId);
      console.log('📤 Données de mise à jour:', updates);
      
      const token = await AuthService.getCurrentUser();
      if (!token) {
        throw new Error('Utilisateur non authentifié');
      }

      const response = await fetch(`${this.API_BASE_URL}/shelly/devices/${deviceId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...updates,
          updatedAt: new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Erreur HTTP:', response.status, errorText);
        throw new Error(`Erreur HTTP: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      console.log('✅ Mise à jour Shelly réussie:', result);
      return { success: true, data: result };
    } catch (error) {
      console.error('❌ Erreur lors de la mise à jour Shelly:', error);
      return { success: false, error: error.message };
    }
  }

  // Supprimer un appareil Shelly
  static async deleteShellyDevice(deviceId) {
    try {
      const token = await AuthService.getCurrentUser();
      if (!token) {
        throw new Error('Utilisateur non authentifié');
      }

      // Timeout + retry (2 tentatives) pour améliorer la robustesse
      const attempt = async () => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);
        try {
          const response = await fetch(`${this.API_BASE_URL}/shelly/devices/${deviceId}`, {
            method: 'DELETE',
            signal: controller.signal,
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          });
          clearTimeout(timeoutId);
          if (!response.ok) {
            // Traiter 404 (non trouvé) comme un succès (suppression idempotente)
            if (response.status === 404) {
              console.log('ℹ️ Appareil non trouvé - suppression idempotente réussie');
              return { success: true };
            }
            throw new Error(`Erreur HTTP: ${response.status}`);
          }
          return { success: true };
        } catch (e) {
          clearTimeout(timeoutId);
          throw e;
        }
      };

      try {
        return await attempt();
      } catch (first) {
        console.log('⚠️ Échec suppression (1ère tentative), nouvel essai ...', first?.message || first);
        await new Promise(r => setTimeout(r, 1200));
        return await attempt();
      }
    } catch (error) {
      console.error('❌ Erreur lors de la suppression Shelly:', error);
      return { success: false, error: error.message || 'Échec réseau' };
    }
  }
}
