const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { dbHelpers } = require('../config/dynamodb');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Middleware d'authentification pour toutes les routes
router.use(authenticateToken);

// Créer un nouveau site
router.post('/', async (req, res) => {
  try {
    const { siteName, siteType, status = 'disconnected' } = req.body;
    const userId = req.user.userId;
    
    if (!siteName || !siteType) {
      return res.status(400).json({ error: 'Site name and type are required' });
    }
    
    const siteId = uuidv4();
    const siteData = {
      siteId,
      userId,
      siteName,
      siteType,
      status,
      solidsLevel: 0,
      notificationsEnabled: false
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

// Obtenir tous les sites de l'utilisateur
router.get('/', async (req, res) => {
  try {
    const userId = req.user.userId;
    const sites = await dbHelpers.getSitesByUserId(userId);
    
    res.json({ sites });
    
  } catch (error) {
    console.error('Get sites error:', error);
    res.status(500).json({ error: 'Failed to get sites' });
  }
});

// Obtenir un site spécifique
router.get('/:siteId', async (req, res) => {
  try {
    const { siteId } = req.params;
    const userId = req.user.userId;
    
    const sites = await dbHelpers.getSitesByUserId(userId);
    const site = sites.find(s => s.siteId === siteId);
    
    if (!site) {
      return res.status(404).json({ error: 'Site not found' });
    }
    
    res.json({ site });
    
  } catch (error) {
    console.error('Get site error:', error);
    res.status(500).json({ error: 'Failed to get site' });
  }
});

// Mettre à jour un site
router.put('/:siteId', async (req, res) => {
  try {
    const { siteId } = req.params;
    const userId = req.user.userId;
    const updates = req.body;
    
    // Vérifier que le site appartient à l'utilisateur
    const sites = await dbHelpers.getSitesByUserId(userId);
    const site = sites.find(s => s.siteId === siteId);
    
    if (!site) {
      return res.status(404).json({ error: 'Site not found' });
    }
    
    // Filtrer les champs autorisés
    const allowedUpdates = {};
    const allowedFields = ['siteName', 'siteType', 'status', 'solidsLevel', 'notificationsEnabled'];
    
    Object.keys(updates).forEach(key => {
      if (allowedFields.includes(key)) {
        allowedUpdates[key] = updates[key];
      }
    });
    
    if (Object.keys(allowedUpdates).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }
    
    const result = await dbHelpers.updateSite(siteId, userId, allowedUpdates);
    
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
router.delete('/:siteId', async (req, res) => {
  try {
    const { siteId } = req.params;
    const userId = req.user.userId;
    
    // Vérifier que le site appartient à l'utilisateur
    const sites = await dbHelpers.getSitesByUserId(userId);
    const site = sites.find(s => s.siteId === siteId);
    
    if (!site) {
      return res.status(404).json({ error: 'Site not found' });
    }
    
    // Supprimer le site
    await dbHelpers.deleteSite(siteId, userId);
    
    res.json({ message: 'Site deleted successfully' });
    
  } catch (error) {
    console.error('Delete site error:', error);
    res.status(500).json({ error: 'Failed to delete site' });
  }
});

// Mettre à jour le statut d'un site (pour les données Shelly)
router.patch('/:siteId/status', async (req, res) => {
  try {
    const { siteId } = req.params;
    const userId = req.user.userId;
    const { status, solidsLevel } = req.body;
    
    // Vérifier que le site appartient à l'utilisateur
    const sites = await dbHelpers.getSitesByUserId(userId);
    const site = sites.find(s => s.siteId === siteId);
    
    if (!site) {
      return res.status(404).json({ error: 'Site not found' });
    }
    
    const updates = {};
    if (status !== undefined) updates.status = status;
    if (solidsLevel !== undefined) updates.solidsLevel = solidsLevel;
    
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }
    
    const result = await dbHelpers.updateSite(siteId, userId, updates);
    
    res.json({
      message: 'Site status updated successfully',
      site: result.Attributes
    });
    
  } catch (error) {
    console.error('Update site status error:', error);
    res.status(500).json({ error: 'Failed to update site status' });
  }
});

// Activer/désactiver les notifications pour un site
router.patch('/:siteId/notifications', async (req, res) => {
  try {
    const { siteId } = req.params;
    const userId = req.user.userId;
    const { notificationsEnabled } = req.body;
    
    if (typeof notificationsEnabled !== 'boolean') {
      return res.status(400).json({ error: 'notificationsEnabled must be a boolean' });
    }
    
    // Vérifier que le site appartient à l'utilisateur
    const sites = await dbHelpers.getSitesByUserId(userId);
    const site = sites.find(s => s.siteId === siteId);
    
    if (!site) {
      return res.status(404).json({ error: 'Site not found' });
    }
    
    const result = await dbHelpers.updateSite(siteId, userId, { notificationsEnabled });
    
    res.json({
      message: 'Notifications updated successfully',
      site: result.Attributes
    });
    
  } catch (error) {
    console.error('Update notifications error:', error);
    res.status(500).json({ error: 'Failed to update notifications' });
  }
});

module.exports = router; 