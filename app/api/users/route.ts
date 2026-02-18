// app/api/users/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        role: true,
        faceEnrolledAt: true,
      },
      orderBy: {
        username: "asc",
      },
    });

    return NextResponse.json({
      ok: true,
      users: users.map(user => ({
        ...user,
        faceEnrolled: !!user.faceEnrolledAt,
      })),
    });
  } catch (err) {
    console.error("Get users error:", err);
    return NextResponse.json(
      { ok: false, error: "Server error" },
      { status: 500 }
    );
  }
}
