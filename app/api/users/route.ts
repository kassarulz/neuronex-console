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

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { username, password, role } = body;

    // Validate required fields
    if (!username || !password || !role) {
      return NextResponse.json(
        { ok: false, error: "Username, password, and role are required" },
        { status: 400 }
      );
    }

    // Check if username already exists
    const existingUser = await prisma.user.findUnique({
      where: { username },
    });

    if (existingUser) {
      return NextResponse.json(
        { ok: false, error: "Username already exists" },
        { status: 409 }
      );
    }

    // Create the new user
    const user = await prisma.user.create({
      data: {
        username,
        password, // plaintext for hackathon
        role,
      },
      select: {
        id: true,
        username: true,
        role: true,
        faceEnrolledAt: true,
      },
    });

    return NextResponse.json({
      ok: true,
      user: {
        ...user,
        faceEnrolled: !!user.faceEnrolledAt,
      },
    });
  } catch (err) {
    console.error("Create user error:", err);
    return NextResponse.json(
      { ok: false, error: "Server error" },
      { status: 500 }
    );
  }
}
