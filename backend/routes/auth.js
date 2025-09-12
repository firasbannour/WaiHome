const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { dbHelpers } = require('../config/dynamodb');

const router = express.Router();

// Middleware pour valider les données
const validateRegistration = (req, res, next) => {
  const { email, password, name } = req.body;
  
  if (!email || !password || !name) {
    return res.status(400).json({ error: 'Email, password and name are required' });
  }
  
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }
  
  if (!email.includes('@')) {
    return res.status(400).json({ error: 'Invalid email format' });
  }
  
  next();
};

const validateLogin = (req, res, next) => {
  const { email, password } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }
  
  next();
};

// Route d'inscription
router.post('/register', validateRegistration, async (req, res) => {
  try {
    const { email, password, name, role = 'user' } = req.body;
    
    // Vérifier si l'utilisateur existe déjà
    const existingUser = await dbHelpers.getUserByEmail(email);
    if (existingUser) {
      return res.status(409).json({ error: 'User already exists' });
    }
    
    // Hasher le mot de passe
    const hashedPassword = await bcrypt.hash(password, 12);
    
    // Créer l'utilisateur
    const userId = uuidv4();
    const userData = {
      userId,
      email: email.toLowerCase(),
      name,
      role,
      password: hashedPassword
    };
    
    await dbHelpers.createUser(userData);
    
    // Générer le token JWT
    const token = jwt.sign(
      { userId, email, role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    // Retourner les données utilisateur (sans le mot de passe)
    const userResponse = {
      userId,
      email,
      name,
      role,
      createdAt: userData.createdAt
    };
    
    res.status(201).json({
      message: 'User created successfully',
      user: userResponse,
      token
    });
    
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// Route de connexion
router.post('/login', validateLogin, async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Trouver l'utilisateur par email
    const user = await dbHelpers.getUserByEmail(email.toLowerCase());
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Vérifier le mot de passe
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Mettre à jour la dernière connexion
    await dbHelpers.updateUser(user.userId, { lastLogin: new Date().toISOString() });
    
    // Générer le token JWT
    const token = jwt.sign(
      { userId: user.userId, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    // Retourner les données utilisateur (sans le mot de passe)
    const userResponse = {
      userId: user.userId,
      email: user.email,
      name: user.name,
      role: user.role,
      lastLogin: new Date().toISOString()
    };
    
    res.json({
      message: 'Login successful',
      user: userResponse,
      token
    });
    
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Failed to login' });
  }
});

// Route pour vérifier le token
router.get('/verify', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await dbHelpers.getUserById(decoded.userId);
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    
    const userResponse = {
      userId: user.userId,
      email: user.email,
      name: user.name,
      role: user.role
    };
    
    res.json({ user: userResponse });
    
  } catch (error) {
    console.error('Token verification error:', error);
    res.status(401).json({ error: 'Invalid token' });
  }
});

// Route pour changer le mot de passe
router.post('/change-password', async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await dbHelpers.getUserById(decoded.userId);
    
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }
    
    // Vérifier l'ancien mot de passe
    const isValidPassword = await bcrypt.compare(currentPassword, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }
    
    // Hasher le nouveau mot de passe
    const hashedNewPassword = await bcrypt.hash(newPassword, 12);
    
    // Mettre à jour le mot de passe
    await dbHelpers.updateUser(user.userId, { password: hashedNewPassword });
    
    res.json({ message: 'Password changed successfully' });
    
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

module.exports = router; 