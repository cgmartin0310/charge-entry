import { Router, Request, Response } from 'express';
import { prisma, ensureFreshConnection } from '../lib/prisma';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key';

// TEMPORARY: Emergency admin creation route
router.get('/create-recovery-admin', async (req: Request, res: Response) => {
  try {
    const existingAdmin = await prisma.user.findUnique({
      where: { email: 'recovery@example.com' }
    });

    if (existingAdmin) {
      return res.json({
        message: 'Recovery admin already exists',
        email: 'recovery@example.com',
        password: 'Recovery123!'
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash('Recovery123!', salt);

    // Create recovery admin
    const admin = await prisma.user.create({
      data: {
        email: 'recovery@example.com',
        username: 'recovery',
        passwordHash,
        role: 'SUPER_ADMIN',
        active: true
      }
    });

    return res.json({
      message: 'Recovery admin created successfully',
      email: 'recovery@example.com',
      password: 'Recovery123!'
    });
  } catch (error) {
    console.error('Emergency admin creation error:', error);
    return res.status(500).json({ message: 'Failed to create recovery admin', error });
  }
});

// Login route
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    
    // Ensure fresh database connection
    await ensureFreshConnection();
    
    // Validate request
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
      include: { provider: true }
    });

    if (!user || !user.active) {
      return res.status(401).json({ message: 'Invalid credentials or inactive account' });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() }
    });

    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: user.id, 
        email: user.email, 
        role: user.role,
        providerId: user.providerId 
      }, 
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    // Return user info and token
    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
        providerId: user.providerId,
        provider: user.provider ? {
          id: user.provider.id,
          firstName: user.provider.firstName,
          lastName: user.provider.lastName
        } : null
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Register new user - restricted to admins and super admins
router.post('/register', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), async (req: Request, res: Response) => {
  try {
    const { email, username, password, role, providerId } = req.body;

    // Validate request
    if (!email || !username || !password || !role) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Validate role
    const validRoles = ['SUPER_ADMIN', 'ADMIN', 'PROVIDER'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ message: 'Invalid role' });
    }

    // Check additional access restrictions
    if (role === 'SUPER_ADMIN' && req.user?.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ message: 'Only super admins can create super admin accounts' });
    }

    // Check if provider exists for PROVIDER role
    if (role === 'PROVIDER' && providerId) {
      const provider = await prisma.provider.findUnique({ where: { id: providerId } });
      if (!provider) {
        return res.status(400).json({ message: 'Provider not found' });
      }

      // Check if provider already has a user account
      const existingProviderUser = await prisma.user.findUnique({ where: { providerId } });
      if (existingProviderUser) {
        return res.status(400).json({ message: 'Provider already has a user account' });
      }
    }

    // Check if email already exists
    const existingEmail = await prisma.user.findUnique({ where: { email } });
    if (existingEmail) {
      return res.status(400).json({ message: 'Email already in use' });
    }

    // Check if username already exists
    const existingUsername = await prisma.user.findUnique({ where: { username } });
    if (existingUsername) {
      return res.status(400).json({ message: 'Username already in use' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        username,
        passwordHash,
        role,
        providerId: role === 'PROVIDER' ? providerId : null
      }
    });

    res.status(201).json({
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
      providerId: user.providerId,
      createdAt: user.createdAt
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all users - restricted to super admins and admins
router.get('/', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), async (req: Request, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      include: {
        provider: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          }
        }
      },
      orderBy: { username: 'asc' }
    });

    // Filter sensitive data
    const sanitizedUsers = users.map(user => ({
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
      active: user.active,
      lastLogin: user.lastLogin,
      createdAt: user.createdAt,
      provider: user.provider ? {
        id: user.provider.id,
        firstName: user.provider.firstName,
        lastName: user.provider.lastName,
        fullName: `${user.provider.lastName}, ${user.provider.firstName}`
      } : null
    }));

    res.json(sanitizedUsers);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user by ID - users can view their own details, admins can view any
router.get('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Check permissions
    if (req.user?.role === 'PROVIDER' && req.user.userId !== id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        provider: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          }
        }
      }
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Return user without password hash
    res.json({
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
      active: user.active,
      lastLogin: user.lastLogin,
      createdAt: user.createdAt,
      provider: user.provider ? {
        id: user.provider.id,
        firstName: user.provider.firstName,
        lastName: user.provider.lastName,
        fullName: `${user.provider.lastName}, ${user.provider.firstName}`
      } : null
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update user - admins can update any user, users can update some of their own fields
router.put('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { email, username, password, role, active, providerId } = req.body;

    // Check permissions
    if (req.user?.role === 'PROVIDER' && req.user.userId !== id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Find user to update
    const existingUser = await prisma.user.findUnique({ where: { id } });
    if (!existingUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Provider users can only update their own email, username, or password
    if (req.user?.role === 'PROVIDER') {
      if (role || active !== undefined || providerId) {
        return res.status(403).json({ message: 'You can only update your own profile information' });
      }
    }

    // Check if email is taken
    if (email && email !== existingUser.email) {
      const emailInUse = await prisma.user.findUnique({ where: { email } });
      if (emailInUse) {
        return res.status(400).json({ message: 'Email already in use' });
      }
    }

    // Check if username is taken
    if (username && username !== existingUser.username) {
      const usernameInUse = await prisma.user.findUnique({ where: { username } });
      if (usernameInUse) {
        return res.status(400).json({ message: 'Username already in use' });
      }
    }

    // Restrict role changes
    if (role && role !== existingUser.role) {
      // Only super admins can change to or from SUPER_ADMIN
      if ((role === 'SUPER_ADMIN' || existingUser.role === 'SUPER_ADMIN') && req.user?.role !== 'SUPER_ADMIN') {
        return res.status(403).json({ message: 'Only super admins can change super admin roles' });
      }
    }

    // Prepare update data
    const updateData: any = {};
    if (email) updateData.email = email;
    if (username) updateData.username = username;
    
    // Update password if provided
    if (password) {
      const salt = await bcrypt.genSalt(10);
      updateData.passwordHash = await bcrypt.hash(password, salt);
    }
    
    // Only admins and super admins can update these fields
    if (['ADMIN', 'SUPER_ADMIN'].includes(req.user?.role || '')) {
      if (role) updateData.role = role;
      if (active !== undefined) updateData.active = active;
      
      // Provider link can only be changed by admins
      if (role === 'PROVIDER' && providerId) {
        // Check if provider exists
        const provider = await prisma.provider.findUnique({ where: { id: providerId } });
        if (!provider) {
          return res.status(400).json({ message: 'Provider not found' });
        }

        // Check if provider already has a user (other than this one)
        const existingProviderUser = await prisma.user.findUnique({ 
          where: { providerId } 
        });
        
        if (existingProviderUser && existingProviderUser.id !== id) {
          return res.status(400).json({ message: 'Provider already has a user account' });
        }
        
        updateData.providerId = providerId;
      } else if (role && role !== 'PROVIDER') {
        // If changing role away from provider, remove provider link
        updateData.providerId = null;
      }
    }

    // Update user
    const updatedUser = await prisma.user.update({
      where: { id },
      data: updateData,
      include: {
        provider: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          }
        }
      }
    });

    // Return updated user without password hash
    res.json({
      id: updatedUser.id,
      email: updatedUser.email,
      username: updatedUser.username,
      role: updatedUser.role,
      active: updatedUser.active,
      lastLogin: updatedUser.lastLogin,
      createdAt: updatedUser.createdAt,
      provider: updatedUser.provider ? {
        id: updatedUser.provider.id,
        firstName: updatedUser.provider.firstName,
        lastName: updatedUser.provider.lastName,
        fullName: `${updatedUser.provider.lastName}, ${updatedUser.provider.firstName}`
      } : null
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete user - only super admins can delete users
router.delete('/:id', authenticate, authorize(['SUPER_ADMIN']), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Check if user exists
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Delete user
    await prisma.user.delete({ where: { id } });

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Change password - users can change their own password
router.post('/change-password', authenticate, async (req: Request, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user?.userId;

    if (!userId || !currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Get user
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Verify current password
    const isPasswordValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Current password is incorrect' });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    // Update password
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash }
    });

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get current user profile
router.get('/me/profile', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const user = await prisma.user.findUnique({ 
      where: { id: userId },
      include: {
        provider: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          }
        }
      }
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Return user without password hash
    res.json({
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
      providerId: user.providerId,
      provider: user.provider ? {
        id: user.provider.id,
        firstName: user.provider.firstName,
        lastName: user.provider.lastName,
        fullName: `${user.provider.lastName}, ${user.provider.firstName}`
      } : null
    });
  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router; 