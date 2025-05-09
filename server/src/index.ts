import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { prisma, testDatabaseConnection } from './lib/prisma';
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

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5002;
const prismaClient = new PrismaClient();

// CORS configuration
const allowedOrigins = [
  'http://localhost:3000',
  'https://charge-entry.onrender.com' // Updated Render frontend URL
];

// Middleware
app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  credentials: true
}));
app.use(express.json());

// Routes
app.use('/api/users', userRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/payers', payerRoutes);
app.use('/api/charges', chargeRoutes);
app.use('/api/procedures', procedureRoutes);
app.use('/api/providers', providerRoutes);

// Admin setup endpoint - accessible at /api/admin-setup
app.get('/api/admin-setup', async (req, res) => {
  try {
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