import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: 'postgresql://postgres@localhost:5432/postgres'
      }
    }
  });
  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log('Success!');
  } catch (err: any) {
    console.error('Error Details:', err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
