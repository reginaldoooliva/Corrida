import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const BCRYPT_ROUNDS = 10;

const prisma = new PrismaClient();

async function main() {
  const username = process.env.SEED_USERNAME;
  const password = process.env.SEED_PASSWORD;

  if (!username || !password) {
    throw new Error(
      "SEED_USERNAME and SEED_PASSWORD env vars must both be set to seed the account",
    );
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  await prisma.user.upsert({
    where: { username },
    update: { passwordHash },
    create: { username, passwordHash },
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
