// lib/auth.ts
import { cookies } from "next/headers";
import { prisma } from "./prisma";

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const sessionUserId = cookieStore.get("sessionUserId")?.value;

  if (!sessionUserId) return null;

  const userId = Number(sessionUserId);
  if (Number.isNaN(userId)) return null;

  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) return null;

  return {
    id: user.id,
    username: user.username,
    role: user.role,
  };
}
