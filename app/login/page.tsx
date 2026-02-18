"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useFaceRecognition, descriptorToArray } from "@/lib/useFaceRecognition";
import { getVoiceAssistant, VOICE_MESSAGES } from "@/lib/voiceAssistant";
import {
  GlowBorder,
  CameraViewfinder,
  VoiceIndicator,
  StatusBadge,
  FuturisticButton,
  GradientText,
  FuturisticLoader,
  FaceIdIcon,
} from "@/app/components/FuturisticUI";

type LoginMode = "select" | "face" | "manual";

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get("from") || "/";

  // Face recognition
  const {
    videoRef,
    canvasRef,
    status,
    error: faceError,
    modelsLoaded,
    loadModels,
    startCamera,
    stopCamera,
    startDetection,
    stopDetection,
    captureFaceDescriptor,
  } = useFaceRecognition();

  // State
  const [mode, setMode] = useState<LoginMode>("select");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [recognizing, setRecognizing] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [voiceListening, setVoiceListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [matchConfidence, setMatchConfidence] = useState<number | null>(null);
  const [recognizedUser, setRecognizedUser] = useState<string | null>(null);

  const voiceAssistant = typeof window !== "undefined" ? getVoiceAssistant() : null;

  // Define functions before useEffects that reference them
  const handleFaceRecognition = useCallback(async () => {
    if (recognizing) return;
    
    setRecognizing(true);
    stopDetection();

    if (voiceAssistant && voiceEnabled) {
      await voiceAssistant.speak("Verifying your identity...");
    }

    const result = await captureFaceDescriptor();

    if (!result.success || !result.descriptor) {
      setError(result.error || "Failed to capture face");
      setRecognizing(false);
      startDetection();
      return;
    }

    // Send to backend for recognition
    try {
      const res = await fetch("/api/face/recognize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          faceDescriptor: descriptorToArray(result.descriptor),
        }),
      });

      const data = await res.json();

      if (data.ok && data.matched) {
        setMatchConfidence(data.confidence);
        setRecognizedUser(data.user.username);

        if (voiceAssistant && voiceEnabled) {
          await voiceAssistant.speak(`Welcome back, ${data.user.username}!`);
        }

        // Brief delay to show success state
        setTimeout(() => {
          router.push(from);
        }, 1500);
      } else {
        setError("Face not recognized. Please try again or use manual login.");
        setMatchConfidence(data.confidence || 0);
        setRecognizing(false);
        startDetection();

        if (voiceAssistant && voiceEnabled) {
          await voiceAssistant.speak(VOICE_MESSAGES.loginFailed);
        }
      }
    } catch (err) {
      setError("Recognition failed. Please try again.");
      setRecognizing(false);
      startDetection();
    }
  }, [recognizing, captureFaceDescriptor, stopDetection, startDetection, voiceAssistant, voiceEnabled, router, from]);

  const startFaceLogin = useCallback(() => {
    setMode("face");
    setError(null);
  }, []);

  const resetToSelect = useCallback(() => {
    setMode("select");
    stopCamera();
    stopDetection();
    setError(null);
    setRecognizing(false);
    setMatchConfidence(null);
    setRecognizedUser(null);
  }, [stopCamera, stopDetection]);

  // Initialize voice assistant
  useEffect(() => {
    if (!voiceAssistant) return;

    voiceAssistant.setEnabled(voiceEnabled);

    if (voiceEnabled && mode === "select") {
      voiceAssistant.speak(VOICE_MESSAGES.welcome);
    }

    voiceAssistant.onCommand((action) => {
      switch (action) {
        case "ENROLL":
          router.push("/enroll");
          break;
        case "LOGIN":
          if (mode === "select") {
            startFaceLogin();
          }
          break;
        case "CAPTURE":
          if (mode === "face" && status === "face-detected") {
            handleFaceRecognition();
          }
          break;
        case "CANCEL":
          resetToSelect();
          break;
        case "HELP":
          // Help is handled in voiceAssistant
          break;
      }
    });

    voiceAssistant.onTranscript((text) => {
      setTranscript(text);
    });

    return () => {
      voiceAssistant.stopListening();
    };
  }, [voiceEnabled, voiceAssistant, mode, status]);

  // Start voice listening when appropriate
  useEffect(() => {
    if (!voiceAssistant || !voiceEnabled) return;

    if (mode === "select" || mode === "face") {
      setVoiceListening(true);
      voiceAssistant.startListening();
    } else {
      setVoiceListening(false);
      voiceAssistant.stopListening();
    }
  }, [mode, voiceAssistant, voiceEnabled]);

  // Voice feedback for camera status
  useEffect(() => {
    if (!voiceAssistant || !voiceEnabled || mode !== "face") return;

    switch (status) {
      case "camera-ready":
        voiceAssistant.speak(VOICE_MESSAGES.loginStart);
        break;
      case "face-detected":
        // Auto-recognize when face is detected
        handleFaceRecognition();
        break;
    }
  }, [status, voiceAssistant, voiceEnabled, mode, handleFaceRecognition]);

  // Start camera when mode changes to "face" (after video element is mounted)
  useEffect(() => {
    if (mode !== "face") return;
    
    let cancelled = false;

    async function initCamera() {
      setLoading(true);

      const modelsOk = await loadModels();
      if (cancelled) return;
      
      if (!modelsOk) {
        setError("Failed to load face recognition");
        setLoading(false);
        return;
      }

      // Small delay to ensure video element is mounted
      await new Promise(r => setTimeout(r, 100));
      if (cancelled) return;

      const cameraOk = await startCamera();
      if (cancelled) return;
      
      if (!cameraOk) {
        setError("Failed to access camera");
        setLoading(false);
        return;
      }

      setLoading(false);
      startDetection();
    }

    initCamera();

    return () => {
      cancelled = true;
    };
  }, [mode, loadModels, startCamera, startDetection]);

  const handleManualLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (!data.ok) {
        setError(data.error || "Login failed");
        return;
      }

      router.push(from);
    } catch (err: any) {
      console.error(err);
      setError("Unexpected error");
    } finally {
      setLoading(false);
    }
  };

  const toggleVoice = () => {
    const newEnabled = !voiceEnabled;
    setVoiceEnabled(newEnabled);
    if (voiceAssistant) {
      voiceAssistant.setEnabled(newEnabled);
      if (newEnabled) {
        voiceAssistant.speak(VOICE_MESSAGES.voiceEnabled);
      }
    }
  };

  const getCameraStatus = (): "idle" | "detecting" | "detected" | "error" => {
    if (recognizedUser) return "detected";
    switch (status) {
      case "face-detected":
        return "detected";
      case "detecting":
      case "camera-ready":
        return "detecting";
      case "error":
      case "no-face":
      case "multiple-faces":
        return "error";
      default:
        return "idle";
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center p-6 grid-pattern overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl animate-pulse animation-delay-300" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-purple-500/3 rounded-full blur-3xl animate-pulse animation-delay-600" />
      </div>

      <div className="w-full max-w-lg relative z-10">
        {/* Mode: Select */}
        {mode === "select" && (
          <GlowBorder active={true} color="emerald" className="animate-fade-in">
            <div className="p-8">
              {/* Header */}
              <div className="text-center mb-8">
                <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center animate-float">
                  <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <h1 className="text-3xl font-bold mb-2">
                  <GradientText>Medi Runner</GradientText>
                </h1>
                <p className="text-slate-400">
                  Hospital Robot Control Console
                </p>
              </div>

              {/* Login Options */}
              <div className="space-y-4 mb-6">
                <button
                  onClick={startFaceLogin}
                  className="w-full group relative p-5 rounded-xl bg-gradient-to-r from-emerald-500/10 to-cyan-500/10 border border-emerald-500/30 hover:border-emerald-500/60 transition-all duration-300 text-left"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center">
                      <FaceIdIcon className="w-8 h-8 text-white" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg group-hover:text-emerald-400 transition-colors">
                        Biometric Login
                      </h3>
                      <p className="text-sm text-slate-400">
                        Quick & secure biometric login
                      </p>
                    </div>
                    <svg className="w-6 h-6 text-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                  <StatusBadge status="success" text="Recommended" />
                </button>

                <button
                  onClick={() => setMode("manual")}
                  className="w-full group relative p-5 rounded-xl bg-slate-800/50 border border-slate-700 hover:border-slate-600 transition-all duration-300 text-left"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-xl bg-slate-700 flex items-center justify-center">
                      <svg className="w-8 h-8 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg group-hover:text-slate-200 transition-colors">
                        Manual Login
                      </h3>
                      <p className="text-sm text-slate-400">
                        Username & password
                      </p>
                    </div>
                    <svg className="w-6 h-6 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>
              </div>

              {/* Enroll link */}
              <div className="text-center pt-4 border-t border-slate-800">
                <p className="text-sm text-slate-400 mb-2">
                  New to face recognition?
                </p>
                <FuturisticButton variant="ghost" onClick={() => router.push("/enroll")}>
                  <FaceIdIcon className="w-4 h-4 inline mr-2" />
                  Enroll Your Face
                </FuturisticButton>
              </div>

              {/* Voice hint */}
              {voiceEnabled && (
                <div className="mt-6 p-3 bg-cyan-500/10 border border-cyan-500/30 rounded-xl">
                  <p className="text-sm text-cyan-300 text-center">
                    🎤 Voice enabled: Say "Login" or "Enroll me"
                  </p>
                </div>
              )}
            </div>
          </GlowBorder>
        )}

        {/* Mode: Face Recognition */}
        {mode === "face" && (
          <GlowBorder 
            active={recognizedUser !== null || status === "face-detected"} 
            color={recognizedUser ? "emerald" : "cyan"} 
            className="animate-fade-in"
          >
            <div className="p-8">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-semibold flex items-center gap-2">
                    <FaceIdIcon className="w-6 h-6 text-emerald-400" />
                    Face Recognition
                  </h2>
                  <p className="text-sm text-slate-400">Look at the camera to authenticate</p>
                </div>
                <StatusBadge
                  status={
                    recognizedUser ? "success" :
                    recognizing ? "loading" :
                    status === "face-detected" ? "info" :
                    status === "no-face" ? "warning" :
                    "info"
                  }
                  text={
                    recognizedUser ? "Authenticated!" :
                    recognizing ? "Verifying..." :
                    status === "face-detected" ? "Face Detected" :
                    status === "no-face" ? "No Face" :
                    status === "multiple-faces" ? "Multiple Faces" :
                    "Scanning..."
                  }
                />
              </div>

              {/* Camera view */}
              <div className="relative aspect-video bg-black rounded-xl overflow-hidden mb-6">
                {loading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-slate-900/90 z-10">
                    <div className="text-center">
                      <FuturisticLoader size="lg" />
                      <p className="mt-4 text-slate-400">
                        {modelsLoaded ? "Starting camera..." : "Loading face recognition..."}
                      </p>
                    </div>
                  </div>
                )}

                {/* Success overlay */}
                {recognizedUser && (
                  <div className="absolute inset-0 bg-emerald-900/80 flex items-center justify-center z-20">
                    <div className="text-center">
                      <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center animate-glow">
                        <svg className="w-12 h-12 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <h3 className="text-2xl font-bold mb-1">Welcome back!</h3>
                      <p className="text-emerald-300 text-lg">{recognizedUser}</p>
                      {matchConfidence !== null && (
                        <p className="text-sm text-emerald-400/70 mt-2">
                          {matchConfidence}% confidence
                        </p>
                      )}
                    </div>
                  </div>
                )}

                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-full h-full object-cover transform -scale-x-100"
                />
                <canvas
                  ref={canvasRef}
                  className="absolute inset-0 w-full h-full transform -scale-x-100"
                />

                <CameraViewfinder status={getCameraStatus()} />

                {/* Recognizing overlay */}
                {recognizing && !recognizedUser && (
                  <div className="absolute inset-0 bg-slate-900/60 flex items-center justify-center z-10">
                    <div className="text-center">
                      <FuturisticLoader size="lg" />
                      <p className="mt-4 text-lg font-medium">Verifying identity...</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Error message */}
              {error && (
                <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
                  {error}
                </div>
              )}

              {/* Confidence meter (shown when face not matched) */}
              {matchConfidence !== null && !recognizedUser && (
                <div className="mb-4 p-3 bg-slate-800/50 rounded-xl">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-400">Match confidence</span>
                    <span className={matchConfidence > 50 ? "text-amber-400" : "text-red-400"}>
                      {matchConfidence}%
                    </span>
                  </div>
                  <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-500 ${
                        matchConfidence > 50 ? "bg-amber-500" : "bg-red-500"
                      }`}
                      style={{ width: `${matchConfidence}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-4">
                <FuturisticButton variant="secondary" onClick={resetToSelect}>
                  Back
                </FuturisticButton>
                <FuturisticButton
                  variant="ghost"
                  onClick={() => {
                    stopCamera();
                    setMode("manual");
                  }}
                >
                  Use Manual Login
                </FuturisticButton>
              </div>
            </div>
          </GlowBorder>
        )}

        {/* Mode: Manual Login */}
        {mode === "manual" && (
          <GlowBorder active={false} className="animate-fade-in">
            <div className="p-8">
              <div className="flex items-center gap-3 mb-6">
                <button 
                  onClick={resetToSelect}
                  className="p-2 rounded-lg hover:bg-slate-800 transition-colors"
                >
                  <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <div>
                  <h2 className="text-xl font-semibold">Manual Login</h2>
                  <p className="text-sm text-slate-400">Enter your credentials</p>
                </div>
              </div>

              <form onSubmit={handleManualLogin} className="space-y-4">
                <div>
                  <label className="block text-sm mb-2 text-slate-300">Username</label>
                  <input
                    type="text"
                    className="w-full rounded-xl bg-slate-800 border border-slate-700 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    autoComplete="username"
                    placeholder="Enter username"
                  />
                </div>

                <div>
                  <label className="block text-sm mb-2 text-slate-300">Password</label>
                  <input
                    type="password"
                    className="w-full rounded-xl bg-slate-800 border border-slate-700 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    placeholder="Enter password"
                  />
                </div>

                {error && (
                  <div className="text-sm text-red-400 bg-red-950/40 border border-red-800 rounded-xl p-3">
                    {error}
                  </div>
                )}

                <FuturisticButton
                  disabled={loading}
                  className="w-full"
                >
                  {loading ? "Signing in..." : "Sign in"}
                </FuturisticButton>
              </form>

              <div className="mt-6 pt-4 border-t border-slate-800 text-center">
                <FuturisticButton variant="ghost" onClick={startFaceLogin}>
                  <FaceIdIcon className="w-4 h-4 inline mr-2" />
                  Use Face Recognition
                </FuturisticButton>
              </div>
            </div>
          </GlowBorder>
        )}
      </div>

      {/* Voice Indicator */}
      <VoiceIndicator
        isListening={voiceListening}
        isEnabled={voiceEnabled}
        onToggle={toggleVoice}
        transcript={transcript}
      />
    </main>
  );
}

// Loading fallback for Suspense
function LoginLoading() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center p-6">
      <div className="text-center">
        <FuturisticLoader size="lg" />
        <p className="mt-4 text-slate-400">Loading...</p>
      </div>
    </main>
  );
}

// Main page component with Suspense boundary
export default function LoginPage() {
  return (
    <Suspense fallback={<LoginLoading />}>
      <LoginContent />
    </Suspense>
  );
}
