import express, { Request, Response } from 'express';
import { prisma } from '../lib/prisma';

const router = express.Router();

// Get all procedures
router.get('/', async (req: Request, res: Response) => {
  try {
    const procedures = await prisma.procedure.findMany({
      orderBy: { code: 'asc' }
    });
    res.status(200).json(procedures);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching procedures', error });
  }
});

// Search procedures by code or description
router.get('/search/:query', async (req: Request, res: Response) => {
  try {
    const searchQuery = req.params.query;
    const procedures = await prisma.procedure.findMany({
      where: {
        OR: [
          { code: { contains: searchQuery, mode: 'insensitive' } },
          { description: { contains: searchQuery, mode: 'insensitive' } }
        ]
      },
      orderBy: { code: 'asc' }
    });
    
    res.status(200).json(procedures);
  } catch (error) {
    res.status(500).json({ message: 'Error searching procedures', error });
  }
});

// Get procedure by ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const procedure = await prisma.procedure.findUnique({
      where: { id: req.params.id }
    });
    
    if (!procedure) {
      return res.status(404).json({ message: 'Procedure not found' });
    }
    
    res.status(200).json(procedure);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching procedure', error });
  }
});

// Create procedure
router.post('/', async (req: Request, res: Response) => {
  try {
    const newProcedure = await prisma.procedure.create({
      data: req.body
    });
    
    res.status(201).json(newProcedure);
  } catch (error) {
    res.status(400).json({ message: 'Error creating procedure', error });
  }
});

// Update procedure
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const updatedProcedure = await prisma.procedure.update({
      where: { id: req.params.id },
      data: req.body
    });
    
    res.status(200).json(updatedProcedure);
  } catch (error) {
    if ((error as any).code === 'P2025') {
      return res.status(404).json({ message: 'Procedure not found' });
    }
    res.status(400).json({ message: 'Error updating procedure', error });
  }
});

// Delete procedure
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await prisma.procedure.delete({
      where: { id: req.params.id }
    });
    
    res.status(200).json({ message: 'Procedure deleted successfully' });
  } catch (error) {
    if ((error as any).code === 'P2025') {
      return res.status(404).json({ message: 'Procedure not found' });
    }
    res.status(500).json({ message: 'Error deleting procedure', error });
  }
});

export default router; 