// app/api/sensors/ir/route.ts
import { NextResponse } from "next/server";
import { robotGet } from "@/lib/robot";

export async function GET() {
  try {
    const result = await robotGet("/api/robot/sensors/ir");
    // result is a RobotResponse: { success, action, message, data: { sensors, labels, pins }, timestamp }
    return NextResponse.json({ ok: result.success, data: result.data });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json(
      { ok: false, error: err.message },
      { status: 500 }
    );
  }
}
