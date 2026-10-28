import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

// Initialize the Prisma driver adapter from environment variables.
// Local dev falls back to the XAMPP defaults, but production MUST set
// DB_USER/DB_PASSWORD (non-root, strong password) in .env — no secrets in code.
const adapter = new PrismaMariaDb({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'api',
  connectionLimit: 10,
});

// Prevent multiple instances of Prisma Client in development
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({ adapter });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;