import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { prisma, testDatabaseConnection } from './lib/prisma';

// Routes import
import patientRoutes from './routes/patientRoutes';
import payerRoutes from './routes/payerRoutes';
import chargeRoutes from './routes/chargeRoutes';
import procedureRoutes from './routes/procedureRoutes';
import providerRoutes from './routes/providerRoutes';
import userRoutes from './routes/userRoutes';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5002;

// Middleware
app.use(cors());
app.use(express.json());

// Global error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ 
    message: 'An unexpected error occurred', 
    error: process.env.NODE_ENV === 'production' ? undefined : String(err) 
  });
});

// Routes
app.use('/api/users', userRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/payers', payerRoutes);
app.use('/api/charges', chargeRoutes);
app.use('/api/procedures', procedureRoutes);
app.use('/api/providers', providerRoutes);

// Health check endpoint
app.get('/health', async (req, res) => {
  const dbStatus = await testDatabaseConnection();
  res.status(200).json({ 
    status: 'ok',
    database: dbStatus ? 'connected' : 'connection failed'
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