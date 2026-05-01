import 'dotenv-flow/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

declare global {
  var prismadb: PrismaClient | undefined;
}

// Create PostgreSQL connection pool with SSL configuration
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.DATABASE_SSL === 'true'
      ? {
          rejectUnauthorized:
            process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false',
        }
      : false,
});

// Create the PostgreSQL adapter for Prisma v7
const adapter = new PrismaPg(pool);

// Use the existing instance if it exists, otherwise create a new one
// In Prisma v7, a driver adapter is required for database connections
const prisma = globalThis.prismadb || new PrismaClient({ adapter });

// Only assign it in development to avoid multiple instances in dev reloads
if (process.env.NODE_ENV !== 'production') globalThis.prismadb = prisma;

export default prisma;
