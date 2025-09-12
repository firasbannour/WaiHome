const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { dbHelpers } = require('../config/dynamodb');
const { authenticateToken, requireOwnership } = require('../middleware/auth');

const router = express.Router();

// Middleware d'authentification pour toutes les routes
router.use(authenticateToken);

// Obtenir le profil de l'utilisateur connecté
router.get('/profile', async (req, res) => {
  try {
    const user = await dbHelpers.getUserById(req.user.userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Retirer le mot de passe de la réponse
    const { password, ...userProfile } = user;
    
    res.json({ user: userProfile });
    
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to get profile' });
  }
});

// Mettre à jour le profil utilisateur
router.put('/profile', async (req, res) => {
  try {
    const { name, email, phone } = req.body;
    const updates = {};
    
    if (name) updates.name = name;
    if (email) updates.email = email.toLowerCase();
    if (phone) updates.phone = phone;
    
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No updates provided' });
    }
    
    // Vérifier si l'email est déjà utilisé par un autre utilisateur
    if (email && email !== req.user.email) {
      const existingUser = await dbHelpers.getUserByEmail(email);
      if (existingUser && existingUser.userId !== req.user.userId) {
        return res.status(409).json({ error: 'Email already in use' });
      }
    }
    
    const updatedUser = await dbHelpers.updateUser(req.user.userId, updates);
    
    res.json({
      message: 'Profile updated successfully',
      user: updatedUser.Attributes
    });
    
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Obtenir les sites de l'utilisateur
router.get('/sites', async (req, res) => {
  try {
    const sites = await dbHelpers.getSitesByUserId(req.user.userId);
    
    res.json({ sites });
    
  } catch (error) {
    console.error('Get user sites error:', error);
    res.status(500).json({ error: 'Failed to get sites' });
  }
});

// Créer un nouveau site
router.post('/sites', async (req, res) => {
  try {
    const { siteName, siteType, location } = req.body;
    
    if (!siteName || !siteType) {
      return res.status(400).json({ error: 'Site name and type are required' });
    }
    
    const siteId = uuidv4();
    const siteData = {
      siteId,
      userId: req.user.userId,
      siteName,
      siteType,
      location: location || '',
      status: 'disconnected',
      solidsLevel: 0,
      notificationsEnabled: true,
      createdAt: new Date().toISOString(),
      lastUpdate: new Date().toISOString()
    };
    
    await dbHelpers.createSite(siteData);
    
    res.status(201).json({
      message: 'Site created successfully',
      site: siteData
    });
    
  } catch (error) {
    console.error('Create site error:', error);
    res.status(500).json({ error: 'Failed to create site' });
  }
});

// Mettre à jour un site
router.put('/sites/:siteId', async (req, res) => {
  try {
    const { siteId } = req.params;
    const { siteName, siteType, location, notificationsEnabled } = req.body;
    
    // Vérifier que l'utilisateur possède ce site
    const sites = await dbHelpers.getSitesByUserId(req.user.userId);
    const site = sites.find(s => s.siteId === siteId);
    
    if (!site) {
      return res.status(404).json({ error: 'Site not found' });
    }
    
    const updates = {};
    if (siteName) updates.siteName = siteName;
    if (siteType) updates.siteType = siteType;
    if (location !== undefined) updates.location = location;
    if (notificationsEnabled !== undefined) updates.notificationsEnabled = notificationsEnabled;
    
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No updates provided' });
    }
    
    const result = await dbHelpers.updateSite(siteId, req.user.userId, updates);
    
    res.json({
      message: 'Site updated successfully',
      site: result.Attributes
    });
    
  } catch (error) {
    console.error('Update site error:', error);
    res.status(500).json({ error: 'Failed to update site' });
  }
});

// Supprimer un site
router.delete('/sites/:siteId', async (req, res) => {
  try {
    const { siteId } = req.params;
    
    // Vérifier que l'utilisateur possède ce site
    const sites = await dbHelpers.getSitesByUserId(req.user.userId);
    const site = sites.find(s => s.siteId === siteId);
    
    if (!site) {
      return res.status(404).json({ error: 'Site not found' });
    }
    
    await dbHelpers.deleteSite(siteId, req.user.userId);
    
    res.json({ message: 'Site deleted successfully' });
    
  } catch (error) {
    console.error('Delete site error:', error);
    res.status(500).json({ error: 'Failed to delete site' });
  }
});

// Obtenir les statistiques de l'utilisateur
router.get('/stats', async (req, res) => {
  try {
    const sites = await dbHelpers.getSitesByUserId(req.user.userId);
    
    const stats = {
      totalSites: sites.length,
      connectedSites: sites.filter(site => site.status === 'connected').length,
      disconnectedSites: sites.filter(site => site.status === 'disconnected').length,
      maintenanceSites: sites.filter(site => site.status === 'maintenance').length,
      averageSolidsLevel: 0,
      sitesByType: {}
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
    
    res.json({ stats });
    
  } catch (error) {
    console.error('Get user stats error:', error);
    res.status(500).json({ error: 'Failed to get statistics' });
  }
});

module.exports = router; 