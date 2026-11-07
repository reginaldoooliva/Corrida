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
