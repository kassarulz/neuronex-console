// app/api/health/route.ts
import { NextResponse } from "next/server";
import { robotGet } from "@/lib/robot";

export async function GET() {
  try {
    const result = await robotGet("/health");
    // result: { status: "ok", simulation_mode: boolean, timestamp: float }
    return NextResponse.json({ ok: true, ...result });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json(
      { ok: false, error: err.message },
      { status: 500 }
    );
  }
}
