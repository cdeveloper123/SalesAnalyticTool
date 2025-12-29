import { PrismaClient } from '@prisma/client';

let prisma = null;

const connectDB = async () => {
  try {
    let databaseUrl = process.env.DATABASE_URL;
    
    if (!databaseUrl && process.env.DB_HOST) {
      const host = process.env.DB_HOST;
      const port = process.env.DB_PORT || '5432';
      const database = process.env.DB_NAME;
      const user = process.env.DB_USER;
      const password = process.env.DB_PASSWORD;
      
      if (!host || !database || !user || !password) {
        console.error('Database connection string is not defined in environment variables');
        console.error('Please set DATABASE_URL or DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD');
        process.exit(1);
      }
      databaseUrl = `postgresql://${user}:${password}@${host}:${port}/${database}`;
    }
    
    if (!databaseUrl) {
      console.error('Database connection string is not defined in environment variables');
      console.error('Please set DATABASE_URL or DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD');
      process.exit(1);
    }

    // Set DATABASE_URL in process.env so Prisma can read it
    // Prisma Client reads from process.env.DATABASE_URL automatically
    if (!process.env.DATABASE_URL) {
      process.env.DATABASE_URL = databaseUrl;
    }

    // Create Prisma Client instance
    prisma = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    });

    // Test connection
    await prisma.$connect();

    const dbName = databaseUrl.split('/').pop()?.split('?')[0] || 'database';

    console.log('PostgreSQL Connected via Prisma');
    console.log(`Database: ${dbName}`);
  } catch (error) {
    console.error(`Error connecting to PostgreSQL: ${error.message}`);
    process.exit(1);
  }
};

export const getPrisma = () => {
  if (!prisma) {
    throw new Error('Database not connected. Call connectDB() first.');
  }
  return prisma;
};

export const closeDB = async () => {
  if (prisma) {
    await prisma.$disconnect();
    prisma = null;
    console.log('Database connections closed');
  }
};

export default connectDB;

