// app/api/camera/panoramic/route.ts
import { NextRequest, NextResponse } from "next/server";
import { robotPost } from "@/lib/robot";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { steps = 12, turn_speed = 40, turn_duration = 0.3, settle_delay = 0.2 } = body;

    const result = await robotPost("/api/robot/camera/panoramic", {
      steps,
      turn_speed,
      turn_duration,
      settle_delay,
    });

    return NextResponse.json({ ok: result.success, data: result.data });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json(
      { ok: false, error: err.message },
      { status: 500 }
    );
  }
}
