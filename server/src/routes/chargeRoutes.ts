import express, { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, authorize, restrictToOwnCharges } from '../middleware/auth';

const router = express.Router();

// Get all charges - filtered for providers
router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    // Providers can only see their own charges
    if (req.user?.role === 'PROVIDER' && req.user.providerId) {
      const charges = await prisma.charge.findMany({
        where: {
          providerId: req.user.providerId
        },
        include: {
          patient: {
            select: { firstName: true, lastName: true }
          },
          procedure: {
            select: { code: true, description: true }
          },
          payer: {
            select: { name: true }
          },
          provider: {
            select: { firstName: true, lastName: true }
          }
        },
        orderBy: { serviceDate: 'desc' }
      });
      return res.status(200).json(charges);
    }
    
    // Admins and super admins can see all charges
    const charges = await prisma.charge.findMany({
      include: {
        patient: {
          select: { firstName: true, lastName: true }
        },
        procedure: {
          select: { code: true, description: true }
        },
        payer: {
          select: { name: true }
        },
        provider: {
          select: { firstName: true, lastName: true }
        }
      },
      orderBy: { serviceDate: 'desc' }
    });
    res.status(200).json(charges);
  } catch (error) {
    console.error('Error fetching charges:', error);
    res.status(500).json({ message: 'Error fetching charges', error: String(error) });
  }
});

// Get charges by patient ID - restricted to providers for their patients
router.get('/patient/:patientId', authenticate, async (req: Request, res: Response) => {
  try {
    // For providers, check if patient belongs to them
    if (req.user?.role === 'PROVIDER' && req.user.providerId) {
      const patient = await prisma.patient.findUnique({
        where: { id: req.params.patientId }
      });
      
      if (!patient) {
        return res.status(404).json({ message: 'Patient not found' });
      }
      
      if (patient.providerId !== req.user.providerId) {
        return res.status(403).json({ message: 'Access denied to this patient\'s charges' });
      }
    }
    
    const charges = await prisma.charge.findMany({
      where: { patientId: req.params.patientId },
      include: {
        procedure: {
          select: { code: true, description: true }
        },
        payer: {
          select: { name: true }
        },
        provider: {
          select: { firstName: true, lastName: true }
        }
      },
      orderBy: { serviceDate: 'desc' }
    });
    res.status(200).json(charges);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching patient charges', error });
  }
});

// Get charges by status - filtered for providers
router.get('/status/:status', authenticate, async (req: Request, res: Response) => {
  try {
    // For providers, only show their charges with this status
    if (req.user?.role === 'PROVIDER' && req.user.providerId) {
      const charges = await prisma.charge.findMany({
        where: { 
          status: req.params.status,
          providerId: req.user.providerId
        },
        include: {
          patient: {
            select: { firstName: true, lastName: true }
          },
          procedure: {
            select: { code: true, description: true }
          },
          payer: {
            select: { name: true }
          },
          provider: {
            select: { firstName: true, lastName: true }
          }
        },
        orderBy: { serviceDate: 'desc' }
      });
      return res.status(200).json(charges);
    }
    
    // For admins, show all charges with this status
    const charges = await prisma.charge.findMany({
      where: { status: req.params.status },
      include: {
        patient: {
          select: { firstName: true, lastName: true }
        },
        procedure: {
          select: { code: true, description: true }
        },
        payer: {
          select: { name: true }
        },
        provider: {
          select: { firstName: true, lastName: true }
        }
      },
      orderBy: { serviceDate: 'desc' }
    });
    res.status(200).json(charges);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching charges by status', error });
  }
});

// Get charge by ID - restricted based on provider
router.get('/:id', authenticate, restrictToOwnCharges, async (req: Request, res: Response) => {
  try {
    const charge = await prisma.charge.findUnique({
      where: { id: req.params.id },
      include: {
        patient: true,
        procedure: true,
        payer: true,
        provider: true
      }
    });
    
    if (!charge) {
      return res.status(404).json({ message: 'Charge not found' });
    }
    
    res.status(200).json(charge);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching charge', error });
  }
});

// Create charge - providers can only create for their patients
router.post('/', authenticate, async (req: Request, res: Response) => {
  try {
    const chargeData = { ...req.body };
    
    // Providers can only create charges for their own patients
    if (req.user?.role === 'PROVIDER' && req.user.providerId) {
      // Check if patient belongs to provider
      const patient = await prisma.patient.findUnique({
        where: { id: chargeData.patientId }
      });
      
      if (!patient) {
        return res.status(400).json({ message: 'Patient not found' });
      }
      
      if (patient.providerId !== req.user.providerId) {
        return res.status(403).json({ message: 'You can only create charges for your own patients' });
      }
      
      // Force provider ID to be the logged-in provider
      chargeData.providerId = req.user.providerId;
    }
    
    // Get the procedure for unit calculation
    const procedure = await prisma.procedure.findUnique({
      where: { id: chargeData.procedureId }
    });
    
    if (!procedure) {
      return res.status(400).json({ message: 'Invalid procedure code' });
    }

    // Calculate units based on minutes
    let units = 1; // Default value
    
    if (procedure.timeBasedBilling && chargeData.minutes) {
      const minutes = chargeData.minutes;
      const minutesPerUnit = procedure.minutesPerUnit || 15;
      
      // Apply rounding rule from procedure
      switch (procedure.roundingRule) {
        case 'up':
          units = Math.ceil(minutes / minutesPerUnit);
          break;
        case 'down':
          units = Math.floor(minutes / minutesPerUnit);
          break;
        case 'nearest':
          units = Math.round(minutes / minutesPerUnit);
          break;
        default:
          units = Math.ceil(minutes / minutesPerUnit); // Default to rounding up
      }
      
      // Ensure at least 1 unit
      units = Math.max(1, units);
    }
    
    // Create the charge with calculated units
    const newCharge = await prisma.charge.create({
      data: {
        ...chargeData,
        units
      }
    });
    
    res.status(201).json(newCharge);
  } catch (error) {
    res.status(400).json({ message: 'Error creating charge', error });
  }
});

// Generate claim file for charges - admin only
router.post('/generate-claim', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), async (req: Request, res: Response) => {
  try {
    // This is a placeholder for the actual claim generation logic
    // In a real application, you would implement logic to generate
    // an X12 837 file or other format required by the clearinghouse
    
    const chargeIds = req.body.chargeIds;
    if (!chargeIds || !Array.isArray(chargeIds) || chargeIds.length === 0) {
      return res.status(400).json({ message: 'No charges selected for claim generation' });
    }
    
    // Update the status of these charges to "submitted"
    await prisma.charge.updateMany({
      where: { id: { in: chargeIds } },
      data: { 
        status: 'submitted',
        claimInfo: {
          submissionDate: new Date()
        }
      }
    });
    
    res.status(200).json({ 
      message: 'Claim file generated successfully',
      claimSubmissionDate: new Date(),
      chargesIncluded: chargeIds.length
    });
  } catch (error) {
    res.status(500).json({ message: 'Error generating claim file', error });
  }
});

// Update charge - restricted based on provider
router.put('/:id', authenticate, restrictToOwnCharges, async (req: Request, res: Response) => {
  try {
    const updateData = { ...req.body };
    
    // Providers can't change the provider of a charge
    if (req.user?.role === 'PROVIDER' && updateData.providerId !== undefined) {
      if (updateData.providerId !== req.user.providerId) {
        return res.status(403).json({ message: 'You cannot reassign charges to different providers' });
      }
    }
    
    // If minutes were updated, recalculate units
    if (updateData.minutes && updateData.procedureId) {
      const procedure = await prisma.procedure.findUnique({
        where: { id: updateData.procedureId }
      });
      
      if (procedure && procedure.timeBasedBilling) {
        const minutes = updateData.minutes;
        const minutesPerUnit = procedure.minutesPerUnit || 15;
        
        // Apply rounding rule from procedure
        let units = 1;
        switch (procedure.roundingRule) {
          case 'up':
            units = Math.ceil(minutes / minutesPerUnit);
            break;
          case 'down':
            units = Math.floor(minutes / minutesPerUnit);
            break;
          case 'nearest':
            units = Math.round(minutes / minutesPerUnit);
            break;
          default:
            units = Math.ceil(minutes / minutesPerUnit);
        }
        
        // Ensure at least 1 unit
        updateData.units = Math.max(1, units);
      }
    }
    
    const updatedCharge = await prisma.charge.update({
      where: { id: req.params.id },
      data: updateData
    });
    
    res.status(200).json(updatedCharge);
  } catch (error) {
    if ((error as any).code === 'P2025') {
      return res.status(404).json({ message: 'Charge not found' });
    }
    res.status(400).json({ message: 'Error updating charge', error });
  }
});

// Delete charge - providers can delete their own charges, admins can delete any
router.delete('/:id', authenticate, restrictToOwnCharges, async (req: Request, res: Response) => {
  try {
    // For providers, only allow deleting new charges (not submitted or paid)
    if (req.user?.role === 'PROVIDER' && req.user.providerId) {
      const charge = await prisma.charge.findUnique({
        where: { id: req.params.id }
      });
      
      if (!charge) {
        return res.status(404).json({ message: 'Charge not found' });
      }
      
      if (!['new', 'ready'].includes(charge.status)) {
        return res.status(403).json({ 
          message: 'You can only delete charges that have not been submitted or paid'
        });
      }
    }
    
    await prisma.charge.delete({
      where: { id: req.params.id }
    });
    
    res.status(200).json({ message: 'Charge deleted successfully' });
  } catch (error) {
    if ((error as any).code === 'P2025') {
      return res.status(404).json({ message: 'Charge not found' });
    }
    res.status(500).json({ message: 'Error deleting charge', error });
  }
});

export default router; 