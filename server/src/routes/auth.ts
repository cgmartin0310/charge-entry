import express from 'express';
import { prisma, ensureFreshConnection } from '../lib/prisma';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const router = express.Router();

// Login route
router.post('/login', async (req, res) => {
  try {
    // Ensure fresh database connection
    await ensureFreshConnection();
    
    const { email, password } = req.body;
    
    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email },
    });
    
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    
    // Check if password is correct
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    
    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: user.id, 
        email: user.email, 
        role: user.role,
        providerId: user.providerId 
      },
      process.env.JWT_SECRET || 'fallback-secret-key',
      { expiresIn: '8h' }
    );
    
    // Return token and user data (excluding password)
    const { passwordHash, ...userData } = user;
    res.json({ token, user: userData });
    
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error during login' });
  }
});

// Register route (for admin use)
router.post('/register', async (req, res) => {
  try {
    const { email, password, username, role = 'USER' } = req.body;
    
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });
    
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }
    
    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    
    // Create new user
    const newUser = await prisma.user.create({
      data: {
        email,
        username,
        passwordHash,
        role,
      },
    });
    
    // Don't return the password hash
    const { passwordHash: _, ...userData } = newUser;
    
    res.status(201).json(userData);
    
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Server error during registration' });
  }
});

// Debug route to verify token
router.get('/verify-token', async (req, res) => {
  try {
    const authHeader = req.header('Authorization');
    if (!authHeader) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const token = authHeader.replace('Bearer ', '');
    
    try {
      const decoded = jwt.verify(
        token, 
        process.env.JWT_SECRET || 'fallback-secret-key'
      );
      
      return res.json({ 
        valid: true, 
        decoded,
        expiresAt: new Date((decoded as any).exp * 1000).toISOString()
      });
    } catch (tokenError) {
      return res.status(401).json({ 
        valid: false, 
        error: tokenError.message,
        token: token.substring(0, 10) + '...' // Show part of the token for debugging
      });
    }
  } catch (error) {
    console.error('Token verification error:', error);
    res.status(500).json({ message: 'Server error during token verification' });
  }
});

export default router; 