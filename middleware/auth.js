const jwt = require('jsonwebtoken');
const { dbHelpers } = require('../config/dynamodb');

// Middleware pour vérifier le token JWT
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Vérifier que l'utilisateur existe toujours
    const user = await dbHelpers.getUserById(decoded.userId);
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    // Ajouter les informations utilisateur à la requête
    req.user = {
      userId: user.userId,
      email: user.email,
      name: user.name,
      role: user.role
    };

    next();
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
};

// Middleware pour vérifier les permissions admin
const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

// Middleware pour vérifier les permissions utilisateur ou admin
const requireUserOrAdmin = (req, res, next) => {
  if (req.user.role !== 'user' && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'User or admin access required' });
  }
  next();
};

// Middleware pour vérifier que l'utilisateur accède à ses propres données
const requireOwnership = (paramName = 'userId') => {
  return (req, res, next) => {
    const targetUserId = req.params[paramName];
    
    if (req.user.role === 'admin') {
      return next(); // Les admins peuvent accéder à tout
    }
    
    if (req.user.userId !== targetUserId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    next();
  };
};

module.exports = {
  authenticateToken,
  requireAdmin,
  requireUserOrAdmin,
  requireOwnership
}; 