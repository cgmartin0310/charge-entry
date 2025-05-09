import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const prisma = new PrismaClient();

const createSuperAdmin = async () => {
  try {
    // Check if super admin already exists
    const existingAdmin = await prisma.user.findFirst({
      where: { role: 'SUPER_ADMIN' }
    });

    if (existingAdmin) {
      console.log('A super admin user already exists:');
      console.log(`Username: ${existingAdmin.username}`);
      console.log(`Email: ${existingAdmin.email}`);
      console.log('No new super admin created.');
      return;
    }

    // Set the super admin details
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

    console.log('Super admin user created successfully!');
    console.log(`Username: ${superAdmin.username}`);
    console.log(`Email: ${superAdmin.email}`);
    console.log(`Password: ${adminDetails.password}`);
    console.log('Please change the password after first login.');
  } catch (error) {
    console.error('Error creating super admin:', error);
  } finally {
    await prisma.$disconnect();
  }
};

// Run the function
createSuperAdmin(); 