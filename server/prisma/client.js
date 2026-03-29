const { PrismaClient } = require('@prisma/client');

// Singleton pattern — prevents connection pool exhaustion in dev (hot reload)
// and in serverless (Vercel) environments
const globalForPrisma = global;

const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

module.exports = prisma;
