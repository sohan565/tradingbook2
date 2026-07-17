import prisma from '../src/lib/db';

async function main() {
  console.log('Testing Prisma connection...');
  try {
    const sessionCount = await prisma.backtestSession.count();
    console.log('Success! Total sessions:', sessionCount);
  } catch (err) {
    console.error('Connection failed:', err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
