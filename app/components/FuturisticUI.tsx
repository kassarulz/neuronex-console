// app/components/FuturisticUI.tsx
"use client";

import { useEffect, useState } from "react";

// Animated scanning line component
export function ScanningLine({ active = true }: { active?: boolean }) {
  if (!active) return null;
  
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div className="scanning-line absolute w-full h-1 bg-gradient-to-r from-transparent via-emerald-400 to-transparent animate-scan" />
    </div>
  );
}

// Glowing border component
export function GlowBorder({ 
  children, 
  color = "emerald",
  active = true,
  className = "" 
}: { 
  children: React.ReactNode;
  color?: "emerald" | "cyan" | "purple" | "red";
  active?: boolean;
  className?: string;
}) {
  const colorClasses = {
    emerald: "from-emerald-500/50 via-emerald-400/50 to-emerald-500/50 shadow-emerald-500/20",
    cyan: "from-cyan-500/50 via-cyan-400/50 to-cyan-500/50 shadow-cyan-500/20",
    purple: "from-purple-500/50 via-purple-400/50 to-purple-500/50 shadow-purple-500/20",
    red: "from-red-500/50 via-red-400/50 to-red-500/50 shadow-red-500/20",
  };

  return (
    <div className={`relative ${className}`}>
      {active && (
        <div className={`absolute -inset-0.5 bg-gradient-to-r ${colorClasses[color]} rounded-2xl blur opacity-75 animate-pulse`} />
      )}
      <div className="relative bg-slate-900 rounded-2xl border border-slate-800">
        {children}
      </div>
    </div>
  );
}

// Pulse ring animation for face detection
export function PulseRing({ active = false, color = "emerald" }: { active?: boolean; color?: string }) {
  if (!active) return null;
  
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      <div className={`absolute w-64 h-64 rounded-full border-2 border-${color}-400 animate-ping opacity-20`} />
      <div className={`absolute w-72 h-72 rounded-full border-2 border-${color}-400 animate-ping opacity-10 animation-delay-300`} />
      <div className={`absolute w-80 h-80 rounded-full border-2 border-${color}-400 animate-ping opacity-5 animation-delay-600`} />
    </div>
  );
}

// Voice assistant indicator
export function VoiceIndicator({ 
  isListening, 
  isEnabled,
  onToggle,
  transcript = ""
}: { 
  isListening: boolean;
  isEnabled: boolean;
  onToggle: () => void;
  transcript?: string;
}) {
  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      {/* Transcript bubble */}
      {transcript && isEnabled && (
        <div className="bg-slate-800/90 backdrop-blur-sm border border-slate-700 rounded-xl px-4 py-2 max-w-xs animate-fade-in">
          <p className="text-sm text-slate-300">
            <span className="text-emerald-400">"</span>
            {transcript}
            <span className="text-emerald-400">"</span>
          </p>
        </div>
      )}
      
      {/* Voice toggle button */}
      <button
        onClick={onToggle}
        className={`group relative w-14 h-14 rounded-full transition-all duration-300 ${
          isEnabled 
            ? "bg-gradient-to-r from-emerald-500 to-cyan-500 shadow-lg shadow-emerald-500/30" 
            : "bg-slate-800 border border-slate-700"
        }`}
      >
        {/* Sound waves animation */}
        {isListening && isEnabled && (
          <>
            <span className="absolute inset-0 rounded-full border-2 border-emerald-400 animate-ping opacity-50" />
            <span className="absolute inset-2 rounded-full border border-emerald-300 animate-ping opacity-30 animation-delay-150" />
          </>
        )}
        
        {/* Microphone icon */}
        <svg 
          className={`w-6 h-6 mx-auto transition-colors ${isEnabled ? "text-white" : "text-slate-400 group-hover:text-slate-200"}`}
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor"
        >
          {isEnabled ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
          )}
        </svg>
        
        {/* Label */}
        <span className={`absolute -top-8 left-1/2 -translate-x-1/2 text-xs whitespace-nowrap px-2 py-1 rounded bg-slate-800 border border-slate-700 opacity-0 group-hover:opacity-100 transition-opacity ${isEnabled ? "text-emerald-400" : "text-slate-400"}`}>
          {isEnabled ? "Voice ON" : "Voice OFF"}
        </span>
      </button>
    </div>
  );
}

// Camera viewfinder component
export function CameraViewfinder({ 
  status,
  className = ""
}: { 
  status: "idle" | "detecting" | "detected" | "error";
  className?: string;
}) {
  const statusColors = {
    idle: "border-slate-600",
    detecting: "border-cyan-500",
    detected: "border-emerald-500",
    error: "border-red-500",
  };

  return (
    <div className={`absolute inset-0 pointer-events-none ${className}`}>
      {/* Corner brackets */}
      <div className="absolute top-4 left-4 w-12 h-12">
        <div className={`absolute top-0 left-0 w-full h-0.5 ${statusColors[status]} bg-current`} />
        <div className={`absolute top-0 left-0 w-0.5 h-full ${statusColors[status]} bg-current`} />
      </div>
      <div className="absolute top-4 right-4 w-12 h-12">
        <div className={`absolute top-0 right-0 w-full h-0.5 ${statusColors[status]} bg-current`} />
        <div className={`absolute top-0 right-0 w-0.5 h-full ${statusColors[status]} bg-current`} />
      </div>
      <div className="absolute bottom-4 left-4 w-12 h-12">
        <div className={`absolute bottom-0 left-0 w-full h-0.5 ${statusColors[status]} bg-current`} />
        <div className={`absolute bottom-0 left-0 w-0.5 h-full ${statusColors[status]} bg-current`} />
      </div>
      <div className="absolute bottom-4 right-4 w-12 h-12">
        <div className={`absolute bottom-0 right-0 w-full h-0.5 ${statusColors[status]} bg-current`} />
        <div className={`absolute bottom-0 right-0 w-0.5 h-full ${statusColors[status]} bg-current`} />
      </div>

      {/* Center crosshair */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
        <div className={`w-16 h-0.5 ${statusColors[status]} bg-current opacity-50`} />
        <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-0.5 h-16 ${statusColors[status]} bg-current opacity-50`} />
        <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 rounded-full border ${statusColors[status]}`} />
      </div>

      {/* Scanning animation for detecting state */}
      {status === "detecting" && (
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute w-full h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent animate-scan-vertical opacity-50" />
        </div>
      )}
    </div>
  );
}

// Status badge component
export function StatusBadge({ 
  status, 
  text 
}: { 
  status: "success" | "warning" | "error" | "info" | "loading";
  text: string;
}) {
  const statusStyles = {
    success: "bg-emerald-500/20 text-emerald-400 border-emerald-500/50",
    warning: "bg-amber-500/20 text-amber-400 border-amber-500/50",
    error: "bg-red-500/20 text-red-400 border-red-500/50",
    info: "bg-cyan-500/20 text-cyan-400 border-cyan-500/50",
    loading: "bg-purple-500/20 text-purple-400 border-purple-500/50",
  };

  return (
    <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm border ${statusStyles[status]}`}>
      {status === "loading" && (
        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      )}
      {status === "success" && (
        <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
        </svg>
      )}
      {status === "error" && (
        <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
        </svg>
      )}
      {text}
    </span>
  );
}

// Futuristic button component
export function FuturisticButton({
  children,
  onClick,
  disabled = false,
  variant = "primary",
  size = "md",
  className = "",
  type = "button",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
  className?: string;
  type?: "button" | "submit" | "reset";
}) {
  const variantStyles = {
    primary: "bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-white shadow-lg shadow-emerald-500/25",
    secondary: "bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700",
    danger: "bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-400 hover:to-rose-400 text-white shadow-lg shadow-red-500/25",
    ghost: "bg-transparent hover:bg-slate-800/50 text-slate-400 hover:text-slate-200",
  };

  const sizeStyles = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-5 py-2.5 text-base",
    lg: "px-8 py-3.5 text-lg",
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`
        relative font-semibold rounded-xl transition-all duration-300 
        disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100
        hover:scale-[1.02] active:scale-[0.98]
        ${variantStyles[variant]} ${sizeStyles[size]} ${className}
      `}
    >
      {children}
    </button>
  );
}

// Animated gradient text
export function GradientText({ 
  children, 
  className = "" 
}: { 
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={`bg-gradient-to-r from-emerald-400 via-cyan-400 to-purple-400 bg-clip-text text-transparent animate-gradient-x ${className}`}>
      {children}
    </span>
  );
}

// Loading spinner with custom animation
export function FuturisticLoader({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const sizeClasses = {
    sm: "w-8 h-8",
    md: "w-12 h-12",
    lg: "w-16 h-16",
  };

  return (
    <div className={`${sizeClasses[size]} relative`}>
      <div className="absolute inset-0 rounded-full border-2 border-slate-700" />
      <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-emerald-400 animate-spin" />
      <div className="absolute inset-1 rounded-full border-2 border-transparent border-t-cyan-400 animate-spin animation-delay-150" style={{ animationDirection: "reverse" }} />
      <div className="absolute inset-2 rounded-full bg-emerald-400/20 animate-pulse" />
    </div>
  );
}

// Face ID icon component
export function FaceIdIcon({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      {/* Top left corner */}
      <path d="M4 8V6a2 2 0 012-2h2" strokeLinecap="round" />
      {/* Top right corner */}
      <path d="M16 4h2a2 2 0 012 2v2" strokeLinecap="round" />
      {/* Bottom left corner */}
      <path d="M4 16v2a2 2 0 002 2h2" strokeLinecap="round" />
      {/* Bottom right corner */}
      <path d="M16 20h2a2 2 0 002-2v-2" strokeLinecap="round" />
      {/* Face elements */}
      <circle cx="9" cy="10" r="1" fill="currentColor" />
      <circle cx="15" cy="10" r="1" fill="currentColor" />
      <path d="M9 15c.83.67 2 1 3 1s2.17-.33 3-1" strokeLinecap="round" />
    </svg>
  );
}
