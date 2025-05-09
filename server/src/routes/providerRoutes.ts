import express, { Request, Response } from 'express';
import { prisma } from '../lib/prisma';

const router = express.Router();

// Get all providers
router.get('/', async (req: Request, res: Response) => {
  try {
    const providers = await prisma.provider.findMany({
      orderBy: [
        { lastName: 'asc' },
        { firstName: 'asc' }
      ]
    });
    res.status(200).json(providers);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching providers', error });
  }
});

// Search providers by name
router.get('/search/:query', async (req: Request, res: Response) => {
  try {
    const searchQuery = req.params.query;
    const providers = await prisma.provider.findMany({
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
    
    res.status(200).json(providers);
  } catch (error) {
    res.status(500).json({ message: 'Error searching providers', error });
  }
});

// Get provider by ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const provider = await prisma.provider.findUnique({
      where: { id: req.params.id }
    });
    
    if (!provider) {
      return res.status(404).json({ message: 'Provider not found' });
    }
    
    res.status(200).json(provider);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching provider', error });
  }
});

// Create provider
router.post('/', async (req: Request, res: Response) => {
  try {
    const newProvider = await prisma.provider.create({
      data: req.body
    });
    
    res.status(201).json(newProvider);
  } catch (error) {
    res.status(400).json({ message: 'Error creating provider', error });
  }
});

// Update provider
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const updatedProvider = await prisma.provider.update({
      where: { id: req.params.id },
      data: req.body
    });
    
    res.status(200).json(updatedProvider);
  } catch (error) {
    if ((error as any).code === 'P2025') {
      return res.status(404).json({ message: 'Provider not found' });
    }
    res.status(400).json({ message: 'Error updating provider', error });
  }
});

// Delete provider
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await prisma.provider.delete({
      where: { id: req.params.id }
    });
    
    res.status(200).json({ message: 'Provider deleted successfully' });
  } catch (error) {
    if ((error as any).code === 'P2025') {
      return res.status(404).json({ message: 'Provider not found' });
    }
    res.status(500).json({ message: 'Error deleting provider', error });
  }
});

export default router; 