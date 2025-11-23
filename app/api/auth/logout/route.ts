// app/api/auth/logout/route.ts
import { NextResponse } from "next/server";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  // Clear the cookie
  res.cookies.set("sessionUserId", "", {
    httpOnly: true,
    path: "/",
    expires: new Date(0),
  });
  return res;
}
