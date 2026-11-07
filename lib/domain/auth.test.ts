import bcrypt from "bcrypt";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      findFirstOrThrow: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";
import { getSeededUserId, verifyCredentials } from "./auth";

const USERNAME = "runner";
const PLAIN_PASSWORD = "correct-horse-battery-staple";

function seededUser(passwordHash: string) {
  return {
    id: "user-1",
    username: USERNAME,
    passwordHash,
    createdAt: new Date(),
  };
}

describe("auth", () => {
  let passwordHash: string;

  beforeEach(async () => {
    passwordHash = await bcrypt.hash(PLAIN_PASSWORD, 10);
    vi.mocked(prisma.user.findUnique).mockReset();
  });

  describe("verifyCredentials", () => {
    it("returns { id } for correct credentials", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(
        seededUser(passwordHash),
      );

      const result = await verifyCredentials(USERNAME, PLAIN_PASSWORD);

      expect(result).toEqual({ id: "user-1" });
    });

    it("returns null for incorrect credentials", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(
        seededUser(passwordHash),
      );
      const wrongPassword = await verifyCredentials(USERNAME, "wrong-password");
      expect(wrongPassword).toBeNull();

      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
      const unknownUser = await verifyCredentials("nobody", PLAIN_PASSWORD);
      expect(unknownUser).toBeNull();
    });
  });

  it("stored passwordHash is bcrypt, never the plaintext password", () => {
    expect(passwordHash).not.toBe(PLAIN_PASSWORD);
    expect(passwordHash).toMatch(/^\$2[aby]?\$\d{2}\$/);
  });

  describe("getSeededUserId", () => {
    it("returns the id of the single seeded account", async () => {
      vi.mocked(prisma.user.findFirstOrThrow).mockResolvedValue(seededUser(passwordHash));

      expect(await getSeededUserId()).toBe("user-1");
    });
  });
});
