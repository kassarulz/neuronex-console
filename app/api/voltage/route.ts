// app/api/voltage/route.ts
import { NextResponse } from "next/server";
import { robotGet } from "@/lib/robot";

export async function GET() {
  try {
    const result = await robotGet("/api/robot/voltage");
    // result: RobotResponse with data: { core_voltage_v, cpu_temp_c, throttled }
    return NextResponse.json({ ok: result.success, data: result.data });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json(
      { ok: false, error: err.message },
      { status: 500 }
    );
  }
}
