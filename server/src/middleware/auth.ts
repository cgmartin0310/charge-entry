import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

interface UserPayload {
  userId: string;
  email: string;
  role: string;
  providerId?: string | null;
}

// Extended Express Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: UserPayload;
    }
  }
}

// Authenticate user from JWT token
export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.header('Authorization');
    if (!authHeader) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const token = authHeader.replace('Bearer ', '');
    const decoded = jwt.verify(token, JWT_SECRET) as UserPayload;

    // Check if user exists and is active
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId }
    });

    if (!user || !user.active) {
      return res.status(401).json({ message: 'User not found or inactive' });
    }

    // Set user info on request object
    req.user = decoded;
    next();
  } catch (error) {
    console.error('Auth error:', error);
    res.status(401).json({ message: 'Invalid token' });
  }
};

// Check if user has required role
export const authorize = (roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    next();
  };
};

// Special middleware for Providers - ensure they can only access their own data
export const restrictToOwnProvider = async (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  // Super admins and admins have full access
  if (['SUPER_ADMIN', 'ADMIN'].includes(req.user.role)) {
    return next();
  }

  // Provider can only access their own data
  if (req.user.role === 'PROVIDER') {
    // Check if providerId in URL params or query matches the user's providerId
    const providerId = req.params.providerId || req.query.providerId as string;
    
    if (providerId && providerId !== req.user.providerId) {
      return res.status(403).json({ message: 'You can only access your own provider data' });
    }
  }

  next();
};

// Middleware to restrict providers to only their patients
export const restrictToOwnPatients = async (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  // Super admins and admins have full access
  if (['SUPER_ADMIN', 'ADMIN'].includes(req.user.role)) {
    return next();
  }

  // Provider can only access their own patients
  if (req.user.role === 'PROVIDER' && req.user.providerId) {
    const patientId = req.params.patientId || req.query.patientId as string;
    
    if (patientId) {
      // Check if patient belongs to provider
      const patient = await prisma.patient.findUnique({
        where: { id: patientId }
      });
      
      if (!patient || patient.providerId !== req.user.providerId) {
        return res.status(403).json({ message: 'You can only access patients assigned to you' });
      }
    }
  }

  next();
};

// Middleware to restrict providers to only their charges
export const restrictToOwnCharges = async (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  // Super admins and admins have full access
  if (['SUPER_ADMIN', 'ADMIN'].includes(req.user.role)) {
    return next();
  }

  // Provider can only access their own charges
  if (req.user.role === 'PROVIDER' && req.user.providerId) {
    const chargeId = req.params.id;
    
    if (chargeId) {
      // Check if charge belongs to provider
      const charge = await prisma.charge.findUnique({
        where: { id: chargeId }
      });
      
      if (!charge || charge.providerId !== req.user.providerId) {
        return res.status(403).json({ message: 'You can only access charges for your patients' });
      }
    }
  }

  next();
}; 