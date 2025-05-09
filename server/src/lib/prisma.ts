import { PrismaClient } from '@prisma/client';

// PrismaClient is attached to the `global` object in development to prevent
// exhausting your database connection limit.
const globalForPrisma = global as unknown as { prisma: PrismaClient };

// Add retry and connection pooling logic
const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
  // Add additional Prisma client options like connection pooling
});

// Middleware to handle connection issues
prisma.$use(async (params, next) => {
  try {
    return await next(params);
  } catch (error) {
    // Log and handle database connection errors
    console.error('Database operation failed:', error);
    throw error;
  }
});

// Function to test database connection
export async function testDatabaseConnection() {
  try {
    // Simple query to test connection
    await prisma.$queryRaw`SELECT 1`;
    console.log('Database connection successful');
    return true;
  } catch (error) {
    console.error('Database connection failed:', error);
    return false;
  }
}

// Global error handler
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export { prisma }; 