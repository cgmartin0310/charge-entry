import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Clear existing data
  await prisma.charge.deleteMany({});
  await prisma.patient.deleteMany({});
  await prisma.provider.deleteMany({});
  await prisma.payer.deleteMany({});
  await prisma.procedure.deleteMany({});
  await prisma.user.deleteMany({});

  console.log('Seeding database...');

  // Create payers
  const medicare = await prisma.payer.create({
    data: {
      name: 'Medicare',
      payerId: 'MCR001',
      address: {
        street: '7500 Security Boulevard',
        city: 'Baltimore',
        state: 'MD',
        zipCode: '21244'
      },
      phone: '1-800-633-4227',
      email: 'info@medicare.gov',
      electronicPayer: true,
      payerType: 'Medicare'
    }
  });

  const medicaid = await prisma.payer.create({
    data: {
      name: 'Medicaid',
      payerId: 'MCD001',
      address: {
        street: '7500 Security Boulevard',
        city: 'Baltimore',
        state: 'MD',
        zipCode: '21244'
      },
      phone: '1-877-267-2323',
      email: 'info@medicaid.gov',
      electronicPayer: true,
      payerType: 'Medicaid'
    }
  });

  const blueCross = await prisma.payer.create({
    data: {
      name: 'Blue Cross Blue Shield',
      payerId: 'BCBS001',
      address: {
        street: '225 N. Michigan Ave',
        city: 'Chicago',
        state: 'IL',
        zipCode: '60601'
      },
      phone: '1-800-442-2376',
      email: 'info@bcbs.com',
      electronicPayer: true,
      payerType: 'BlueCross'
    }
  });

  console.log('Created payers');

  // Create procedures
  const procedure1 = await prisma.procedure.create({
    data: {
      code: 'H0038',
      description: 'Self-help/peer services, per 15 minutes',
      defaultUnits: 1,
      timeBasedBilling: true,
      roundingRule: 'up',
      minutesPerUnit: 15,
      validModifiers: ['GT', 'HQ']
    }
  });

  const procedure2 = await prisma.procedure.create({
    data: {
      code: 'H0039',
      description: 'Assertive community treatment, per 15 minutes',
      defaultUnits: 1,
      timeBasedBilling: true,
      roundingRule: 'up',
      minutesPerUnit: 15,
      validModifiers: ['GT', 'HQ']
    }
  });

  console.log('Created procedures');

  // Create providers
  const provider1 = await prisma.provider.create({
    data: {
      firstName: 'Alice',
      lastName: 'Johnson',
      npi: '1234567890',
      credentials: 'MD',
      specialty: 'Psychiatry',
      email: 'alice.johnson@example.com',
      phone: '555-123-4567',
      address: {
        street: '789 Medical Center Blvd',
        city: 'Medicaltown',
        state: 'TX',
        zipCode: '75001'
      },
      status: 'active'
    }
  });

  const provider2 = await prisma.provider.create({
    data: {
      firstName: 'Robert',
      lastName: 'Williams',
      npi: '0987654321',
      credentials: 'NP',
      specialty: 'Mental Health',
      email: 'robert.williams@example.com',
      phone: '555-987-6543',
      address: {
        street: '456 Healthcare Ave',
        city: 'Wellness',
        state: 'CA',
        zipCode: '90001'
      },
      status: 'active'
    }
  });

  console.log('Created providers');

  // Create patients
  const patient1 = await prisma.patient.create({
    data: {
      firstName: 'John',
      lastName: 'Doe',
      dateOfBirth: new Date('1980-05-15'),
      gender: 'male',
      address: {
        street: '123 Main St',
        city: 'Anytown',
        state: 'NY',
        zipCode: '12345'
      },
      phone: '555-123-4567',
      email: 'john.doe@example.com',
      insuranceInfo: {
        primary: {
          payerId: medicare.id,
          memberId: 'MCR123456789',
          groupNumber: ''
        }
      },
      provider: {
        connect: { id: provider1.id }
      }
    }
  });

  const patient2 = await prisma.patient.create({
    data: {
      firstName: 'Jane',
      lastName: 'Smith',
      dateOfBirth: new Date('1975-10-20'),
      gender: 'female',
      address: {
        street: '456 Oak Ave',
        city: 'Othertown',
        state: 'CA',
        zipCode: '98765'
      },
      phone: '555-987-6543',
      email: 'jane.smith@example.com',
      insuranceInfo: {
        primary: {
          payerId: blueCross.id,
          memberId: 'BCBS987654321',
          groupNumber: 'GRP123'
        }
      },
      provider: {
        connect: { id: provider2.id }
      }
    }
  });

  console.log('Created patients');

  // Create charges
  const charge1 = await prisma.charge.create({
    data: {
      patient: {
        connect: { id: patient1.id }
      },
      serviceDate: new Date(),
      provider: {
        connect: { id: provider1.id }
      },
      procedure: {
        connect: { id: procedure1.id }
      },
      minutes: 45,
      units: 3,
      modifiers: ['GT'],
      diagnosisCodes: ['F41.9'],
      chargeAmount: 75.00,
      status: 'new',
      payer: {
        connect: { id: medicare.id }
      },
      claimInfo: {},
      notes: 'Initial peer support session'
    }
  });

  const charge2 = await prisma.charge.create({
    data: {
      patient: {
        connect: { id: patient2.id }
      },
      serviceDate: new Date(),
      provider: {
        connect: { id: provider2.id }
      },
      procedure: {
        connect: { id: procedure2.id }
      },
      minutes: 60,
      units: 4,
      modifiers: ['GT', 'HQ'],
      diagnosisCodes: ['F33.1'],
      chargeAmount: 100.00,
      status: 'new',
      payer: {
        connect: { id: blueCross.id }
      },
      claimInfo: {},
      notes: 'Group session with good participation'
    }
  });

  console.log('Created charges');

  // Create admin user
  const adminUser = await prisma.user.create({
    data: {
      email: 'admin@example.com',
      username: 'admin',
      passwordHash: '$2a$10$mFpGojFrQj8L5ORnfFm/4.mSRDrTUXE/j6KRVlR0gExj4qVoJCXwa', // Admin123!
      role: 'SUPER_ADMIN',
      active: true
    }
  });

  console.log('Created admin user (admin@example.com / Admin123!)');
  console.log('Database seeding completed');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  }); 