// app/api/face/recognize/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Euclidean distance calculation for face descriptor comparison
function euclideanDistance(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error("Vectors must have the same length");
  }
  
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += Math.pow(a[i] - b[i], 2);
  }
  return Math.sqrt(sum);
}

export async function POST(req: NextRequest) {
  try {
    const { faceDescriptor } = await req.json();

    if (!faceDescriptor) {
      return NextResponse.json(
        { ok: false, error: "Missing faceDescriptor" },
        { status: 400 }
      );
    }

    // Validate face descriptor format
    if (!Array.isArray(faceDescriptor) || faceDescriptor.length !== 128) {
      return NextResponse.json(
        { ok: false, error: "Invalid face descriptor format" },
        { status: 400 }
      );
    }

    // Get all users with enrolled faces
    const users = await prisma.user.findMany({
      where: {
        faceDescriptor: { not: null },
      },
      select: {
        id: true,
        username: true,
        role: true,
        faceDescriptor: true,
      },
    });

    if (users.length === 0) {
      return NextResponse.json(
        { ok: false, error: "No enrolled faces found" },
        { status: 404 }
      );
    }

    // Find best matching face
    let bestMatch: { userId: number; username: string; role: string; distance: number } | null = null;

    for (const user of users) {
      if (!user.faceDescriptor) continue;

      const storedDescriptor = JSON.parse(user.faceDescriptor) as number[];
      const distance = euclideanDistance(faceDescriptor, storedDescriptor);

      if (!bestMatch || distance < bestMatch.distance) {
        bestMatch = {
          userId: user.id,
          username: user.username,
          role: user.role,
          distance,
        };
      }
    }

    // Threshold for face match (lower = stricter)
    // Typical values: 0.4 (strict) to 0.6 (lenient)
    const MATCH_THRESHOLD = 0.6;

    if (bestMatch && bestMatch.distance < MATCH_THRESHOLD) {
      // Create session cookie for matched user
      const res = NextResponse.json({
        ok: true,
        matched: true,
        user: {
          id: bestMatch.userId,
          username: bestMatch.username,
          role: bestMatch.role,
        },
        confidence: Math.round((1 - bestMatch.distance) * 100), // Convert to percentage
        distance: bestMatch.distance,
      });

      // Set session cookie
      res.cookies.set("sessionUserId", String(bestMatch.userId), {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
      });

      return res;
    }

    return NextResponse.json({
      ok: true,
      matched: false,
      error: "Face not recognized",
      confidence: bestMatch ? Math.round((1 - bestMatch.distance) * 100) : 0,
    });
  } catch (err) {
    console.error("Face recognition error:", err);
    return NextResponse.json(
      { ok: false, error: "Server error during face recognition" },
      { status: 500 }
    );
  }
}

// Get all enrolled faces for client-side recognition (without descriptors for security)
export async function GET() {
  try {
    const users = await prisma.user.findMany({
      where: {
        faceDescriptor: { not: null },
      },
      select: {
        id: true,
        username: true,
        faceEnrolledAt: true,
      },
    });

    return NextResponse.json({
      ok: true,
      enrolledUsers: users,
      count: users.length,
    });
  } catch (err) {
    console.error("Get enrolled faces error:", err);
    return NextResponse.json(
      { ok: false, error: "Server error" },
      { status: 500 }
    );
  }
}
