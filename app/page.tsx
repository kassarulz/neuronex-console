"use client";

import { useEffect, useState } from "react";

const ROBOT_BASE_URL =
  process.env.NEXT_PUBLIC_ROBOT_BASE_URL || "http://raspberrypi.local:5000";

type RobotStatus = {
  mode?: string;
  battery?: number | null;
  ok?: boolean;
  currentZone?: string | null;
};

export default function Dashboard() {
  const [mode, setMode] = useState<"manual" | "auto">("manual");
  const [speed, setSpeed] = useState(40);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<RobotStatus>({});
  const [online, setOnline] = useState(false);

  async function apiPost(path: string, body: any) {
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return res.json();
  }

  async function logout() {
  await fetch("/api/auth/logout", { method: "POST" });
  window.location.href = "/login";
  }

  async function sendDrive(direction: string) {
    if (mode !== "manual") return;
    setLoading(true);
    try {
      await apiPost("/api/drive", { direction, speed });
    } finally {
      setLoading(false);
    }
  }

  async function changeMode(newMode: "manual" | "auto") {
    setLoading(true);
    try {
      const data = await apiPost("/api/mode", { mode: newMode });
      if (data.ok) {
        setMode(newMode);
      }
    } finally {
      setLoading(false);
    }
  }

  // Poll status every second
  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch("/api/status", { cache: "no-store" });
        const data = await res.json();
        if (!cancelled) {
          if (data.ok) {
            setStatus(data.status);
            setOnline(true);
            if (data.status.mode === "manual" || data.status.mode === "auto") {
              setMode(data.status.mode);
            }
          } else {
            setOnline(false);
          }
        }
      } catch {
        if (!cancelled) setOnline(false);
      } finally {
        if (!cancelled) {
          setTimeout(poll, 1000);
        }
      }
    }

    poll();
    return () => {
      cancelled = true;
    };
  }, []);

  const disabledDrive = loading || mode !== "manual" || !online;

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 p-6 flex flex-col gap-6 items-center">
      {/* Header */}
      <header className="w-full max-w-5xl flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Medi Runner Control Console</h1>
          <p className="text-sm text-slate-400">
            Real-time control & monitoring for your hospital robot
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div
            className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm ${
              online ? "bg-emerald-500/20 text-emerald-300" : "bg-red-500/20 text-red-300"
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                online ? "bg-emerald-400" : "bg-red-400"
              }`}
            />
            {online ? "Robot Online" : "Robot Offline"}
          </div>
          <div className="text-xs text-slate-400">Mode: {mode}</div>
          <button  onClick={logout} className="text-xs px-3 py-1 rounded-full bg-slate-800 hover:bg-slate-700">
            Logout
          </button>
        </div>
      </header>

      {/* Camera */}
      <section className="w-full max-w-5xl rounded-2xl overflow-hidden bg-black shadow-xl">
        <img
          src={`${ROBOT_BASE_URL}/stream`}
          alt="Robot Camera"
          className="w-full h-80 object-cover"
        />
      </section>

      {/* Mode + Speed + Status */}
      <section className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Mode */}
        <div className="bg-slate-900 rounded-2xl p-4 shadow">
          <h2 className="font-semibold mb-2">Mode</h2>
          <div className="flex gap-2">
            <button
              disabled={loading}
              onClick={() => changeMode("manual")}
              className={`flex-1 px-4 py-2 rounded-xl text-sm ${
                mode === "manual" ? "bg-emerald-500" : "bg-slate-700"
              }`}
            >
              Manual
            </button>
            <button
              disabled={loading}
              onClick={() => changeMode("auto")}
              className={`flex-1 px-4 py-2 rounded-xl text-sm ${
                mode === "auto" ? "bg-emerald-500" : "bg-slate-700"
              }`}
            >
              Auto (Line Follow)
            </button>
          </div>
        </div>

        {/* Speed */}
        <div className="bg-slate-900 rounded-2xl p-4 shadow">
          <h2 className="font-semibold mb-2">Speed</h2>
          <input
            type="range"
            min={20}
            max={100}
            value={speed}
            onChange={(e) => setSpeed(parseInt(e.target.value))}
            className="w-full"
          />
          <p className="mt-2 text-sm text-slate-300">{speed}%</p>
        </div>

        {/* Status */}
        <div className="bg-slate-900 rounded-2xl p-4 shadow text-sm">
          <h2 className="font-semibold mb-2">Robot Status</h2>
          <p>Mode: {status.mode ?? "-"}</p>
          <p>Battery: {status.battery ?? "-"}%</p>
          <p>Current zone: {status.currentZone ?? "-"}</p>
        </div>
      </section>

      {/* Manual Controls + Zone info */}
      <section className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* D-Pad */}
        <div className="bg-slate-900 rounded-2xl p-4 shadow col-span-2">
          <h2 className="font-semibold mb-3">Manual Drive</h2>
          <div className="grid grid-cols-3 gap-3 justify-items-center">
            <div />
            <button
              disabled={disabledDrive}
              onMouseDown={() => sendDrive("forward")}
              onMouseUp={() => sendDrive("stop")}
              className="w-20 h-12 rounded-xl bg-slate-700 text-xl"
            >
              ↑
            </button>
            <div />

            <button
              disabled={disabledDrive}
              onMouseDown={() => sendDrive("left")}
              onMouseUp={() => sendDrive("stop")}
              className="w-20 h-12 rounded-xl bg-slate-700 text-xl"
            >
              ←
            </button>
            <button
              disabled={disabledDrive}
              onClick={() => sendDrive("stop")}
              className="w-20 h-12 rounded-xl bg-red-600 text-sm"
            >
              Stop
            </button>
            <button
              disabled={disabledDrive}
              onMouseDown={() => sendDrive("right")}
              onMouseUp={() => sendDrive("stop")}
              className="w-20 h-12 rounded-xl bg-slate-700 text-xl"
            >
              →
            </button>

            <div />
            <button
              disabled={disabledDrive}
              onMouseDown={() => sendDrive("backward")}
              onMouseUp={() => sendDrive("stop")}
              className="w-20 h-12 rounded-xl bg-slate-700 text-xl"
            >
              ↓
            </button>
            <div />
          </div>
        </div>

        {/* Zone / events area placeholder */}
        <div className="bg-slate-900 rounded-2xl p-4 shadow text-sm">
          <h2 className="font-semibold mb-2">Zone & Events</h2>
          <p className="mb-2">
            Current zone:{" "}
            <span className="font-mono">{status.currentZone ?? "-"}</span>
          </p>
          <p className="text-slate-400">
            Later you can list last detected zones and mission events from the
            database here.
          </p>
        </div>
      </section>
    </main>
  );
}
