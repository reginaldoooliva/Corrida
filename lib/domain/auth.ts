import bcrypt from "bcrypt";

import { prisma } from "@/lib/prisma";

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
