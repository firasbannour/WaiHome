// Configuration API pour WaiHome
const API_BASE_URL = 'http://192.168.100.193:8080/api';

// Fonction utilitaire pour les requêtes API
const apiRequest = async (endpoint, options = {}) => {
  const url = `${API_BASE_URL}${endpoint}`;
  
  const defaultOptions = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    }
  };

  const config = { ...defaultOptions, ...options };

  try {
    const response = await fetch(url, config);
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'API request failed');
    }

    return await response.json();
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
};

// Fonction pour ajouter le token d'authentification
const getAuthHeaders = (token) => ({
  'Authorization': `Bearer ${token}`
});

// API d'authentification
export const authAPI = {
  // Inscription
  register: async (userData) => {
    return apiRequest('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData)
    });
  },

  // Connexion
  login: async (credentials) => {
    return apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials)
    });
  },

  // Vérification du token
  verify: async (token) => {
    return apiRequest('/auth/verify', {
      headers: getAuthHeaders(token)
    });
  }
};

// API utilisateur
export const userAPI = {
  // Obtenir le profil utilisateur
  getProfile: async (token) => {
    return apiRequest('/users/profile', {
      headers: getAuthHeaders(token)
    });
  },

  // Mettre à jour le profil
  updateProfile: async (token, updates) => {
    return apiRequest('/users/profile', {
      method: 'PUT',
      headers: getAuthHeaders(token),
      body: JSON.stringify(updates)
    });
  },

  // Obtenir les sites de l'utilisateur
  getSites: async (token) => {
    return apiRequest('/users/sites', {
      headers: getAuthHeaders(token)
    });
  },

  // Créer un nouveau site
  createSite: async (token, siteData) => {
    return apiRequest('/users/sites', {
      method: 'POST',
      headers: getAuthHeaders(token),
      body: JSON.stringify(siteData)
    });
  },

  // Mettre à jour un site
  updateSite: async (token, siteId, updates) => {
    return apiRequest(`/users/sites/${siteId}`, {
      method: 'PUT',
      headers: getAuthHeaders(token),
      body: JSON.stringify(updates)
    });
  },

  // Supprimer un site
  deleteSite: async (token, siteId) => {
    return apiRequest(`/users/sites/${siteId}`, {
      method: 'DELETE',
      headers: getAuthHeaders(token)
    });
  },

  // Obtenir les statistiques utilisateur
  getStats: async (token) => {
    return apiRequest('/users/stats', {
      headers: getAuthHeaders(token)
    });
  }
};

// API Shelly
export const shellyAPI = {
  // Recevoir des données Shelly
  sendData: async (data) => {
    return apiRequest('/shelly/data', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  // Obtenir les données d'un site
  getSiteData: async (token, siteId, params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    const endpoint = `/shelly/site/${siteId}${queryString ? `?${queryString}` : ''}`;
    
    return apiRequest(endpoint, {
      headers: getAuthHeaders(token)
    });
  },

  // Obtenir les statistiques d'un site
  getSiteStats: async (token, siteId, params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    const endpoint = `/shelly/site/${siteId}/stats${queryString ? `?${queryString}` : ''}`;
    
    return apiRequest(endpoint, {
      headers: getAuthHeaders(token)
    });
  },

  // Obtenir les alertes d'un site
  getSiteAlerts: async (token, siteId, params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    const endpoint = `/shelly/site/${siteId}/alerts${queryString ? `?${queryString}` : ''}`;
    
    return apiRequest(endpoint, {
      headers: getAuthHeaders(token)
    });
  }
};

// API Admin
export const adminAPI = {
  // Obtenir tous les utilisateurs
  getUsers: async (token) => {
    return apiRequest('/admin/users', {
      headers: getAuthHeaders(token)
    });
  },

  // Obtenir les statistiques globales
  getStats: async (token) => {
    return apiRequest('/admin/stats', {
      headers: getAuthHeaders(token)
    });
  },

  // Obtenir tous les sites
  getSites: async (token) => {
    return apiRequest('/admin/sites', {
      headers: getAuthHeaders(token)
    });
  },

  // Obtenir les alertes globales
  getAlerts: async (token) => {
    return apiRequest('/admin/alerts', {
      headers: getAuthHeaders(token)
    });
  },

  // Mettre à jour le statut d'un site
  updateSiteStatus: async (token, siteId, status) => {
    return apiRequest(`/admin/sites/${siteId}/status`, {
      method: 'PATCH',
      headers: getAuthHeaders(token),
      body: JSON.stringify({ status })
    });
  },

  // Obtenir les données d'un site (admin)
  getSiteData: async (token, siteId, params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    const endpoint = `/admin/sites/${siteId}/data${queryString ? `?${queryString}` : ''}`;
    
    return apiRequest(endpoint, {
      headers: getAuthHeaders(token)
    });
  },

  // Supprimer un utilisateur
  deleteUser: async (token, userId) => {
    return apiRequest(`/admin/users/${userId}`, {
      method: 'DELETE',
      headers: getAuthHeaders(token)
    });
  },

  // Obtenir les logs d'activité
  getLogs: async (token, params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    const endpoint = `/admin/logs${queryString ? `?${queryString}` : ''}`;
    
    return apiRequest(endpoint, {
      headers: getAuthHeaders(token)
    });
  }
};

// Health check
export const healthAPI = {
  check: async () => {
    return fetch('http://192.168.100.193:8080/health').then(res => res.json());
  }
};

export default {
  auth: authAPI,
  user: userAPI,
  shelly: shellyAPI,
  admin: adminAPI,
  health: healthAPI
}; 