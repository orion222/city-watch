"use client";

import { useState, useRef, useEffect, useCallback } from "react";

export type CameraFacingMode = "environment" | "user";

export interface ExtendedMediaTrackCapabilities extends MediaTrackCapabilities {
  torch?: boolean;
}

export interface ExtendedMediaTrackConstraintSet extends MediaTrackConstraintSet {
  torch?: boolean;
}

export interface UseCameraOptions {
  isOpen: boolean;
  isActive?: boolean;
  preferredFacingMode?: CameraFacingMode;
}

export interface UseCameraReturn {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  stream: MediaStream | null;
  isLoading: boolean;
  error: string | null;
  facingMode: CameraFacingMode;
  torchSupported: boolean;
  torchOn: boolean;
  availableDevices: MediaDeviceInfo[];
  selectedDeviceId: string | null;
  toggleFacingMode: () => void;
  toggleTorch: () => Promise<void>;
  switchCamera: () => void;
  selectDevice: (deviceId: string) => void;
  retry: () => void;
  stopCamera: () => void;
}

export function useCamera({
  isOpen,
  isActive = true,
  preferredFacingMode = "environment",
}: UseCameraOptions): UseCameraReturn {
  const [facingMode, setFacingMode] = useState<CameraFacingMode>(preferredFacingMode);
  const [availableDevices, setAvailableDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Sync preferredFacingMode when modal opens
  useEffect(() => {
    if (isOpen) {
      setFacingMode(preferredFacingMode);
      setSelectedDeviceId(null);
      setTorchOn(false);
    }
  }, [isOpen, preferredFacingMode]);

  // Cleanly stops all active media tracks and clears references
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsLoading(false);
    setError(null);
    setTorchOn(false);
    setTorchSupported(false);
  }, []);

  // Enumerate video devices
  const refreshDevices = useCallback(async () => {
    if (
      typeof navigator === "undefined" ||
      typeof navigator.mediaDevices?.enumerateDevices !== "function"
    ) {
      return;
    }
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = devices.filter((d) => d.kind === "videoinput");
      setAvailableDevices(videoInputs);
    } catch (e) {
      console.warn("Unable to enumerate video input devices:", e);
    }
  }, []);

  // Listen to external hardware device changes (plugging in / unplugging webcams)
  useEffect(() => {
    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices ||
      typeof navigator.mediaDevices.addEventListener !== "function"
    ) {
      return;
    }

    const handleDeviceChange = () => {
      refreshDevices();
    };

    navigator.mediaDevices.addEventListener("devicechange", handleDeviceChange);
    return () => {
      navigator.mediaDevices.removeEventListener("devicechange", handleDeviceChange);
    };
  }, [refreshDevices]);

  // Main stream lifecycle effect with cancellation token to prevent orphaned streams
  useEffect(() => {
    // If modal is closed or intentionally inactive (e.g. photo review screen), terminate stream
    if (!isOpen || !isActive) {
      stopCamera();
      return;
    }

    let isCancelled = false;
    let localStream: MediaStream | null = null;

    setIsLoading(true);
    setError(null);

    const videoConstraints: MediaTrackConstraints = selectedDeviceId
      ? {
          deviceId: { exact: selectedDeviceId },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        }
      : {
          facingMode: { ideal: facingMode },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        };

    const constraints: MediaStreamConstraints = {
      video: videoConstraints,
      audio: false,
    };

    if (
      typeof navigator === "undefined" ||
      typeof navigator.mediaDevices?.getUserMedia !== "function"
    ) {
      setError(
        "Camera access is not supported on this browser or requires a secure (HTTPS) connection."
      );
      setIsLoading(false);
      return;
    }

    navigator.mediaDevices
      .getUserMedia(constraints)
      .then(async (stream) => {
        // RACE CONDITION GUARD: If cancelled before getUserMedia resolved, immediately stop tracks
        if (isCancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        localStream = stream;
        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          try {
            await videoRef.current.play();
          } catch (err) {
            console.warn("Video auto-play interrupted:", err);
          }
        }

        // Query hardware capabilities for torch
        const track = stream.getVideoTracks()[0];
        if (track && typeof track.getCapabilities === "function") {
          const capabilities = track.getCapabilities() as ExtendedMediaTrackCapabilities;
          setTorchSupported(Boolean(capabilities?.torch));
        }

        // Populate device names now that permission is granted
        refreshDevices();
        setIsLoading(false);
      })
      .catch((err: unknown) => {
        if (isCancelled) return;

        console.error("Camera access error:", err);
        let message = "Unable to access the camera.";
        if (err instanceof Error) {
          if (
            err.name === "NotAllowedError" ||
            err.name === "PermissionDeniedError"
          ) {
            message =
              "Camera permission was denied. Please allow camera access in your browser settings.";
          } else if (
            err.name === "NotFoundError" ||
            err.name === "DevicesNotFoundError"
          ) {
            message = "No camera was detected on this device.";
          } else if (
            err.name === "NotReadableError" ||
            err.name === "TrackStartError"
          ) {
            message = "Camera is currently being used by another application.";
          } else {
            message = err.message || message;
          }
        }
        setError(message);
        setIsLoading(false);
      });

    return () => {
      isCancelled = true;
      if (localStream) {
        localStream.getTracks().forEach((track) => track.stop());
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, [
    isOpen,
    isActive,
    facingMode,
    selectedDeviceId,
    retryKey,
    stopCamera,
    refreshDevices,
  ]);

  // Toggle torch / flashlight
  const toggleTorch = useCallback(async () => {
    if (!streamRef.current || !torchSupported) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (!track) return;
    const nextState = !torchOn;
    try {
      await track.applyConstraints({
        advanced: [{ torch: nextState } as ExtendedMediaTrackConstraintSet],
      });
      setTorchOn(nextState);
    } catch (e) {
      console.warn("Failed to toggle camera torch:", e);
    }
  }, [torchSupported, torchOn]);

  // Toggle between front and back camera
  const toggleFacingMode = useCallback(() => {
    setFacingMode((prev) => (prev === "environment" ? "user" : "environment"));
    setSelectedDeviceId(null);
  }, []);

  // Switch to next available camera (cycles through devices if multi-camera)
  const switchCamera = useCallback(() => {
    if (availableDevices.length > 1) {
      const currentIndex = availableDevices.findIndex(
        (d) => d.deviceId === selectedDeviceId
      );
      const nextIndex = (currentIndex + 1) % availableDevices.length;
      setSelectedDeviceId(availableDevices[nextIndex].deviceId);
    } else {
      toggleFacingMode();
    }
  }, [availableDevices, selectedDeviceId, toggleFacingMode]);

  // Select a specific device ID directly
  const selectDevice = useCallback((deviceId: string) => {
    setSelectedDeviceId(deviceId);
  }, []);

  // Force re-initialization
  const retry = useCallback(() => {
    setRetryKey((k) => k + 1);
  }, []);

  return {
    videoRef,
    stream: streamRef.current,
    isLoading,
    error,
    facingMode,
    torchSupported,
    torchOn,
    availableDevices,
    selectedDeviceId,
    toggleFacingMode,
    toggleTorch,
    switchCamera,
    selectDevice,
    retry,
    stopCamera,
  };
}
