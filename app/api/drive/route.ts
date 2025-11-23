// app/api/drive/route.ts
import { NextRequest, NextResponse } from "next/server";
import { robotPost } from "@/lib/robot";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { direction, speed } = body;

    const result = await robotPost("/drive", { direction, speed });

    // Optional: log this action
    await prisma.event.create({
      data: {
        type: "DriveCommand",
        message: `Direction: ${direction}, Speed: ${speed}`,
      },
    });

    return NextResponse.json({ ok: true, result });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json(
      { ok: false, error: err.message },
      { status: 500 }
    );
  }
}
