import bcrypt from "bcrypt";

import { prisma } from "@/lib/prisma";

const BCRYPT_ROUNDS = 10;

// Spec AUTH-04/05: provisions the single account (prisma/seed.ts), storing only a salted bcrypt
// hash of the password - never the plaintext.
export async function seedAccount(username: string, password: string): Promise<void> {
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  await prisma.user.upsert({
    where: { username },
    update: { passwordHash },
    create: { username, passwordHash },
  });
}

export async function verifyCredentials(
  username: string,
  password: string,
): Promise<{ id: string } | null> {
  const user = await prisma.user.findUnique({ where: { username } });
  if (!user) {
    return null;
  }

  const matches = await bcrypt.compare(password, user.passwordHash);
  if (!matches) {
    return null;
  }

  return { id: user.id };
}

// This app provisions exactly one account (AD-002); Server Actions that need the current user's id
// for a write (e.g. plan creation) look it up here instead of threading a session-derived id
// through NextAuth, which would need extra JWT/session callbacks for a single-user app.
export async function getSeededUserId(): Promise<string> {
  const user = await prisma.user.findFirstOrThrow();
  return user.id;
}
