import express, { Request, Response } from 'express';
import { prisma } from '../lib/prisma';

const router = express.Router();

// Get all payers
router.get('/', async (req: Request, res: Response) => {
  try {
    const payers = await prisma.payer.findMany({
      orderBy: { name: 'asc' }
    });
    res.status(200).json(payers);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching payers', error });
  }
});

// Search payers by name
router.get('/search/:query', async (req: Request, res: Response) => {
  try {
    const searchQuery = req.params.query;
    const payers = await prisma.payer.findMany({
      where: {
        name: { contains: searchQuery, mode: 'insensitive' }
      },
      orderBy: { name: 'asc' }
    });
    
    res.status(200).json(payers);
  } catch (error) {
    res.status(500).json({ message: 'Error searching payers', error });
  }
});

// Get payer by ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const payer = await prisma.payer.findUnique({
      where: { id: req.params.id }
    });
    
    if (!payer) {
      return res.status(404).json({ message: 'Payer not found' });
    }
    
    res.status(200).json(payer);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching payer', error });
  }
});

// Create payer
router.post('/', async (req: Request, res: Response) => {
  try {
    const newPayer = await prisma.payer.create({
      data: req.body
    });
    
    res.status(201).json(newPayer);
  } catch (error) {
    res.status(400).json({ message: 'Error creating payer', error });
  }
});

// Update payer
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const updatedPayer = await prisma.payer.update({
      where: { id: req.params.id },
      data: req.body
    });
    
    res.status(200).json(updatedPayer);
  } catch (error) {
    if ((error as any).code === 'P2025') {
      return res.status(404).json({ message: 'Payer not found' });
    }
    res.status(400).json({ message: 'Error updating payer', error });
  }
});

// Delete payer
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await prisma.payer.delete({
      where: { id: req.params.id }
    });
    
    res.status(200).json({ message: 'Payer deleted successfully' });
  } catch (error) {
    if ((error as any).code === 'P2025') {
      return res.status(404).json({ message: 'Payer not found' });
    }
    res.status(500).json({ message: 'Error deleting payer', error });
  }
});

export default router; 