// app/enroll/page.tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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

type User = {
  id: number;
  username: string;
  role: string;
  faceEnrolled: boolean;
};

type EnrollmentStep = 
  | "select-user"
  | "camera-setup"
  | "positioning"
  | "capturing"
  | "success"
  | "error";

export default function EnrollPage() {
  const router = useRouter();
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

  const [step, setStep] = useState<EnrollmentStep>("select-user");
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [voiceListening, setVoiceListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [captureProgress, setCaptureProgress] = useState(0);

  const voiceAssistant = typeof window !== "undefined" ? getVoiceAssistant() : null;

  // Load users on mount
  useEffect(() => {
    async function fetchUsers() {
      try {
        const res = await fetch("/api/users");
        const data = await res.json();
        if (data.ok) {
          setUsers(data.users);
        }
      } catch (err) {
        console.error("Failed to fetch users:", err);
      }
    }
    fetchUsers();
  }, []);

  // Initialize voice assistant
  useEffect(() => {
    if (!voiceAssistant) return;

    voiceAssistant.setEnabled(voiceEnabled);
    
    if (voiceEnabled) {
      voiceAssistant.speak("Welcome to face enrollment. Please select a user to enroll.");
    }

    voiceAssistant.onCommand((action) => {
      switch (action) {
        case "CAPTURE":
          if (step === "positioning" && status === "face-detected") {
            handleCapture();
          }
          break;
        case "CANCEL":
          handleReset();
          break;
        case "LOGIN":
          router.push("/login");
          break;
      }
    });

    voiceAssistant.onTranscript((text) => {
      setTranscript(text);
    });

    return () => {
      voiceAssistant.stopListening();
    };
  }, [voiceEnabled, voiceAssistant, step, status]);

  // Camera status voice feedback
  useEffect(() => {
    if (!voiceAssistant || !voiceEnabled) return;

    switch (status) {
      case "camera-ready":
        voiceAssistant.speak(VOICE_MESSAGES.cameraReady);
        break;
      case "face-detected":
        voiceAssistant.speak(VOICE_MESSAGES.faceDetected);
        break;
      case "no-face":
        // Don't spam voice messages for no-face
        break;
      case "multiple-faces":
        voiceAssistant.speak(VOICE_MESSAGES.multipleFaces);
        break;
    }
  }, [status, voiceAssistant, voiceEnabled]);

  // Start camera when step becomes camera-setup (video element is now mounted)
  useEffect(() => {
    if (step !== "camera-setup" || !selectedUser) return;
    
    let cancelled = false;

    async function initCamera() {
      setLoading(true);
      
      const modelsOk = await loadModels();
      if (cancelled) return;
      
      if (!modelsOk) {
        setError("Failed to load face recognition models");
        setStep("error");
        setLoading(false);
        return;
      }

      if (voiceAssistant && voiceEnabled) {
        await voiceAssistant.speak(VOICE_MESSAGES.cameraOpening);
      }

      // Small delay to ensure video element is mounted
      await new Promise(r => setTimeout(r, 100));
      if (cancelled) return;

      const cameraOk = await startCamera();
      if (cancelled) return;
      
      if (!cameraOk) {
        setError("Failed to access camera");
        setStep("error");
        setLoading(false);
        return;
      }

      setLoading(false);
      setStep("positioning");
      startDetection();

      if (voiceAssistant && voiceEnabled) {
        setVoiceListening(true);
        voiceAssistant.startListening();
      }
    }

    initCamera();

    return () => {
      cancelled = true;
    };
  }, [step, selectedUser, loadModels, startCamera, startDetection, voiceAssistant, voiceEnabled]);

  const handleSelectUser = async (user: User) => {
    setSelectedUser(user);
    setStep("camera-setup");
    setError(null);

    if (voiceAssistant && voiceEnabled) {
      await voiceAssistant.speak(`Selected ${user.username}. ${VOICE_MESSAGES.enrollStart}`);
    }
  };

  const handleCapture = useCallback(async () => {
    if (!selectedUser) return;

    setStep("capturing");
    stopDetection();

    if (voiceAssistant && voiceEnabled) {
      await voiceAssistant.speak("Capturing your face. Please hold still.");
    }

    // Simulate progress animation
    for (let i = 0; i <= 100; i += 10) {
      setCaptureProgress(i);
      await new Promise((r) => setTimeout(r, 100));
    }

    const result = await captureFaceDescriptor();

    if (!result.success || !result.descriptor) {
      setError(result.error || "Failed to capture face");
      setStep("error");
      if (voiceAssistant && voiceEnabled) {
        await voiceAssistant.speak(VOICE_MESSAGES.enrollFailed);
      }
      return;
    }

    // Save to backend
    try {
      const res = await fetch("/api/face/enroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: selectedUser.id,
          faceDescriptor: descriptorToArray(result.descriptor),
        }),
      });

      const data = await res.json();

      if (!data.ok) {
        throw new Error(data.error || "Failed to save face data");
      }

      setStep("success");
      stopCamera();

      if (voiceAssistant && voiceEnabled) {
        await voiceAssistant.speak(VOICE_MESSAGES.enrollSuccess);
      }
    } catch (err: any) {
      setError(err.message);
      setStep("error");
      if (voiceAssistant && voiceEnabled) {
        await voiceAssistant.speak(VOICE_MESSAGES.enrollFailed);
      }
    }
  }, [selectedUser, captureFaceDescriptor, stopDetection, stopCamera, voiceAssistant, voiceEnabled]);

  const handleReset = () => {
    stopCamera();
    stopDetection();
    setStep("select-user");
    setSelectedUser(null);
    setError(null);
    setCaptureProgress(0);
    setVoiceListening(false);
    if (voiceAssistant) {
      voiceAssistant.stopListening();
    }
  };

  const toggleVoice = () => {
    const newEnabled = !voiceEnabled;
    setVoiceEnabled(newEnabled);
    if (voiceAssistant) {
      voiceAssistant.setEnabled(newEnabled);
      if (newEnabled) {
        voiceAssistant.speak(VOICE_MESSAGES.voiceEnabled);
        if (step === "positioning") {
          setVoiceListening(true);
          voiceAssistant.startListening();
        }
      } else {
        setVoiceListening(false);
        voiceAssistant.stopListening();
      }
    }
  };

  const getCameraStatus = (): "idle" | "detecting" | "detected" | "error" => {
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
    <main className="min-h-screen bg-slate-950 text-slate-50 p-6 grid-pattern">
      {/* Header */}
      <header className="max-w-4xl mx-auto mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <FaceIdIcon className="w-10 h-10 text-emerald-400" />
              <GradientText>Face Enrollment</GradientText>
            </h1>
            <p className="text-slate-400 mt-1">
              Medi Runner Control Console • Biometric Registration
            </p>
          </div>
          <FuturisticButton variant="ghost" onClick={() => router.push("/login")}>
            Back to Login
          </FuturisticButton>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto">
        {/* Step: Select User */}
        {step === "select-user" && (
          <GlowBorder active={true} color="emerald" className="animate-fade-in">
            <div className="p-8">
              <h2 className="text-xl font-semibold mb-2">Select User to Enroll</h2>
              <p className="text-slate-400 mb-6">
                Choose a user account to register face biometrics. 
                {voiceEnabled && " Or say a user's name to select them."}
              </p>

              {users.length === 0 ? (
                <div className="flex items-center justify-center py-12">
                  <FuturisticLoader />
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {users.map((user) => (
                    <button
                      key={user.id}
                      onClick={() => handleSelectUser(user)}
                      className="group relative p-5 rounded-xl bg-slate-800/50 border border-slate-700 hover:border-emerald-500/50 transition-all duration-300 text-left hover:shadow-lg hover:shadow-emerald-500/10"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center text-lg font-bold text-white">
                          {user.username[0].toUpperCase()}
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-lg group-hover:text-emerald-400 transition-colors">
                            {user.username}
                          </h3>
                          <p className="text-sm text-slate-400">{user.role}</p>
                        </div>
                        {user.faceEnrolled ? (
                          <StatusBadge status="success" text="Enrolled" />
                        ) : (
                          <StatusBadge status="info" text="Not Enrolled" />
                        )}
                      </div>
                      {/* Hover arrow */}
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <svg className="w-6 h-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </GlowBorder>
        )}

        {/* Step: Camera Setup / Positioning */}
        {(step === "camera-setup" || step === "positioning" || step === "capturing") && (
          <div className="animate-fade-in">
            <GlowBorder 
              active={status === "face-detected"} 
              color={status === "face-detected" ? "emerald" : "cyan"}
            >
              <div className="p-8">
                {/* User info */}
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center text-lg font-bold text-white">
                      {selectedUser?.username[0].toUpperCase()}
                    </div>
                    <div>
                      <h2 className="font-semibold text-xl">{selectedUser?.username}</h2>
                      <p className="text-sm text-slate-400">Enrolling face biometrics</p>
                    </div>
                  </div>
                  <StatusBadge 
                    status={
                      step === "capturing" ? "loading" :
                      status === "face-detected" ? "success" :
                      status === "no-face" || status === "multiple-faces" ? "warning" :
                      "info"
                    }
                    text={
                      step === "capturing" ? "Capturing..." :
                      status === "face-detected" ? "Face Detected" :
                      status === "no-face" ? "No Face" :
                      status === "multiple-faces" ? "Multiple Faces" :
                      status === "loading-models" ? "Loading..." :
                      "Detecting..."
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

                  {/* Capture progress overlay */}
                  {step === "capturing" && (
                    <div className="absolute inset-0 bg-slate-900/80 flex items-center justify-center">
                      <div className="text-center">
                        <div className="relative w-32 h-32 mb-4">
                          <svg className="w-full h-full transform -rotate-90">
                            <circle
                              cx="64"
                              cy="64"
                              r="60"
                              fill="none"
                              stroke="#334155"
                              strokeWidth="8"
                            />
                            <circle
                              cx="64"
                              cy="64"
                              r="60"
                              fill="none"
                              stroke="url(#gradient)"
                              strokeWidth="8"
                              strokeLinecap="round"
                              strokeDasharray={`${(captureProgress / 100) * 377} 377`}
                            />
                            <defs>
                              <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                <stop offset="0%" stopColor="#10b981" />
                                <stop offset="100%" stopColor="#06b6d4" />
                              </linearGradient>
                            </defs>
                          </svg>
                          <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-3xl font-bold">{captureProgress}%</span>
                          </div>
                        </div>
                        <p className="text-lg font-medium">Capturing Face...</p>
                        <p className="text-sm text-slate-400">Please hold still</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Instructions */}
                <div className="bg-slate-800/50 rounded-xl p-4 mb-6">
                  <h3 className="font-medium mb-2 flex items-center gap-2">
                    <svg className="w-5 h-5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Instructions
                  </h3>
                  <ul className="text-sm text-slate-400 space-y-1">
                    <li>• Position your face in the center of the frame</li>
                    <li>• Ensure good lighting on your face</li>
                    <li>• Look directly at the camera</li>
                    <li>• Remove glasses or face coverings if possible</li>
                    {voiceEnabled && <li>• Say "capture" when ready, or click the button below</li>}
                  </ul>
                </div>

                {/* Actions */}
                <div className="flex gap-4">
                  <FuturisticButton variant="secondary" onClick={handleReset}>
                    Cancel
                  </FuturisticButton>
                  <FuturisticButton
                    onClick={handleCapture}
                    disabled={status !== "face-detected" || step === "capturing"}
                    className="flex-1"
                  >
                    {step === "capturing" ? (
                      <>
                        <span className="animate-pulse">Capturing...</span>
                      </>
                    ) : (
                      <>
                        <FaceIdIcon className="w-5 h-5 inline mr-2" />
                        Capture Face
                      </>
                    )}
                  </FuturisticButton>
                </div>
              </div>
            </GlowBorder>
          </div>
        )}

        {/* Step: Success */}
        {step === "success" && (
          <GlowBorder active={true} color="emerald" className="animate-fade-in">
            <div className="p-12 text-center">
              <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center animate-float">
                <svg className="w-12 h-12 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-3xl font-bold mb-2">
                <GradientText>Enrollment Successful!</GradientText>
              </h2>
              <p className="text-slate-400 mb-8 max-w-md mx-auto">
                {selectedUser?.username}'s face has been successfully enrolled. 
                They can now log in using face recognition.
              </p>
              <div className="flex gap-4 justify-center">
                <FuturisticButton variant="secondary" onClick={handleReset}>
                  Enroll Another
                </FuturisticButton>
                <FuturisticButton onClick={() => router.push("/login")}>
                  Go to Login
                </FuturisticButton>
              </div>
            </div>
          </GlowBorder>
        )}

        {/* Step: Error */}
        {step === "error" && (
          <GlowBorder active={true} color="red" className="animate-fade-in">
            <div className="p-12 text-center">
              <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-red-500/20 border-2 border-red-500 flex items-center justify-center">
                <svg className="w-12 h-12 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h2 className="text-3xl font-bold mb-2 text-red-400">
                Enrollment Failed
              </h2>
              <p className="text-slate-400 mb-2">
                {error || faceError || "An unexpected error occurred"}
              </p>
              <p className="text-sm text-slate-500 mb-8">
                Please try again or contact support if the problem persists.
              </p>
              <div className="flex gap-4 justify-center">
                <FuturisticButton variant="secondary" onClick={() => router.push("/login")}>
                  Back to Login
                </FuturisticButton>
                <FuturisticButton onClick={handleReset}>
                  Try Again
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
