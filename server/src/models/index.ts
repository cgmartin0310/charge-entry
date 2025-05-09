// This file should be imported instead of individual mongoose models
import { prisma } from '../lib/prisma';

// Re-export prisma models with their repositories
export const Patient = prisma.patient;
export const Provider = prisma.provider;
export const Procedure = prisma.procedure;
export const Payer = prisma.payer;
export const Charge = prisma.charge;
export const User = prisma.user;

export default {
  Patient,
  Provider,
  Procedure,
  Payer,
  Charge,
  User
}; 