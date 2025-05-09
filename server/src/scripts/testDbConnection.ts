import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const prisma = new PrismaClient();

async function testConnection() {
  try {
    console.log('Attempting to connect to the database...');
    
    // Try a simple query
    const result = await prisma.$queryRaw`SELECT 1 as test`;
    console.log('Connection successful!', result);
    
    // Check if the Provider table exists and has records
    try {
      const providers = await prisma.provider.findMany({ take: 5 });
      console.log(`Found ${providers.length} providers:`);
      providers.forEach(p => console.log(`- ${p.firstName} ${p.lastName}`));
    } catch (err) {
      console.error('Error querying providers:', err);
    }
    
    // Check if the Patient table exists and has records
    try {
      const patients = await prisma.patient.findMany({ take: 5 });
      console.log(`Found ${patients.length} patients:`);
      patients.forEach(p => console.log(`- ${p.firstName} ${p.lastName}`));
    } catch (err) {
      console.error('Error querying patients:', err);
    }
    
    // Print database URL (with password censored)
    const dbUrl = process.env.DATABASE_URL || '';
    const censoredUrl = dbUrl.replace(/:[^:@]*@/, ':****@');
    console.log('Database URL:', censoredUrl);
    
  } catch (error) {
    console.error('Database connection failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testConnection(); 