import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { prisma, testDatabaseConnection, ensureFreshConnection } from './lib/prisma';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

// Routes import
import patientRoutes from './routes/patientRoutes';
import payerRoutes from './routes/payerRoutes';
import chargeRoutes from './routes/chargeRoutes';
import procedureRoutes from './routes/procedureRoutes';
import providerRoutes from './routes/providerRoutes';
import userRoutes from './routes/userRoutes';
import authRoutes from './routes/auth';
import documentProcessingRoutes from './routes/documentProcessingRoutes';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5002;
const prismaClient = new PrismaClient();

// CORS configuration - Accept all origins in development mode
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Increase body size limit for image uploads (50MB max)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Routes
app.use('/api/users', userRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/payers', payerRoutes);
app.use('/api/charges', chargeRoutes);
app.use('/api/procedures', procedureRoutes);
app.use('/api/providers', providerRoutes);
app.use('/api/document-processing', documentProcessingRoutes);

// Debug route to check the API is accessible
app.get('/api/debug', (req, res) => {
  res.json({
    message: 'API is accessible',
    time: new Date().toISOString(),
    nodeEnv: process.env.NODE_ENV,
    corsEnabled: true,
    jwt: {
      secretDefined: !!process.env.JWT_SECRET,
      secretLength: process.env.JWT_SECRET ? process.env.JWT_SECRET.length : 0
    }
  });
});

// Admin setup endpoint - accessible at /api/admin-setup
app.get('/api/admin-setup', async (req, res) => {
  try {
    // Ensure fresh database connection
    await ensureFreshConnection();
    
    // Check if super admin already exists
    const existingAdmin = await prisma.user.findFirst({
      where: { role: 'SUPER_ADMIN' }
    });

    if (existingAdmin) {
      return res.json({
        message: 'A super admin user already exists',
        email: existingAdmin.email,
        username: existingAdmin.username
      });
    }

    // Admin details
    const adminDetails = {
      username: 'admin',
      email: 'admin@example.com',
      password: 'Admin123!', // This should be changed after first login
      role: 'SUPER_ADMIN'
    };

    // Hash the password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(adminDetails.password, salt);

    // Create the super admin
    const superAdmin = await prisma.user.create({
      data: {
        username: adminDetails.username,
        email: adminDetails.email,
        passwordHash,
        role: adminDetails.role,
        active: true
      }
    });

    return res.json({
      message: 'Super admin user created successfully!',
      email: superAdmin.email,
      username: superAdmin.username,
      password: adminDetails.password
    });
  } catch (error: any) {
    return res.status(500).json({
      message: 'Error creating admin user',
      error: error.message
    });
  }
});

// Reset admin password endpoint
app.get('/api/reset-admin-password', async (req, res) => {
  try {
    // Ensure fresh database connection
    await ensureFreshConnection();
    
    // Find the admin user
    const adminUser = await prisma.user.findFirst({
      where: { role: 'SUPER_ADMIN' }
    });

    if (!adminUser) {
      return res.status(404).json({
        message: 'No admin user found'
      });
    }

    // Set password to Admin123!
    const password = 'Admin123!';
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Update the admin password
    await prisma.user.update({
      where: { id: adminUser.id },
      data: { passwordHash }
    });

    return res.json({
      message: 'Admin password has been reset successfully',
      email: adminUser.email,
      username: adminUser.username,
      password: password
    });
  } catch (error: any) {
    return res.status(500).json({
      message: 'Error resetting admin password',
      error: error.message
    });
  }
});

// Test login endpoint directly
app.post('/api/test-login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
      include: { provider: true }
    });

    if (!user || !user.active) {
      return res.status(401).json({ 
        message: 'Invalid credentials or inactive account',
        user: null,
        passwordMatch: false
      });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    
    if (!isPasswordValid) {
      return res.status(401).json({ 
        message: 'Invalid credentials - password does not match',
        user: {
          email: user.email,
          username: user.username
        },
        passwordMatch: false,
        passwordHash: user.passwordHash.substring(0, 10) + '...' // First 10 chars for debugging
      });
    }

    return res.json({
      message: 'Login successful via test endpoint',
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role
      },
      passwordMatch: true
    });
  } catch (error: any) {
    return res.status(500).json({
      message: 'Error testing login',
      error: error.message
    });
  }
});

// Health check endpoint
app.get('/health', async (req, res) => {
  const dbStatus = await testDatabaseConnection();
  res.status(200).json({ 
    status: 'ok',
    database: dbStatus ? 'connected' : 'connection failed'
  });
});

// Global error handler - should be after all routes
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ 
    message: 'An unexpected error occurred', 
    error: process.env.NODE_ENV === 'production' ? undefined : String(err) 
  });
});

// Start the server
async function startServer() {
  try {
    // Test database connection before starting the server
    const dbConnected = await testDatabaseConnection();
    if (!dbConnected) {
      console.warn('WARNING: Could not connect to database. Some features may not work properly.');
    }
    
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer(); 