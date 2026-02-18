// lib/robot.ts
const ROBOT_BASE_URL =
  process.env.NEXT_PUBLIC_ROBOT_BASE_URL || "http://raspberrypi.local:8000";

export async function robotPost(path: string, body: any) {
  const res = await fetch(`${ROBOT_BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`Robot POST ${path} failed with ${res.status}`);
  }
  return res.json();
}

export async function robotGet(path: string) {
  const res = await fetch(`${ROBOT_BASE_URL}${path}`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Robot GET ${path} failed with ${res.status}`);
  }
  return res.json();
}
