// app/api/status/route.ts
import { NextResponse } from "next/server";
import { robotGet } from "@/lib/robot";

export async function GET() {
  try {
    const status = await robotGet("/status");
    return NextResponse.json({ ok: true, status });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json(
      { ok: false, error: err.message },
      { status: 500 }
    );
  }
}
