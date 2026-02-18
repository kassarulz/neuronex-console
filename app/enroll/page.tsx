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
  | "registration-form"
  | "registration-success"
  | "camera-setup"
  | "positioning"
  | "capturing"
  | "face-success"
  | "error";

const ROLES = ["Pilot", "CoPilot", "InnovationLead", "Medic", "Admin"];

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

  const [step, setStep] = useState<EnrollmentStep>("registration-form");
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [voiceListening, setVoiceListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [captureProgress, setCaptureProgress] = useState(0);
  
  // Manual registration form state
  const [formUsername, setFormUsername] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formRole, setFormRole] = useState(ROLES[0]);
  const [enrollFaceAfter, setEnrollFaceAfter] = useState(true);
  const [newlyCreatedUser, setNewlyCreatedUser] = useState<User | null>(null);

  const voiceAssistant = typeof window !== "undefined" ? getVoiceAssistant() : null;

  // Core registration logic (used by both form submit and voice command)
  const submitRegistration = useCallback(async () => {
    if (!formUsername || !formPassword) {
      setError("Username and password are required");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: formUsername,
          password: formPassword,
          role: formRole,
        }),
      });

      const data = await res.json();

      if (!data.ok) {
        throw new Error(data.error || "Failed to create user");
      }

      setNewlyCreatedUser(data.user);

      if (enrollFaceAfter) {
        // Proceed to face enrollment for the new user
        setSelectedUser(data.user);
        setStep("camera-setup");
        
        if (voiceAssistant && voiceEnabled) {
          await voiceAssistant.speak(`User ${data.user.username} created successfully. Now let's enroll their face.`);
        }
      } else {
        setStep("registration-success");
        
        if (voiceAssistant && voiceEnabled) {
          await voiceAssistant.speak(`User ${data.user.username} has been created successfully.`);
        }
      }

      // Reset form
      setFormUsername("");
      setFormPassword("");
      setFormRole(ROLES[0]);
    } catch (err: any) {
      setError(err.message);
      if (voiceAssistant && voiceEnabled) {
        await voiceAssistant.speak("Failed to create user. " + err.message);
      }
    } finally {
      setLoading(false);
    }
  }, [formUsername, formPassword, formRole, enrollFaceAfter, voiceAssistant, voiceEnabled]);

  // Initialize voice assistant
  useEffect(() => {
    if (!voiceAssistant) return;

    voiceAssistant.setEnabled(voiceEnabled);
    
    if (voiceEnabled && step === "registration-form") {
      voiceAssistant.speak("Welcome to registration. Fill in the user details and say 'create user' to register.");
      setVoiceListening(true);
      voiceAssistant.startListening();
    }

    voiceAssistant.onCommand((action) => {
      switch (action) {
        case "CAPTURE":
          if (step === "positioning" && status === "face-detected") {
            handleCapture();
          }
          break;
        case "CREATE_USER":
          if (step === "registration-form" && formUsername && formPassword) {
            submitRegistration();
          } else if (step === "registration-form") {
            voiceAssistant.speak("Please fill in the username and password fields first.");
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
  }, [voiceEnabled, voiceAssistant, step, status, formUsername, formPassword, submitRegistration]);

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

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    await submitRegistration();
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

      setStep("face-success");
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
    setStep("registration-form");
    setSelectedUser(null);
    setError(null);
    setCaptureProgress(0);
    setVoiceListening(false);
    setNewlyCreatedUser(null);
    setFormUsername("");
    setFormPassword("");
    setFormRole(ROLES[0]);
    setEnrollFaceAfter(true);
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
              <svg className="w-10 h-10 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
              <GradientText>Registration</GradientText>
            </h1>
            <p className="text-slate-400 mt-1">
              Medi Runner Control Console • User Registration
            </p>
          </div>
          <FuturisticButton variant="ghost" onClick={() => router.push("/login")}>
            Back to Login
          </FuturisticButton>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto">
        {/* Step: Registration Form */}
        {step === "registration-form" && (
          <GlowBorder active={true} color="emerald" className="animate-fade-in">
            <div className="p-8">
              <h2 className="text-xl font-semibold mb-2">Create New User</h2>
              <p className="text-slate-400 mb-6">
                Fill in the details below to register a new user account.
              </p>

              <form onSubmit={handleRegister} className="space-y-6">
                {/* Username */}
                <div>
                  <label htmlFor="username" className="block text-sm font-medium text-slate-300 mb-2">
                    Username
                  </label>
                  <input
                    id="username"
                    type="text"
                    value={formUsername}
                    onChange={(e) => setFormUsername(e.target.value)}
                    required
                    className="w-full px-4 py-3 rounded-xl bg-slate-800/50 border border-slate-700 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-colors text-white placeholder-slate-500"
                    placeholder="Enter username"
                  />
                </div>

                {/* Password */}
                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-slate-300 mb-2">
                    Password
                  </label>
                  <input
                    id="password"
                    type="password"
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                    required
                    className="w-full px-4 py-3 rounded-xl bg-slate-800/50 border border-slate-700 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-colors text-white placeholder-slate-500"
                    placeholder="Enter password"
                  />
                </div>

                {/* Role */}
                <div>
                  <label htmlFor="role" className="block text-sm font-medium text-slate-300 mb-2">
                    Role
                  </label>
                  <select
                    id="role"
                    value={formRole}
                    onChange={(e) => setFormRole(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-slate-800/50 border border-slate-700 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-colors text-white"
                  >
                    {ROLES.map((role) => (
                      <option key={role} value={role} className="bg-slate-800">
                        {role}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Enroll Face Option */}
                <div className="flex items-center gap-3">
                  <input
                    id="enrollFace"
                    type="checkbox"
                    checked={enrollFaceAfter}
                    onChange={(e) => setEnrollFaceAfter(e.target.checked)}
                    className="w-5 h-5 rounded bg-slate-800 border-slate-600 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-0"
                  />
                  <label htmlFor="enrollFace" className="text-sm text-slate-300">
                    Enroll face biometrics after registration
                  </label>
                </div>

                {/* Voice command hint */}
                {voiceEnabled && (
                  <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm flex items-center gap-2">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                    </svg>
                    <span>Say <strong>"Create user"</strong> to register when fields are filled</span>
                  </div>
                )}

                {error && (
                  <div className="p-4 rounded-xl bg-red-500/20 border border-red-500/50 text-red-300">
                    {error}
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-4">
                  <FuturisticButton type="button" variant="secondary" onClick={() => router.push("/login")}>
                    Cancel
                  </FuturisticButton>
                  <FuturisticButton type="submit" disabled={loading} className="flex-1">
                    {loading ? (
                      <span className="animate-pulse">Creating...</span>
                    ) : (
                      <>
                        <svg className="w-5 h-5 inline mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                        Create User
                      </>
                    )}
                  </FuturisticButton>
                </div>
              </form>
            </div>
          </GlowBorder>
        )}

        {/* Step: Registration Success (no face enrollment) */}
        {step === "registration-success" && (
          <GlowBorder active={true} color="emerald" className="animate-fade-in">
            <div className="p-12 text-center">
              <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center animate-float">
                <svg className="w-12 h-12 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-3xl font-bold mb-2">
                <GradientText>User Created!</GradientText>
              </h2>
              <p className="text-slate-400 mb-8 max-w-md mx-auto">
                {newlyCreatedUser?.username} has been registered successfully as {newlyCreatedUser?.role}.
                They can now log in using their password.
              </p>
              <div className="flex gap-4 justify-center">
                <FuturisticButton 
                  variant="secondary" 
                  onClick={() => {
                    if (newlyCreatedUser) {
                      setSelectedUser(newlyCreatedUser);
                      setStep("camera-setup");
                    }
                  }}
                >
                  <FaceIdIcon className="w-5 h-5 inline mr-2" />
                  Add Face Now
                </FuturisticButton>
                <FuturisticButton variant="secondary" onClick={handleReset}>
                  Add Another User
                </FuturisticButton>
                <FuturisticButton onClick={() => router.push("/login")}>
                  Go to Login
                </FuturisticButton>
              </div>
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

        {/* Step: Face Enrollment Success */}
        {step === "face-success" && (
          <GlowBorder active={true} color="emerald" className="animate-fade-in">
            <div className="p-12 text-center">
              <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center animate-float">
                <svg className="w-12 h-12 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-3xl font-bold mb-2">
                <GradientText>Registration Complete!</GradientText>
              </h2>
              <p className="text-slate-400 mb-8 max-w-md mx-auto">
                {selectedUser?.username}'s face has been successfully enrolled. 
                They can now log in using face recognition.
              </p>
              <div className="flex gap-4 justify-center">
                <FuturisticButton variant="secondary" onClick={handleReset}>
                  Register Another User
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
