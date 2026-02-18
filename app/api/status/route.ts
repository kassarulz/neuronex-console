// app/api/status/route.ts
import { NextResponse } from "next/server";
import { robotGet } from "@/lib/robot";

export async function GET() {
  try {
    const robotStatus = await robotGet("/api/robot/status");
    // robotStatus is a RobotResponse: { success, action, message, data, timestamp }
    return NextResponse.json({ ok: robotStatus.success, status: robotStatus.data });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json(
      { ok: false, error: err.message },
      { status: 500 }
    );
  }
}
