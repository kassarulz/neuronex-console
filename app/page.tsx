"use client";

import { useEffect, useState } from "react";

const ROBOT_BASE_URL =
  process.env.NEXT_PUBLIC_ROBOT_BASE_URL || "http://raspberrypi.local:8000";

type RobotStatus = {
  is_moving?: boolean;
  direction?: string;
  left_speed?: number;
  right_speed?: number;
  position?: { x: number; y: number; heading: number };
  uptime?: number;
};

type IRSensorData = {
  sensors: number[];
  labels: string[];
  pins: number[];
};

type AIMessage = {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
};

export default function Dashboard() {
  const [mode, setMode] = useState<"manual" | "autonomous">("manual");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<RobotStatus>({});
  const [irSensors, setIrSensors] = useState<IRSensorData | null>(null);
  const [online, setOnline] = useState(false);
  const [simulationMode, setSimulationMode] = useState(false);
  
  // AI Prompt state
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiMessages, setAiMessages] = useState<AIMessage[]>([]);
  const [aiLoading, setAiLoading] = useState(false);

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
      await apiPost("/api/drive", { direction });
    } finally {
      setLoading(false);
    }
  }

  async function changeMode(newMode: "manual" | "autonomous") {
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

  async function sendBuzzer(times = 1, duration = 0.3) {
    try {
      await apiPost("/api/buzzer", { times, duration });
    } catch (err) {
      console.error("Buzzer error:", err);
    }
  }

  // Send prompt to AI agent on robot backend
  async function sendAiPrompt(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!aiPrompt.trim() || aiLoading) return;

    const userMessage: AIMessage = {
      role: "user",
      content: aiPrompt.trim(),
      timestamp: new Date(),
    };

    setAiMessages((prev) => [...prev, userMessage]);
    setAiPrompt("");
    setAiLoading(true);

    try {
      // Send to robot backend AI agent endpoint
      const res = await fetch(`${ROBOT_BASE_URL}/ai/prompt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: userMessage.content }),
      });

      const data = await res.json();

      const assistantMessage: AIMessage = {
        role: "assistant",
        content: data.response || data.message || "Command received.",
        timestamp: new Date(),
      };

      setAiMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      const errorMessage: AIMessage = {
        role: "assistant",
        content: "Failed to communicate with AI agent. Please check robot connection.",
        timestamp: new Date(),
      };
      setAiMessages((prev) => [...prev, errorMessage]);
    } finally {
      setAiLoading(false);
    }
  }

  // Poll status + IR sensors every second
  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const [statusRes, irRes, healthRes] = await Promise.all([
          fetch("/api/status", { cache: "no-store" }),
          fetch("/api/sensors/ir", { cache: "no-store" }),
          fetch("/api/health", { cache: "no-store" }),
        ]);
        const [statusData, irData, healthData] = await Promise.all([
          statusRes.json(),
          irRes.json(),
          healthRes.json(),
        ]);

        if (!cancelled) {
          if (statusData.ok) {
            setStatus(statusData.status);
            setOnline(true);
          } else {
            setOnline(false);
          }

          if (irData.ok) {
            setIrSensors(irData.data);
          }

          if (healthData.ok) {
            setSimulationMode(healthData.simulation_mode ?? false);
          }

          // Sync mode from robot
          const modeRes = await fetch("/api/mode", { cache: "no-store" });
          const modeData = await modeRes.json();
          if (!cancelled && modeData.ok && modeData.result?.data?.mode) {
            const robotMode = modeData.result.data.mode;
            if (robotMode === "manual" || robotMode === "autonomous") {
              setMode(robotMode);
            }
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
      <section className="w-full max-w-5xl rounded-2xl overflow-hidden bg-black shadow-xl relative">
        <img
          src={`${ROBOT_BASE_URL}/api/robot/camera/stream`}
          alt="Robot Camera Feed"
          className="w-full h-80 object-contain"
        />
        <div className="absolute bottom-3 right-3 flex gap-2">
          <a
            href={`${ROBOT_BASE_URL}/api/robot/camera/snapshot`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 rounded-lg bg-slate-800/80 backdrop-blur-sm text-xs text-slate-200 hover:bg-slate-700/80 border border-slate-600 transition-colors"
          >
            Snapshot
          </a>
        </div>
      </section>

      {/* Mode + Status */}
      <section className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-2 gap-4">
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
              onClick={() => changeMode("autonomous")}
              className={`flex-1 px-4 py-2 rounded-xl text-sm ${
                mode === "autonomous" ? "bg-emerald-500" : "bg-slate-700"
              }`}
            >
              Autonomous
            </button>
          </div>
        </div>

        {/* Status */}
        <div className="bg-slate-900 rounded-2xl p-4 shadow text-sm">
          <h2 className="font-semibold mb-2">Robot Status</h2>
          <p>Moving: {status.is_moving ? "Yes" : "No"}</p>
          <p>Direction: {status.direction ?? "-"}</p>
          <p>L/R Speed: {status.left_speed ?? 0} / {status.right_speed ?? 0}</p>
          <p>Uptime: {status.uptime ? `${Math.round(status.uptime)}s` : "-"}</p>
          {simulationMode && (
            <p className="text-amber-400 mt-1">Simulation Mode</p>
          )}
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

        {/* IR Sensors + Buzzer */}
        <div className="bg-slate-900 rounded-2xl p-4 shadow text-sm">
          <h2 className="font-semibold mb-3">IR Sensor Array</h2>
          {irSensors ? (
            <div className="space-y-3">
              <div className="flex justify-center gap-2">
                {irSensors.sensors.map((val, i) => (
                  <div key={i} className="flex flex-col items-center gap-1">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-mono ${
                        val === 0
                          ? "bg-emerald-500 text-white"
                          : "bg-slate-700 text-slate-400"
                      }`}
                    >
                      {val === 0 ? "LINE" : "---"}
                    </div>
                    <span className="text-[10px] text-slate-500">
                      S{i + 1}
                    </span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-slate-500 text-center">
                0 = line detected (black) | 1 = no line (white)
              </p>
            </div>
          ) : (
            <p className="text-slate-400">No sensor data</p>
          )}

          {/* Buzzer */}
          <div className="mt-4 pt-3 border-t border-slate-800">
            <h3 className="font-semibold mb-2">Buzzer</h3>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => sendBuzzer(1)}
                disabled={!online}
                className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-xs disabled:opacity-50"
              >
                1 Beep
              </button>
              <button
                onClick={() => sendBuzzer(2, 0.15)}
                disabled={!online}
                className="px-3 py-1.5 rounded-lg bg-red-700 hover:bg-red-600 text-xs disabled:opacity-50"
              >
                2 (Emergency)
              </button>
              <button
                onClick={() => sendBuzzer(3)}
                disabled={!online}
                className="px-3 py-1.5 rounded-lg bg-green-700 hover:bg-green-600 text-xs disabled:opacity-50"
              >
                3 (General)
              </button>
              <button
                onClick={() => sendBuzzer(5)}
                disabled={!online}
                className="px-3 py-1.5 rounded-lg bg-amber-700 hover:bg-amber-600 text-xs disabled:opacity-50"
              >
                5 (Destination)
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* AI Agent Prompt Section */}
      <section className="w-full max-w-5xl">
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl shadow-xl border border-slate-700 overflow-hidden">
          {/* Header */}
          <div className="px-6 py-4 border-b border-slate-700 bg-slate-800/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <div>
                <h2 className="font-semibold text-lg">AI Navigation Agent</h2>
                <p className="text-xs text-slate-400">
                  Send natural language commands to the robot AI
                </p>
              </div>
              <div className="ml-auto">
                <span
                  className={`px-3 py-1 rounded-full text-xs ${
                    online
                      ? "bg-emerald-500/20 text-emerald-300"
                      : "bg-red-500/20 text-red-300"
                  }`}
                >
                  {online ? "AI Ready" : "Offline"}
                </span>
              </div>
            </div>
          </div>

          {/* Messages Area */}
          <div className="h-48 overflow-y-auto p-4 space-y-3 bg-slate-950/50">
            {aiMessages.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-500 text-sm">
                <div className="text-center">
                  <svg
                    className="w-12 h-12 mx-auto mb-2 text-slate-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                    />
                  </svg>
                  <p>Send a command to the AI agent</p>
                  <p className="text-xs text-slate-600 mt-1">
                    e.g., "Navigate to Ward A" or "Start patrol route"
                  </p>
                </div>
              </div>
            ) : (
              aiMessages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex ${
                    msg.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[80%] px-4 py-2 rounded-2xl text-sm ${
                      msg.role === "user"
                        ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-br-sm"
                        : "bg-slate-800 text-slate-200 rounded-bl-sm border border-slate-700"
                    }`}
                  >
                    <p>{msg.content}</p>
                    <p
                      className={`text-xs mt-1 ${
                        msg.role === "user"
                          ? "text-purple-200"
                          : "text-slate-500"
                      }`}
                    >
                      {msg.timestamp.toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))
            )}
            {aiLoading && (
              <div className="flex justify-start">
                <div className="bg-slate-800 px-4 py-3 rounded-2xl rounded-bl-sm border border-slate-700">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Input Area */}
          <form onSubmit={sendAiPrompt} className="p-4 border-t border-slate-700 bg-slate-900/50">
            <div className="flex gap-3">
              <input
                type="text"
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder="Enter a command for the AI agent..."
                disabled={!online || aiLoading}
                className="flex-1 px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none transition-colors text-white placeholder-slate-500 disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={!online || aiLoading || !aiPrompt.trim()}
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-400 hover:to-pink-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium flex items-center gap-2"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                  />
                </svg>
                Send
              </button>
            </div>
            <p className="text-xs text-slate-500 mt-2">
              Examples: "Go to pharmacy", "Stop and wait", "Return to charging station"
            </p>
          </form>
        </div>
      </section>
    </main>
  );
}
