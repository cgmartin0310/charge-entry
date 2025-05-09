// This file exists only to satisfy TypeScript during the build process
// The actual database operations use Prisma, not Mongoose

// Mock export of Mongoose models to satisfy imports in other files
export const Patient = {
  findById: async () => ({}),
  findOne: async () => ({}),
  find: async () => ([]),
  create: async () => ({})
};

export const Provider = {
  findById: async () => ({}),
  findOne: async () => ({}),
  find: async () => ([]),
  create: async () => ({})
};

export const Procedure = {
  findById: async () => ({}),
  findOne: async () => ({}),
  find: async () => ([]),
  create: async () => ({})
};

export const Payer = {
  findById: async () => ({}),
  findOne: async () => ({}),
  find: async () => ([]),
  create: async () => ({})
};

export const Charge = {
  findById: async () => ({}),
  findOne: async () => ({}),
  find: async () => ([]),
  create: async () => ({})
};

// Default export to satisfy any direct imports of the file
export default {
  Patient,
  Provider,
  Procedure,
  Payer,
  Charge
}; 