// lib/useFaceRecognition.ts
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as faceapi from "face-api.js";

export type FaceDetectionStatus = 
  | "idle"
  | "loading-models"
  | "models-loaded"
  | "camera-starting"
  | "camera-ready"
  | "detecting"
  | "face-detected"
  | "no-face"
  | "multiple-faces"
  | "capturing"
  | "captured"
  | "error";

export type FaceRecognitionResult = {
  success: boolean;
  descriptor?: Float32Array;
  error?: string;
  confidence?: number;
  matchedUserId?: number;
  matchedUsername?: string;
};

const MODEL_URL = "/models";

export function useFaceRecognition() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectionIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  const [status, setStatus] = useState<FaceDetectionStatus>("idle");
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [faceBox, setFaceBox] = useState<faceapi.Box | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load face-api.js models
  const loadModels = useCallback(async () => {
    if (modelsLoaded) return true;
    
    setStatus("loading-models");
    setError(null);
    
    try {
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
      ]);
      
      setModelsLoaded(true);
      setStatus("models-loaded");
      return true;
    } catch (err) {
      console.error("Failed to load face-api models:", err);
      setError("Failed to load face recognition models. Please refresh the page.");
      setStatus("error");
      return false;
    }
  }, [modelsLoaded]);

  // Start camera stream
  const startCamera = useCallback(async () => {
    if (!videoRef.current) {
      setError("Video element not available");
      return false;
    }

    setStatus("camera-starting");
    setError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: "user",
        },
      });

      streamRef.current = stream;
      videoRef.current.srcObject = stream;
      
      await new Promise<void>((resolve) => {
        if (videoRef.current) {
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play();
            resolve();
          };
        }
      });

      setStatus("camera-ready");
      return true;
    } catch (err) {
      console.error("Failed to start camera:", err);
      setError("Failed to access camera. Please ensure camera permissions are granted.");
      setStatus("error");
      return false;
    }
  }, []);

  // Stop camera stream
  const stopCamera = useCallback(() => {
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current);
      detectionIntervalRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setFaceBox(null);
    setStatus("idle");
  }, []);

  // Detect face in current frame
  const detectFace = useCallback(async (): Promise<faceapi.WithFaceDescriptor<faceapi.WithFaceLandmarks<{ detection: faceapi.FaceDetection }, faceapi.FaceLandmarks68>> | null> => {
    if (!videoRef.current || !modelsLoaded) return null;

    try {
      const detections = await faceapi
        .detectAllFaces(videoRef.current, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 }))
        .withFaceLandmarks()
        .withFaceDescriptors();

      if (detections.length === 0) {
        setStatus("no-face");
        setFaceBox(null);
        return null;
      }

      if (detections.length > 1) {
        setStatus("multiple-faces");
        setFaceBox(null);
        return null;
      }

      const detection = detections[0];
      setFaceBox(detection.detection.box);
      setStatus("face-detected");
      return detection;
    } catch (err) {
      console.error("Face detection error:", err);
      return null;
    }
  }, [modelsLoaded]);

  // Start continuous face detection
  const startDetection = useCallback(() => {
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current);
    }

    setStatus("detecting");

    detectionIntervalRef.current = setInterval(async () => {
      await detectFace();
    }, 200); // Detect every 200ms
  }, [detectFace]);

  // Stop continuous face detection
  const stopDetection = useCallback(() => {
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current);
      detectionIntervalRef.current = null;
    }
  }, []);

  // Capture face descriptor for enrollment
  const captureFaceDescriptor = useCallback(async (): Promise<FaceRecognitionResult> => {
    setStatus("capturing");

    if (!videoRef.current) {
      console.error("captureFaceDescriptor: videoRef.current is null");
      return {
        success: false,
        error: "Video element not available",
      };
    }

    if (!modelsLoaded) {
      console.error("captureFaceDescriptor: models not loaded");
      return {
        success: false,
        error: "Face recognition models not loaded",
      };
    }

    // Check if video is playing
    if (videoRef.current.paused || videoRef.current.ended || videoRef.current.readyState < 2) {
      console.error("captureFaceDescriptor: video not ready", {
        paused: videoRef.current.paused,
        ended: videoRef.current.ended,
        readyState: videoRef.current.readyState
      });
      return {
        success: false,
        error: "Video stream not ready. Please wait a moment and try again.",
      };
    }

    console.log("captureFaceDescriptor: starting detection...");

    try {
      // Add timeout to prevent hanging
      const timeoutPromise = new Promise<null>((_, reject) => {
        setTimeout(() => reject(new Error("Face detection timed out")), 10000);
      });

      const detectionPromise = faceapi
        .detectAllFaces(videoRef.current, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 }))
        .withFaceLandmarks()
        .withFaceDescriptors();

      const detections = await Promise.race([detectionPromise, timeoutPromise]);
      
      if (!detections) {
        return {
          success: false,
          error: "Face detection failed or timed out.",
        };
      }

      console.log("captureFaceDescriptor: detections count =", detections.length);

      if (detections.length === 0) {
        return {
          success: false,
          error: "No face detected. Please position your face in the frame.",
        };
      }

      if (detections.length > 1) {
        return {
          success: false,
          error: "Multiple faces detected. Please ensure only one person is in frame.",
        };
      }

      const detection = detections[0];
      setStatus("captured");
      
      return {
        success: true,
        descriptor: detection.descriptor,
        confidence: detection.detection.score,
      };
    } catch (err) {
      console.error("captureFaceDescriptor error:", err);
      return {
        success: false,
        error: "Face detection failed. Please try again.",
      };
    }
  }, [modelsLoaded]);

  // Recognize face against stored descriptors
  const recognizeFace = useCallback(async (
    storedDescriptors: { userId: number; username: string; descriptor: Float32Array }[]
  ): Promise<FaceRecognitionResult> => {
    const captureResult = await captureFaceDescriptor();
    
    if (!captureResult.success || !captureResult.descriptor) {
      return captureResult;
    }

    // Compare with stored descriptors
    let bestMatch: { userId: number; username: string; distance: number } | null = null;
    
    for (const stored of storedDescriptors) {
      const distance = faceapi.euclideanDistance(
        Array.from(captureResult.descriptor),
        Array.from(stored.descriptor)
      );
      
      if (!bestMatch || distance < bestMatch.distance) {
        bestMatch = {
          userId: stored.userId,
          username: stored.username,
          distance,
        };
      }
    }

    // Threshold for face match (lower is more strict)
    const MATCH_THRESHOLD = 0.6;

    if (bestMatch && bestMatch.distance < MATCH_THRESHOLD) {
      return {
        success: true,
        matchedUserId: bestMatch.userId,
        matchedUsername: bestMatch.username,
        confidence: 1 - bestMatch.distance, // Convert distance to confidence (0-1)
      };
    }

    return {
      success: false,
      error: "Face not recognized",
      confidence: bestMatch ? 1 - bestMatch.distance : 0,
    };
  }, [captureFaceDescriptor]);

  // Draw face overlay on canvas
  const drawFaceOverlay = useCallback(() => {
    if (!canvasRef.current || !videoRef.current) return;

    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;

    const { videoWidth, videoHeight } = videoRef.current;
    canvasRef.current.width = videoWidth;
    canvasRef.current.height = videoHeight;

    ctx.clearRect(0, 0, videoWidth, videoHeight);

    if (faceBox) {
      // Draw futuristic face frame
      ctx.strokeStyle = status === "face-detected" ? "#10b981" : "#ef4444";
      ctx.lineWidth = 2;

      const { x, y, width, height } = faceBox;
      const cornerLength = 20;

      // Top-left corner
      ctx.beginPath();
      ctx.moveTo(x, y + cornerLength);
      ctx.lineTo(x, y);
      ctx.lineTo(x + cornerLength, y);
      ctx.stroke();

      // Top-right corner
      ctx.beginPath();
      ctx.moveTo(x + width - cornerLength, y);
      ctx.lineTo(x + width, y);
      ctx.lineTo(x + width, y + cornerLength);
      ctx.stroke();

      // Bottom-left corner
      ctx.beginPath();
      ctx.moveTo(x, y + height - cornerLength);
      ctx.lineTo(x, y + height);
      ctx.lineTo(x + cornerLength, y + height);
      ctx.stroke();

      // Bottom-right corner
      ctx.beginPath();
      ctx.moveTo(x + width - cornerLength, y + height);
      ctx.lineTo(x + width, y + height);
      ctx.lineTo(x + width, y + height - cornerLength);
      ctx.stroke();

      // Draw scanning line animation effect
      ctx.fillStyle = "rgba(16, 185, 129, 0.1)";
      ctx.fillRect(x, y, width, height);
    }
  }, [faceBox, status]);

  // Update canvas overlay when face box changes
  useEffect(() => {
    drawFaceOverlay();
  }, [faceBox, drawFaceOverlay]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  return {
    videoRef,
    canvasRef,
    status,
    error,
    modelsLoaded,
    faceBox,
    loadModels,
    startCamera,
    stopCamera,
    startDetection,
    stopDetection,
    captureFaceDescriptor,
    recognizeFace,
  };
}

// Utility to convert Float32Array to JSON-safe array
export function descriptorToArray(descriptor: Float32Array): number[] {
  return Array.from(descriptor);
}

// Utility to convert JSON array back to Float32Array
export function arrayToDescriptor(array: number[]): Float32Array {
  return new Float32Array(array);
}
