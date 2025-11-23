// app/api/mode/route.ts
import { NextRequest, NextResponse } from "next/server";
import { robotPost } from "@/lib/robot";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { mode } = body; // "manual" or "auto"

    const result = await robotPost("/mode", { mode });

    await prisma.event.create({
      data: {
        type: "ModeChanged",
        message: `Mode set to ${mode}`,
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
