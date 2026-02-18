// lib/voiceAssistant.ts
// Voice Navigation/Assistance using Web Speech API

export type VoiceCommand = {
  patterns: RegExp[];
  action: string;
  response: string;
};

// Predefined voice commands for the application
export const VOICE_COMMANDS: VoiceCommand[] = [
  {
    patterns: [/enroll\s*(me|my\s*face)?/i, /register\s*(me|my\s*face)?/i, /add\s*(my\s*face)?/i],
    action: "ENROLL",
    response: "Alright, taking you to face enrollment section.",
  },
  {
    patterns: [/login/i, /sign\s*in/i, /authenticate/i],
    action: "LOGIN",
    response: "Starting face recognition login.",
  },
  {
    patterns: [/help/i, /what\s*can\s*(you|i)\s*(do|say)/i],
    action: "HELP",
    response: "You can say: Enroll me, Login, or Help. Voice assistance is here to guide you.",
  },
  {
    patterns: [/cancel/i, /stop/i, /go\s*back/i],
    action: "CANCEL",
    response: "Cancelling current action.",
  },
  {
    patterns: [/open\s*camera/i, /start\s*camera/i],
    action: "OPEN_CAMERA",
    response: "Opening camera. Please position your face in the center of the screen.",
  },
  {
    patterns: [/take\s*(a\s*)?(photo|picture|snapshot)/i, /capture/i],
    action: "CAPTURE",
    response: "Capturing your face. Please hold still.",
  },
  {
    patterns: [/create\s*(user|account)?/i, /submit/i, /register\s*user/i],
    action: "CREATE_USER",
    response: "Creating user account.",
  },
];

// Voice feedback messages for different states
export const VOICE_MESSAGES = {
  welcome: "Welcome to Medi Runner Control Console. Say 'Enroll me' to register, or 'Login' to authenticate.",
  enrollStart: "Alright, taking you to face enrollment section.",
  cameraOpening: "Opening camera. Please wait.",
  cameraReady: "Camera is ready. Please focus on the middle area of the screen.",
  faceDetected: "Face detected. Hold still for capture.",
  noFaceDetected: "No face detected. Please position your face in the frame.",
  multipleFaces: "Multiple faces detected. Please ensure only one person is in frame.",
  enrollSuccess: "Okay, successfully enrolled your face. You can now login using face recognition.",
  enrollFailed: "Face enrollment failed. Please try again.",
  loginStart: "Starting face recognition. Please look at the camera.",
  loginSuccess: "Face recognized. Welcome back!",
  loginFailed: "Face not recognized. Please try again or use manual login.",
  listeningStart: "Listening for your command.",
  listeningStop: "Voice recognition stopped.",
  voiceEnabled: "Voice assistance enabled.",
  voiceDisabled: "Voice assistance disabled.",
  error: "An error occurred. Please try again.",
};

class VoiceAssistant {
  private synthesis: SpeechSynthesis | null = null;
  private recognition: SpeechRecognition | null = null;
  private isListening: boolean = false;
  private isEnabled: boolean = true;
  private onCommandCallback: ((action: string) => void) | null = null;
  private onTranscriptCallback: ((transcript: string) => void) | null = null;
  private selectedVoice: SpeechSynthesisVoice | null = null;

  constructor() {
    if (typeof window !== "undefined") {
      this.synthesis = window.speechSynthesis;
      this.initRecognition();
      this.initVoice();
    }
  }

  private initVoice() {
    if (!this.synthesis) return;
    
    // Wait for voices to load
    const setVoice = () => {
      const voices = this.synthesis!.getVoices();
      // Prefer a natural-sounding English voice
      this.selectedVoice = voices.find(v => 
        v.lang.startsWith('en') && (v.name.includes('Neural') || v.name.includes('Natural'))
      ) || voices.find(v => v.lang.startsWith('en')) || voices[0];
    };
    
    if (this.synthesis.getVoices().length > 0) {
      setVoice();
    } else {
      this.synthesis.onvoiceschanged = setVoice;
    }
  }

  private initRecognition() {
    if (typeof window === "undefined") return;
    
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn("Speech Recognition not supported in this browser");
      return;
    }

    this.recognition = new SpeechRecognition();
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = "en-US";

    this.recognition.onresult = (event) => {
      const last = event.results.length - 1;
      const transcript = event.results[last][0].transcript.trim();
      
      if (this.onTranscriptCallback) {
        this.onTranscriptCallback(transcript);
      }

      if (event.results[last].isFinal) {
        this.processCommand(transcript);
      }
    };

    this.recognition.onerror = (event) => {
      console.error("Speech recognition error:", event.error);
      if (event.error === "no-speech" || event.error === "audio-capture") {
        // Restart if no speech detected
        this.restartListening();
      }
    };

    this.recognition.onend = () => {
      if (this.isListening && this.isEnabled) {
        // Auto-restart if still supposed to be listening
        this.restartListening();
      }
    };
  }

  private restartListening() {
    if (this.recognition && this.isListening && this.isEnabled) {
      try {
        setTimeout(() => {
          if (this.isListening) {
            this.recognition?.start();
          }
        }, 100);
      } catch (e) {
        console.error("Failed to restart recognition:", e);
      }
    }
  }

  private processCommand(transcript: string) {
    for (const command of VOICE_COMMANDS) {
      for (const pattern of command.patterns) {
        if (pattern.test(transcript)) {
          this.speak(command.response);
          if (this.onCommandCallback) {
            this.onCommandCallback(command.action);
          }
          return;
        }
      }
    }
  }

  speak(text: string): Promise<void> {
    return new Promise((resolve) => {
      if (!this.synthesis || !this.isEnabled) {
        resolve();
        return;
      }

      // Cancel any ongoing speech
      this.synthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;
      
      if (this.selectedVoice) {
        utterance.voice = this.selectedVoice;
      }

      utterance.onend = () => resolve();
      // Don't reject on error, just resolve to prevent unhandled rejections
      utterance.onerror = (event) => {
        console.warn("Speech synthesis error:", event.error);
        resolve();
      };

      this.synthesis.speak(utterance);
    });
  }

  startListening() {
    if (!this.recognition || !this.isEnabled) return;
    
    this.isListening = true;
    try {
      this.recognition.start();
    } catch (e) {
      // Already started
      console.error("Recognition start error:", e);
    }
  }

  stopListening() {
    this.isListening = false;
    if (this.recognition) {
      this.recognition.stop();
    }
  }

  setEnabled(enabled: boolean) {
    this.isEnabled = enabled;
    if (!enabled) {
      this.stopListening();
      this.synthesis?.cancel();
    }
  }

  isVoiceEnabled(): boolean {
    return this.isEnabled;
  }

  onCommand(callback: (action: string) => void) {
    this.onCommandCallback = callback;
  }

  onTranscript(callback: (transcript: string) => void) {
    this.onTranscriptCallback = callback;
  }

  isSupported(): { synthesis: boolean; recognition: boolean } {
    return {
      synthesis: typeof window !== "undefined" && "speechSynthesis" in window,
      recognition: typeof window !== "undefined" && 
        ("SpeechRecognition" in window || "webkitSpeechRecognition" in window),
    };
  }
}

// Singleton instance
let voiceAssistantInstance: VoiceAssistant | null = null;

export function getVoiceAssistant(): VoiceAssistant {
  if (!voiceAssistantInstance) {
    voiceAssistantInstance = new VoiceAssistant();
  }
  return voiceAssistantInstance;
}

// Type declarations for Web Speech API
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
  isFinal: boolean;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognition;
}

declare global {
  interface Window {
    SpeechRecognition: SpeechRecognitionConstructor;
    webkitSpeechRecognition: SpeechRecognitionConstructor;
  }
}

