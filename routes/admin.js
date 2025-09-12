const express = require('express');
const { dbHelpers } = require('../config/dynamodb');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Middleware d'authentification et vérification admin pour toutes les routes
router.use(authenticateToken);
router.use(requireAdmin);

// Obtenir tous les utilisateurs
router.get('/users', async (req, res) => {
  try {
    const users = await dbHelpers.getAllUsers();
    
    // Retirer les mots de passe des réponses
    const safeUsers = users.map(user => {
      const { password, ...safeUser } = user;
      return safeUser;
    });
    
    res.json({ users: safeUsers });
    
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to get users' });
  }
});

// Obtenir les statistiques globales
router.get('/stats', async (req, res) => {
  try {
    const users = await dbHelpers.getAllUsers();
    const sites = await dbHelpers.getAllSites();
    
    const stats = {
      totalUsers: users.length,
      totalSites: sites.length,
      activeSites: sites.filter(site => site.status === 'connected').length,
      disconnectedSites: sites.filter(site => site.status === 'disconnected').length,
      maintenanceSites: sites.filter(site => site.status === 'maintenance').length,
      averageSolidsLevel: 0,
      sitesByType: {},
      recentActivity: {
        newUsers: 0,
        newSites: 0
      }
    };
    
    // Calculer la moyenne des niveaux de solides
    const connectedSites = sites.filter(site => site.status === 'connected');
    if (connectedSites.length > 0) {
      const totalSolids = connectedSites.reduce((sum, site) => sum + (site.solidsLevel || 0), 0);
      stats.averageSolidsLevel = totalSolids / connectedSites.length;
    }
    
    // Grouper les sites par type
    sites.forEach(site => {
      if (!stats.sitesByType[site.siteType]) {
        stats.sitesByType[site.siteType] = 0;
      }
      stats.sitesByType[site.siteType]++;
    });
    
    // Calculer l'activité récente (dernières 24h)
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);
    
    stats.recentActivity.newUsers = users.filter(user => 
      new Date(user.createdAt) >= oneDayAgo
    ).length;
    
    stats.recentActivity.newSites = sites.filter(site => 
      new Date(site.createdAt) >= oneDayAgo
    ).length;
    
    res.json({ stats });
    
  } catch (error) {
    console.error('Get admin stats error:', error);
    res.status(500).json({ error: 'Failed to get statistics' });
  }
});

// Obtenir tous les sites avec informations utilisateur
router.get('/sites', async (req, res) => {
  try {
    const sites = await dbHelpers.getAllSites();
    const users = await dbHelpers.getAllUsers();
    
    // Ajouter les informations utilisateur aux sites
    const sitesWithUserInfo = sites.map(site => {
      const user = users.find(u => u.userId === site.userId);
      return {
        ...site,
        userName: user ? user.name : 'Unknown',
        userEmail: user ? user.email : 'Unknown'
      };
    });
    
    res.json({ sites: sitesWithUserInfo });
    
  } catch (error) {
    console.error('Get admin sites error:', error);
    res.status(500).json({ error: 'Failed to get sites' });
  }
});

// Obtenir les alertes globales
router.get('/alerts', async (req, res) => {
  try {
    const sites = await dbHelpers.getAllSites();
    const users = await dbHelpers.getAllUsers();
    
    const alerts = [];
    
    // Sites en maintenance
    const maintenanceSites = sites.filter(site => site.status === 'maintenance');
    if (maintenanceSites.length > 0) {
      alerts.push({
        type: 'maintenance_sites',
        message: `${maintenanceSites.length} sites require maintenance`,
        severity: 'warning',
        count: maintenanceSites.length,
        sites: maintenanceSites.map(site => ({
          siteId: site.siteId,
          siteName: site.siteName,
          userId: site.userId
        }))
      });
    }
    
    // Sites avec niveau de solides élevé
    const highSolidsSites = sites.filter(site => 
      site.status === 'connected' && site.solidsLevel > 80
    );
    
    if (highSolidsSites.length > 0) {
      alerts.push({
        type: 'high_solids_sites',
        message: `${highSolidsSites.length} sites have high solids levels`,
        severity: 'warning',
        count: highSolidsSites.length,
        sites: highSolidsSites.map(site => ({
          siteId: site.siteId,
          siteName: site.siteName,
          solidsLevel: site.solidsLevel,
          userId: site.userId
        }))
      });
    }
    
    // Sites déconnectés depuis longtemps
    const disconnectedSites = sites.filter(site => site.status === 'disconnected');
    const longDisconnectedSites = disconnectedSites.filter(site => {
      const lastUpdate = new Date(site.lastUpdate);
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      return lastUpdate < oneWeekAgo;
    });
    
    if (longDisconnectedSites.length > 0) {
      alerts.push({
        type: 'long_disconnected_sites',
        message: `${longDisconnectedSites.length} sites have been disconnected for over a week`,
        severity: 'info',
        count: longDisconnectedSites.length,
        sites: longDisconnectedSites.map(site => ({
          siteId: site.siteId,
          siteName: site.siteName,
          lastUpdate: site.lastUpdate,
          userId: site.userId
        }))
      });
    }
    
    res.json({ alerts });
    
  } catch (error) {
    console.error('Get admin alerts error:', error);
    res.status(500).json({ error: 'Failed to get alerts' });
  }
});

// Mettre à jour le statut d'un site (admin)
router.patch('/sites/:siteId/status', async (req, res) => {
  try {
    const { siteId } = req.params;
    const { status, notes } = req.body;
    
    if (!status || !['connected', 'disconnected', 'maintenance'].includes(status)) {
      return res.status(400).json({ error: 'Valid status required' });
    }
    
    // Trouver le site
    const sites = await dbHelpers.getAllSites();
    const site = sites.find(s => s.siteId === siteId);
    
    if (!site) {
      return res.status(404).json({ error: 'Site not found' });
    }
    
    // Mettre à jour le statut
    const updates = { status };
    if (notes) updates.adminNotes = notes;
    
    const result = await dbHelpers.updateSite(siteId, site.userId, updates);
    
    res.json({
      message: 'Site status updated successfully',
      site: result.Attributes
    });
    
  } catch (error) {
    console.error('Update site status error:', error);
    res.status(500).json({ error: 'Failed to update site status' });
  }
});

// Obtenir les données d'un site spécifique (admin)
router.get('/sites/:siteId/data', async (req, res) => {
  try {
    const { siteId } = req.params;
    const { limit = 100, sensorType } = req.query;
    
    // Vérifier que le site existe
    const sites = await dbHelpers.getAllSites();
    const site = sites.find(s => s.siteId === siteId);
    
    if (!site) {
      return res.status(404).json({ error: 'Site not found' });
    }
    
    // Obtenir les données
    let data = await dbHelpers.getShellyDataBySite(siteId, parseInt(limit));
    
    // Filtrer par type de capteur si spécifié
    if (sensorType) {
      data = data.filter(item => item.sensorType === sensorType);
    }
    
    res.json({ 
      site,
      data 
    });
    
  } catch (error) {
    console.error('Get site data error:', error);
    res.status(500).json({ error: 'Failed to get site data' });
  }
});

// Supprimer un utilisateur (admin)
router.delete('/users/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Vérifier que l'utilisateur existe
    const user = await dbHelpers.getUserById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Supprimer l'utilisateur et tous ses sites
    await dbHelpers.deleteUser(userId);
    
    // Supprimer tous les sites de l'utilisateur
    const sites = await dbHelpers.getSitesByUserId(userId);
    for (const site of sites) {
      await dbHelpers.deleteSite(site.siteId, userId);
    }
    
    res.json({ message: 'User and associated sites deleted successfully' });
    
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// Obtenir les logs d'activité
router.get('/logs', async (req, res) => {
  try {
    const { days = 7, limit = 100 } = req.query;
    
    // Calculer la date de début
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));
    
    // Obtenir toutes les données récentes
    const allSites = await dbHelpers.getAllSites();
    const logs = [];
    
    for (const site of allSites) {
      const siteData = await dbHelpers.getShellyDataBySite(site.siteId, 1000);
      const recentData = siteData.filter(item => 
        new Date(item.timestamp) >= startDate
      );
      
      recentData.forEach(data => {
        logs.push({
          timestamp: data.timestamp,
          siteId: site.siteId,
          siteName: site.siteName,
          userId: site.userId,
          sensorType: data.sensorType,
          value: data.value,
          action: 'sensor_reading'
        });
      });
    }
    
    // Trier par timestamp (plus récent en premier)
    logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    // Limiter le nombre de résultats
    const limitedLogs = logs.slice(0, parseInt(limit));
    
    res.json({ logs: limitedLogs });
    
  } catch (error) {
    console.error('Get logs error:', error);
    res.status(500).json({ error: 'Failed to get logs' });
  }
});

module.exports = router; 