// app/api/buzzer/route.ts
import { NextRequest, NextResponse } from "next/server";
import { robotPost } from "@/lib/robot";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { times = 1, duration = 0.3 } = body;

    const result = await robotPost("/api/robot/buzzer", { times, duration });

    return NextResponse.json({ ok: result.success, result });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json(
      { ok: false, error: err.message },
      { status: 500 }
    );
  }
}
