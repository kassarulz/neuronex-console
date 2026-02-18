// app/api/drive/route.ts
import { NextRequest, NextResponse } from "next/server";
import { robotPost } from "@/lib/robot";
import { prisma } from "@/lib/prisma";

const VALID_DIRECTIONS = ["forward", "backward", "left", "right", "stop"] as const;
type Direction = (typeof VALID_DIRECTIONS)[number];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { direction, speed = 50, duration = 0 } = body;

    if (!VALID_DIRECTIONS.includes(direction)) {
      return NextResponse.json(
        { ok: false, error: `Invalid direction: ${direction}` },
        { status: 400 }
      );
    }

    // Each direction maps to its own Robot Controller API endpoint
    const payload = direction === "stop" ? {} : { speed, duration };
    const result = await robotPost(`/api/robot/${direction}`, payload);

    // Log this action
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
