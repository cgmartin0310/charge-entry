import express, { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, authorize, restrictToOwnPatients } from '../middleware/auth';

const router = express.Router();

// Get all patients - filtered for providers to only see their patients
router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    // Providers can only see their own patients
    if (req.user?.role === 'PROVIDER' && req.user.providerId) {
      const patients = await prisma.patient.findMany({
        where: {
          providerId: req.user.providerId
        },
        orderBy: [
          { lastName: 'asc' },
          { firstName: 'asc' }
        ]
      });
      return res.status(200).json(patients);
    }
    
    // Admins and super admins can see all patients
    const patients = await prisma.patient.findMany({
      orderBy: [
        { lastName: 'asc' },
        { firstName: 'asc' }
      ]
    });
    res.status(200).json(patients);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching patients', error });
  }
});

// Search patients - filtered for providers
router.get('/search/:query', authenticate, async (req: Request, res: Response) => {
  try {
    const searchQuery = req.params.query;
    
    // Provider-specific search
    if (req.user?.role === 'PROVIDER' && req.user.providerId) {
      const patients = await prisma.patient.findMany({
        where: {
          providerId: req.user.providerId,
          OR: [
            { firstName: { contains: searchQuery, mode: 'insensitive' } },
            { lastName: { contains: searchQuery, mode: 'insensitive' } }
          ]
        },
        orderBy: [
          { lastName: 'asc' },
          { firstName: 'asc' }
        ]
      });
      
      return res.status(200).json(patients);
    }
    
    // Admin search (all patients)
    const patients = await prisma.patient.findMany({
      where: {
        OR: [
          { firstName: { contains: searchQuery, mode: 'insensitive' } },
          { lastName: { contains: searchQuery, mode: 'insensitive' } }
        ]
      },
      orderBy: [
        { lastName: 'asc' },
        { firstName: 'asc' }
      ]
    });
    
    res.status(200).json(patients);
  } catch (error) {
    res.status(500).json({ message: 'Error searching patients', error });
  }
});

// Get patient by ID - restricted to own patients for providers
router.get('/:id', authenticate, restrictToOwnPatients, async (req: Request, res: Response) => {
  try {
    const patient = await prisma.patient.findUnique({
      where: { id: req.params.id }
    });
    
    if (!patient) {
      return res.status(404).json({ message: 'Patient not found' });
    }
    
    res.status(200).json(patient);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching patient', error });
  }
});

// Create patient - providers can only create for themselves
router.post('/', authenticate, async (req: Request, res: Response) => {
  try {
    const patientData = { ...req.body };
    
    // If provider is creating a patient, automatically assign to self
    if (req.user?.role === 'PROVIDER' && req.user.providerId) {
      patientData.providerId = req.user.providerId;
    }
    
    // Only admins can explicitly set provider
    if (req.body.providerId && req.user?.role === 'PROVIDER') {
      // Ensure provider can only assign to themselves
      if (req.body.providerId !== req.user.providerId) {
        return res.status(403).json({ 
          message: 'As a provider, you can only create patients assigned to yourself' 
        });
      }
    }
    
    const newPatient = await prisma.patient.create({
      data: patientData
    });
    
    res.status(201).json(newPatient);
  } catch (error) {
    res.status(400).json({ message: 'Error creating patient', error });
  }
});

// Update patient - restricted to own patients for providers
router.put('/:id', authenticate, restrictToOwnPatients, async (req: Request, res: Response) => {
  try {
    const patientData = { ...req.body };
    
    // Providers cannot change the provider assignment
    if (req.user?.role === 'PROVIDER' && patientData.providerId !== undefined) {
      // Can only keep assigned to themselves
      if (patientData.providerId !== req.user.providerId) {
        return res.status(403).json({
          message: 'As a provider, you cannot reassign patients to different providers'
        });
      }
    }
    
    const updatedPatient = await prisma.patient.update({
      where: { id: req.params.id },
      data: patientData
    });
    
    res.status(200).json(updatedPatient);
  } catch (error) {
    if ((error as any).code === 'P2025') {
      return res.status(404).json({ message: 'Patient not found' });
    }
    res.status(400).json({ message: 'Error updating patient', error });
  }
});

// Delete patient - restricted to admins
router.delete('/:id', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), async (req: Request, res: Response) => {
  try {
    await prisma.patient.delete({
      where: { id: req.params.id }
    });
    
    res.status(200).json({ message: 'Patient deleted successfully' });
  } catch (error) {
    if ((error as any).code === 'P2025') {
      return res.status(404).json({ message: 'Patient not found' });
    }
    res.status(500).json({ message: 'Error deleting patient', error });
  }
});

export default router; 