// app/api/face/enroll/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const { userId, faceDescriptor } = await req.json();

    if (!userId || !faceDescriptor) {
      return NextResponse.json(
        { ok: false, error: "Missing userId or faceDescriptor" },
        { status: 400 }
      );
    }

    // Validate that faceDescriptor is an array of numbers
    if (!Array.isArray(faceDescriptor) || faceDescriptor.length !== 128) {
      return NextResponse.json(
        { ok: false, error: "Invalid face descriptor format" },
        { status: 400 }
      );
    }

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return NextResponse.json(
        { ok: false, error: "User not found" },
        { status: 404 }
      );
    }

    // Update user with face descriptor
    await prisma.user.update({
      where: { id: userId },
      data: {
        faceDescriptor: JSON.stringify(faceDescriptor),
        faceEnrolledAt: new Date(),
      },
    });

    return NextResponse.json({
      ok: true,
      message: "Face enrolled successfully",
    });
  } catch (err) {
    console.error("Face enrollment error:", err);
    return NextResponse.json(
      { ok: false, error: "Server error during face enrollment" },
      { status: 500 }
    );
  }
}

// Get enrollment status for a user
export async function GET(req: NextRequest) {
  try {
    const userId = req.nextUrl.searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        { ok: false, error: "Missing userId" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: parseInt(userId) },
      select: {
        id: true,
        username: true,
        faceEnrolledAt: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { ok: false, error: "User not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      enrolled: !!user.faceEnrolledAt,
      enrolledAt: user.faceEnrolledAt,
    });
  } catch (err) {
    console.error("Get enrollment status error:", err);
    return NextResponse.json(
      { ok: false, error: "Server error" },
      { status: 500 }
    );
  }
}
