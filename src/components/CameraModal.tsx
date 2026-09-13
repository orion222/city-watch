"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Camera,
  X,
  RefreshCw,
  SwitchCamera,
  AlertCircle,
  Loader2,
  UploadCloud,
  Check,
  RotateCcw,
  Grid3X3,
  Zap,
  ZapOff,
} from "lucide-react";

export interface CameraModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (file: File) => void;
  title?: string;
  preferredFacingMode?: "environment" | "user";
  onFallbackToFileUpload?: () => void;
}

export default function CameraModal({
  isOpen,
  onClose,
  onCapture,
  title = "Take Incident Photo",
  preferredFacingMode = "environment",
  onFallbackToFileUpload,
}: CameraModalProps) {
  const [cameraFacing, setCameraFacing] = useState<"environment" | "user">(
    preferredFacingMode,
  );
  const [availableDevices, setAvailableDevices] = useState<MediaDeviceInfo[]>(
    [],
  );
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  // Industry UX Features
  const [showGrid, setShowGrid] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [isFlashing, setIsFlashing] = useState(false);

  // Review / Confirmation Stage (Industry Standard Pattern)
  const [capturedFile, setCapturedFile] = useState<File | null>(null);
  const [capturedPreviewUrl, setCapturedPreviewUrl] = useState<string | null>(
    null,
  );

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Clean up captured preview URL
  useEffect(() => {
    return () => {
      if (capturedPreviewUrl) {
        URL.revokeObjectURL(capturedPreviewUrl);
      }
    };
  }, [capturedPreviewUrl]);

  // Reset states when modal opens
  useEffect(() => {
    if (isOpen) {
      setCameraFacing(preferredFacingMode);
      setSelectedDeviceId(null);
      setCapturedFile(null);
      setCapturedPreviewUrl(null);
      setTorchOn(false);
    }
  }, [isOpen, preferredFacingMode]);

  // Enumerate video input devices
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
      console.warn("Could not enumerate camera devices:", e);
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraLoading(false);
    setCameraError(null);
    setTorchOn(false);
    setTorchSupported(false);
  }, []);

  const handleClose = useCallback(() => {
    stopCamera();
    if (capturedPreviewUrl) {
      URL.revokeObjectURL(capturedPreviewUrl);
    }
    setCapturedFile(null);
    setCapturedPreviewUrl(null);
    onClose();
  }, [stopCamera, capturedPreviewUrl, onClose]);

  // Media Stream Lifecycle Manager
  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      return;
    }

    // If reviewing a photo, keep stream paused or stopped to conserve battery
    if (capturedFile) return;

    let activeStream: MediaStream | null = null;
    setCameraLoading(true);
    setCameraError(null);

    const videoConstraints: MediaTrackConstraints = selectedDeviceId
      ? {
          deviceId: { exact: selectedDeviceId },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        }
      : {
          facingMode: { ideal: cameraFacing },
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
      setCameraError(
        "Camera access is not supported on this browser or requires a secure (HTTPS) connection.",
      );
      setCameraLoading(false);
      return;
    }

    navigator.mediaDevices
      .getUserMedia(constraints)
      .then(async (stream) => {
        activeStream = stream;
        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          try {
            await videoRef.current.play();
          } catch (err) {
            console.warn("Video autoplay interrupted:", err);
          }
        }

        // Check hardware capabilities (torch / flashlight)
        const track = stream.getVideoTracks()[0];
        if (track && typeof track.getCapabilities === "function") {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const capabilities = track.getCapabilities() as any;
          setTorchSupported(Boolean(capabilities?.torch));
        }

        // Refresh enumerated devices now that permission is granted
        refreshDevices();
        setCameraLoading(false);
      })
      .catch((err: unknown) => {
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
        setCameraError(message);
        setCameraLoading(false);
      });

    return () => {
      if (activeStream) {
        activeStream.getTracks().forEach((track) => track.stop());
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, [
    isOpen,
    cameraFacing,
    selectedDeviceId,
    retryKey,
    capturedFile,
    stopCamera,
    refreshDevices,
  ]);

  // Keyboard shortcut listener (ESC to exit)
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, handleClose]);

  // Toggle Torch / Flashlight
  const handleToggleTorch = async () => {
    if (!streamRef.current || !torchSupported) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (!track) return;
    const nextState = !torchOn;
    try {
      await track.applyConstraints({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        advanced: [{ torch: nextState } as any],
      });
      setTorchOn(nextState);
    } catch (e) {
      console.warn("Failed to toggle camera torch:", e);
    }
  };

  // Switch between available cameras
  const handleToggleCamera = () => {
    if (availableDevices.length > 1) {
      const currentIndex = availableDevices.findIndex(
        (d) => d.deviceId === selectedDeviceId,
      );
      const nextIndex = (currentIndex + 1) % availableDevices.length;
      setSelectedDeviceId(availableDevices[nextIndex].deviceId);
    } else {
      setCameraFacing((prev) =>
        prev === "environment" ? "user" : "environment",
      );
      setSelectedDeviceId(null);
    }
  };

  // Industry Standard Capture Engine (ImageCapture API with High-Res Canvas Fallback)
  const capturePhoto = useCallback(async () => {
    if (!videoRef.current || !streamRef.current) return;
    const video = videoRef.current;
    const stream = streamRef.current;
    const track = stream.getVideoTracks()[0];
    if (!track) return;

    // 1. Visual Shutter Flash Feedback
    setIsFlashing(true);
    setTimeout(() => setIsFlashing(false), 120);

    // 2. Subtle Haptic Feedback
    if (
      typeof navigator !== "undefined" &&
      typeof navigator.vibrate === "function"
    ) {
      try {
        navigator.vibrate([40]);
      } catch {
        // Ignore haptic vibration errors
      }
    }

    try {
      let photoBlob: Blob | null = null;

      // 3. Modern W3C ImageCapture API (Chromium / Android standard: captures native sensor resolution)
      if (typeof window !== "undefined" && "ImageCapture" in window) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const imageCapture = new (window as any).ImageCapture(track);
          photoBlob = await imageCapture.takePhoto();
        } catch (imageCaptureErr) {
          console.warn(
            "ImageCapture.takePhoto failed, using canvas fallback:",
            imageCaptureErr,
          );
        }
      }

      // 4. High-Res Canvas Fallback (iOS Safari, Firefox, or when ImageCapture is unavailable)
      if (!photoBlob) {
        if (video.videoWidth === 0 || video.videoHeight === 0) return;
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        // Mirror front camera capture so result matches mirrored viewfinder
        if (cameraFacing === "user") {
          ctx.translate(canvas.width, 0);
          ctx.scale(-1, 1);
        }

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        photoBlob = await new Promise<Blob | null>((resolve) => {
          canvas.toBlob((b) => resolve(b), "image/jpeg", 0.95);
        });
      }

      if (!photoBlob) return;

      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const file = new File([photoBlob], `incident-photo-${timestamp}.jpg`, {
        type: "image/jpeg",
      });

      const previewUrl = URL.createObjectURL(file);
      setCapturedFile(file);
      setCapturedPreviewUrl(previewUrl);
    } catch (err) {
      console.error("Error capturing photo:", err);
    }
  }, [cameraFacing]);

  // Review Screen: Retake photo
  const handleRetake = () => {
    if (capturedPreviewUrl) {
      URL.revokeObjectURL(capturedPreviewUrl);
    }
    setCapturedFile(null);
    setCapturedPreviewUrl(null);
  };

  // Review Screen: Confirm and use photo
  const handleConfirmPhoto = () => {
    if (capturedFile) {
      onCapture(capturedFile);
      handleClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Camera Viewfinder"
      className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-lg bg-zinc-950 border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 bg-zinc-900/90 text-zinc-100 z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm">
                  {capturedFile ? "Review Incident Photo" : title}
                </span>
                {!capturedFile && !cameraLoading && !cameraError && (
                  <span className="inline-flex items-center gap-1.5 px-2 h-5 rounded-full bg-red-500/15 text-red-400 border border-red-500/30 select-none">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse shrink-0" />
                    <span className="text-[10px] font-bold tracking-wider leading-none">
                      LIVE
                    </span>
                  </span>
                )}
                {capturedFile && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    PREVIEW
                  </span>
                )}
              </div>
              <p className="text-[11px] text-zinc-400">
                {capturedFile
                  ? "Ensure the problem is clearly visible and in focus"
                  : "Center the issue in the frame"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {/* Viewfinder Controls (Only visible during live capture) */}
            {!capturedFile && (
              <>
                {/* Torch / Flash Toggle */}
                {torchSupported && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={handleToggleTorch}
                    className={`h-8 w-8 rounded-full ${
                      torchOn
                        ? "text-yellow-400 bg-yellow-400/10"
                        : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800"
                    }`}
                    aria-label={torchOn ? "Turn off flash" : "Turn on flash"}
                    title="Flashlight"
                  >
                    {torchOn ? (
                      <Zap className="w-4 h-4 fill-current" />
                    ) : (
                      <ZapOff className="w-4 h-4" />
                    )}
                  </Button>
                )}

                {/* 3x3 Grid Toggle */}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowGrid(!showGrid)}
                  className={`h-8 w-8 rounded-full ${
                    showGrid
                      ? "text-primary bg-primary/10"
                      : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800"
                  }`}
                  aria-label="Toggle rule-of-thirds grid"
                  title="Framing Grid"
                >
                  <Grid3X3 className="w-4 h-4" />
                </Button>
              </>
            )}

            {/* Close Button */}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={handleClose}
              className="h-8 w-8 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-full"
              aria-label="Close camera"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Camera Viewfinder / Review Stage Area */}
        <div className="relative aspect-4/3 w-full bg-black flex items-center justify-center overflow-hidden select-none">
          {capturedPreviewUrl ? (
            /* Review Photo Screen */
            <div className="relative w-full h-full bg-black flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={capturedPreviewUrl}
                alt="Captured review"
                className="w-full h-full object-contain"
              />
            </div>
          ) : (
            /* Live Camera Stream */
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover ${
                  cameraFacing === "user" ? "-scale-x-100" : ""
                }`}
              />

              {/* Shutter Visual Flash Animation */}
              <div
                className={`absolute inset-0 bg-white transition-opacity duration-150 pointer-events-none ${
                  isFlashing ? "opacity-90" : "opacity-0"
                }`}
              />

              {/* Rule of Thirds (3x3) Grid */}
              {showGrid && !cameraLoading && !cameraError && (
                <div className="absolute inset-0 pointer-events-none grid grid-cols-3 grid-rows-3">
                  <div className="border-r border-b border-white/20" />
                  <div className="border-r border-b border-white/20" />
                  <div className="border-b border-white/20" />
                  <div className="border-r border-b border-white/20" />
                  <div className="border-r border-b border-white/20" />
                  <div className="border-b border-white/20" />
                  <div className="border-r border-white/20" />
                  <div className="border-r border-white/20" />
                  <div />
                </div>
              )}

              {/* Viewfinder Center Framing Brackets (Vector SVG: clean lines, zero phantom borders) */}
              {!cameraLoading && !cameraError && (
                <div className="absolute inset-8 sm:inset-10 pointer-events-none flex flex-col justify-between">
                  <div className="flex justify-between">
                    {/* Top Left */}
                    <svg
                      className="w-6 h-6 text-primary drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M3 12V5a2 2 0 0 1 2-2h7" />
                    </svg>

                    {/* Top Right */}
                    <svg
                      className="w-6 h-6 text-primary drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M21 12V5a2 2 0 0 0-2-2h-7" />
                    </svg>
                  </div>

                  <div className="flex justify-between">
                    {/* Bottom Left */}
                    <svg
                      className="w-6 h-6 text-primary drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M3 12v7a2 2 0 0 0 2 2h7" />
                    </svg>

                    {/* Bottom Right */}
                    <svg
                      className="w-6 h-6 text-primary drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M21 12v7a2 2 0 0 1-2 2h-7" />
                    </svg>
                  </div>
                </div>
              )}

              {/* Loading Indicator */}
              {cameraLoading && (
                <div className="absolute inset-0 bg-black/75 flex flex-col items-center justify-center gap-2.5 text-white">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  <p className="text-xs text-zinc-300 font-medium">
                    Initializing camera...
                  </p>
                </div>
              )}

              {/* Error Overlay */}
              {cameraError && (
                <div className="absolute inset-0 bg-zinc-950/95 p-6 flex flex-col items-center justify-center text-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center">
                    <AlertCircle className="w-6 h-6" />
                  </div>
                  <div className="space-y-1 max-w-xs">
                    <p className="text-sm font-semibold text-zinc-100">
                      Camera Unavailable
                    </p>
                    <p className="text-xs text-zinc-400 leading-relaxed">
                      {cameraError}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setRetryKey((k) => k + 1)}
                      className="text-xs border-zinc-700 bg-zinc-900 text-zinc-200 hover:bg-zinc-800"
                    >
                      <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                      Try Again
                    </Button>
                    {onFallbackToFileUpload && (
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => {
                          handleClose();
                          onFallbackToFileUpload();
                        }}
                        className="text-xs"
                      >
                        <UploadCloud className="w-3.5 h-3.5 mr-1.5" />
                        Choose File Instead
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Viewfinder Controls Toolbar */}
        <div className="px-6 py-4 bg-zinc-900/90 border-t border-zinc-800 flex items-center justify-between">
          {capturedFile ? (
            /* Review Actions: Retake vs Confirm */
            <div className="w-full flex items-center justify-between gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={handleRetake}
                className="flex-1 text-xs border-zinc-700 bg-zinc-900 text-zinc-200 hover:bg-zinc-800 hover:text-white h-10 gap-1.5 rounded-xl cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Retake
              </Button>

              <Button
                type="button"
                variant="default"
                onClick={handleConfirmPhoto}
                className="flex-1 text-xs h-10 gap-1.5 rounded-xl cursor-pointer shadow-md font-medium"
              >
                <Check className="w-4 h-4" />
                Use Photo
              </Button>
            </div>
          ) : (
            /* Live Capture Controls */
            <>
              {/* Switch Camera Button */}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={cameraLoading || Boolean(cameraError)}
                onClick={handleToggleCamera}
                className="text-xs text-zinc-300 hover:text-white hover:bg-zinc-800 gap-1.5 rounded-lg"
                title="Switch Camera (Front/Back/External)"
              >
                <SwitchCamera className="w-4 h-4 text-primary" />
                <span className="hidden sm:inline">
                  {cameraFacing === "environment" ? "Front" : "Back"}
                </span>
              </Button>

              {/* Shutter Button (iOS/Android Camera Style) */}
              <button
                type="button"
                disabled={cameraLoading || Boolean(cameraError)}
                onClick={capturePhoto}
                aria-label="Capture photo"
                className="group relative flex items-center justify-center w-16 h-16 rounded-full border-4 border-white/80 hover:border-white transition-all duration-150 active:scale-90 disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
              >
                <div className="w-12 h-12 rounded-full bg-white group-hover:bg-primary transition-colors duration-150" />
              </button>

              {/* Cancel Button */}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleClose}
                className="text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg"
              >
                Cancel
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
