"use client";

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
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
import { useCamera, type CameraFacingMode } from "@/hooks/useCamera";

interface W3CImageCapture {
  takePhoto(photoSettings?: object): Promise<Blob>;
}

export interface CameraModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (file: File) => void;
  title?: string;
  subtitle?: string;
  reviewTitle?: string;
  reviewSubtitle?: string;
  preferredFacingMode?: CameraFacingMode;
  onFallbackToFileUpload?: () => void;
}

export default function CameraModal({
  isOpen,
  onClose,
  onCapture,
  title = "Take Incident Photo",
  subtitle = "Center the issue in the frame",
  reviewTitle = "Review Incident Photo",
  reviewSubtitle = "Ensure the problem is clearly visible and in focus",
  preferredFacingMode = "environment",
  onFallbackToFileUpload,
}: CameraModalProps) {
  const [mounted, setMounted] = useState(false);

  // Industry UX Features
  const [showGrid, setShowGrid] = useState(false);
  const [isFlashing, setIsFlashing] = useState(false);

  // Review / Confirmation Stage State
  const [capturedFile, setCapturedFile] = useState<File | null>(null);
  const [capturedPreviewUrl, setCapturedPreviewUrl] = useState<string | null>(
    null,
  );

  // Mount check for safe createPortal execution in SSR Next.js
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // WebRTC Camera Management via custom hook
  // When reviewing a photo, isActive: false cleanly stops stream tracks to preserve battery
  const {
    videoRef,
    stream,
    isLoading: cameraLoading,
    error: cameraError,
    facingMode,
    torchSupported,
    torchOn,
    toggleTorch,
    switchCamera,
    retry,
    stopCamera,
  } = useCamera({
    isOpen,
    isActive: !capturedFile,
    preferredFacingMode,
  });

  // Clean up captured preview URL on unmount or URL change
  useEffect(() => {
    return () => {
      if (capturedPreviewUrl) {
        URL.revokeObjectURL(capturedPreviewUrl);
      }
    };
  }, [capturedPreviewUrl]);

  // Reset captured state when modal opens
  useEffect(() => {
    if (isOpen) {
      setCapturedFile(null);
      setCapturedPreviewUrl(null);
    }
  }, [isOpen]);

  const handleClose = useCallback(() => {
    stopCamera();
    if (capturedPreviewUrl) {
      URL.revokeObjectURL(capturedPreviewUrl);
    }
    setCapturedFile(null);
    setCapturedPreviewUrl(null);
    onClose();
  }, [stopCamera, capturedPreviewUrl, onClose]);

  // Dismiss on ESC key
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

  // Dismiss on clicking backdrop
  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  };

  // Photo Capture Engine (ImageCapture API with high-resolution canvas fallback)
  const capturePhoto = useCallback(async () => {
    const video = videoRef.current;
    if (!video || !stream) return;
    const track = stream.getVideoTracks()[0];
    if (!track) return;

    // Visual Shutter Flash Pulse
    setIsFlashing(true);
    setTimeout(() => setIsFlashing(false), 120);

    // Subtle Haptic Feedback
    if (
      typeof navigator !== "undefined" &&
      typeof navigator.vibrate === "function"
    ) {
      try {
        navigator.vibrate([40]);
      } catch {
        // Ignore haptic feedback errors
      }
    }

    try {
      let photoBlob: Blob | null = null;

      // 1. W3C ImageCapture API (hardware sensor native resolution)
      if (
        typeof window !== "undefined" &&
        "ImageCapture" in window &&
        typeof (
          window as unknown as {
            ImageCapture: new (t: MediaStreamTrack) => W3CImageCapture;
          }
        ).ImageCapture === "function"
      ) {
        try {
          const ImageCaptureConstructor = (
            window as unknown as {
              ImageCapture: new (t: MediaStreamTrack) => W3CImageCapture;
            }
          ).ImageCapture;
          const imageCapture = new ImageCaptureConstructor(track);
          photoBlob = await imageCapture.takePhoto();
        } catch (imageCaptureErr) {
          console.warn(
            "ImageCapture.takePhoto failed, using canvas fallback:",
            imageCaptureErr,
          );
        }
      }

      // 2. High-Resolution Canvas Fallback (Safari, Firefox, or unsupported devices)
      if (!photoBlob) {
        if (video.videoWidth === 0 || video.videoHeight === 0) return;
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        // Mirror front camera capture to match mirrored viewfinder
        if (facingMode === "user") {
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
  }, [facingMode, stream, videoRef]);

  // Retake photo: clear snapshot and re-engage stream
  const handleRetake = () => {
    if (capturedPreviewUrl) {
      URL.revokeObjectURL(capturedPreviewUrl);
    }
    setCapturedFile(null);
    setCapturedPreviewUrl(null);
  };

  // Confirm photo: emit File and close modal
  const handleConfirmPhoto = () => {
    if (capturedFile) {
      onCapture(capturedFile);
      handleClose();
    }
  };

  if (!isOpen || !mounted) return null;

  const modalContent = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={handleBackdropClick}
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
                  {capturedFile ? reviewTitle : title}
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
                  <span className="inline-flex items-center gap-1.5 px-2 h-5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 select-none">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                    <span className="text-[10px] font-bold tracking-wider leading-none">
                      PREVIEW
                    </span>
                  </span>
                )}
              </div>
              <p className="text-[11px] text-zinc-400">
                {capturedFile ? reviewSubtitle : subtitle}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {/* Viewfinder Controls (Only visible during live capture) */}
            {!capturedFile && (
              <>
                {/* Torch / Flashlight Toggle */}
                {torchSupported && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={toggleTorch}
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
                  facingMode === "user" ? "-scale-x-100" : ""
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
                  <div className="border-r border-b border-white/20" />
                  <div className="border-r border-b border-white/20" />
                  <div />
                </div>
              )}

              {/* Viewfinder Center Framing Brackets (Vector SVG: zero phantom borders) */}
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
                      onClick={retry}
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
                onClick={switchCamera}
                className="text-xs text-zinc-300 hover:text-white hover:bg-zinc-800 gap-1.5 rounded-lg"
                title="Switch Camera (Front/Back/External)"
              >
                <SwitchCamera className="w-4 h-4 text-primary" />
                <span className="hidden sm:inline">
                  {facingMode === "environment" ? "Front" : "Back"}
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

  return createPortal(modalContent, document.body);
}
