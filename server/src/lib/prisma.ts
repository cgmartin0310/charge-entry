import { PrismaClient } from '@prisma/client';

// PrismaClient is attached to the `global` object in development to prevent
// exhausting your database connection limit.
const globalForPrisma = global as unknown as { prisma: PrismaClient };

// Function to create and configure Prisma client
function createPrismaClient() {
  return new PrismaClient({
    log: ['error'],
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  });
}

// Reuse PrismaClient instance or create a new one
const prisma = globalForPrisma.prisma || createPrismaClient();

// Fix for "prepared statement already exists" error
let isConnected = false;

// Helper function to ensure fresh connection
async function ensureFreshConnection() {
  if (isConnected) {
    try {
      // Disconnect to prevent prepared statement conflicts
      await prisma.$disconnect();
      isConnected = false;
    } catch (e) {
      console.error("Error disconnecting from database:", e);
    }
  }
  
  try {
    // Test connection
    await prisma.$connect();
    isConnected = true;
  } catch (e) {
    console.error("Error connecting to database:", e);
    throw e;
  }
}

// Function to test database connection
export async function testDatabaseConnection() {
  try {
    await ensureFreshConnection();
    // Simple query to test connection
    await prisma.$queryRaw`SELECT 1`;
    console.log('Database connection successful');
    return true;
  } catch (error) {
    console.error('Database connection failed:', error);
    return false;
  }
}

// Handle Node.js process events
process.on('beforeExit', async () => {
  // Close database connections before exiting
  await prisma.$disconnect();
  isConnected = false;
});

// Unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Save prisma client in global object in development
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export { prisma, ensureFreshConnection }; 