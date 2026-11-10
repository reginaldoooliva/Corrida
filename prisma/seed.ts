import { seedAccount } from "../lib/domain/auth";
import { prisma } from "../lib/prisma";

async function main() {
  const username = process.env.SEED_USERNAME;
  const password = process.env.SEED_PASSWORD;

  if (!username || !password) {
    throw new Error(
      "SEED_USERNAME and SEED_PASSWORD env vars must both be set to seed the account",
    );
  }

  await seedAccount(username, password);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
