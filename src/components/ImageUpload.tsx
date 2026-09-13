"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Camera,
  UploadCloud,
  X,
  Sparkles,
  Image as ImageIcon,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import CameraModal from "@/components/CameraModal";

export interface ImageUploadProps {
  value: File | null;
  onChange: (file: File | null) => void;
  disabled?: boolean;
  label?: string;
  optional?: boolean;
  description?: string;
  helperText?: string;
  showAiBadge?: boolean;
  maxSizeMB?: number;
  acceptedTypes?: string[];
  cameraTitle?: string;
  onError?: (error: string | null) => void;
}

const DEFAULT_ACCEPTED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/jpg",
];

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ImageUpload({
  value,
  onChange,
  disabled = false,
  label = "Incident Photo",
  optional = true,
  description = "Take or select a photo of the problem. Gemini AI will analyze it to prefill your report.",
  helperText = "Phone photos with GPS will automatically locate the incident.",
  showAiBadge = true,
  maxSizeMB = 5,
  acceptedTypes = DEFAULT_ACCEPTED_TYPES,
  cameraTitle = "Take Incident Photo",
  onError,
}: ImageUploadProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Manage preview object URL lifecycle
  useEffect(() => {
    if (!value) {
      setPreviewUrl(null);
      return;
    }

    const objectUrl = URL.createObjectURL(value);
    setPreviewUrl(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [value]);

  const reportError = useCallback(
    (msg: string | null) => {
      setLocalError(msg);
      onError?.(msg);
    },
    [onError]
  );

  // Validate incoming files (MIME type and size cap)
  const validateFile = useCallback(
    (file: File): boolean => {
      // 1. MIME Type check
      const isAccepted =
        acceptedTypes.some((type) => {
          if (type.endsWith("/*")) {
            const prefix = type.replace("/*", "");
            return file.type.startsWith(prefix);
          }
          return file.type.toLowerCase() === type.toLowerCase();
        }) || file.type === ""; // Certain HEIC/RAW files report empty MIME in some browsers

      if (!isAccepted) {
        reportError(
          "Unsupported file format. Please upload a JPEG, PNG, WEBP, or HEIC image."
        );
        return false;
      }

      // 2. Max File Size check
      const maxBytes = maxSizeMB * 1024 * 1024;
      if (file.size > maxBytes) {
        reportError(
          `Photo exceeds maximum allowed size of ${maxSizeMB}MB (${formatFileSize(file.size)}).`
        );
        return false;
      }

      reportError(null);
      return true;
    },
    [acceptedTypes, maxSizeMB, reportError]
  );

  const handleFile = useCallback(
    (file: File | null) => {
      if (!file) return;
      if (validateFile(file)) {
        onChange(file);
      }
    },
    [onChange, validateFile]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      if (disabled) return;

      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        const droppedFile = e.dataTransfer.files[0];
        handleFile(droppedFile);
      }
    },
    [disabled, handleFile]
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      if (!disabled) {
        setIsDragging(true);
      }
    },
    [disabled]
  );

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleRemove = () => {
    onChange(null);
    reportError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
  };

  const handleTakePhotoClick = () => {
    if (disabled) return;
    if (
      typeof window !== "undefined" &&
      typeof navigator?.mediaDevices?.getUserMedia === "function"
    ) {
      setIsCameraOpen(true);
    } else {
      // Fallback to native capture attribute on file input
      cameraInputRef.current?.click();
    }
  };

  const handleDropzoneKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      fileInputRef.current?.click();
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label
          htmlFor="image-upload"
          className="text-sm font-semibold text-gray-700 flex items-center gap-1.5"
        >
          <span>{label}</span>
          {optional && (
            <span className="text-xs font-light text-muted-foreground">
              (Optional)
            </span>
          )}
        </Label>
        {value && showAiBadge && (
          <Badge variant="default" className="gap-1 text-[11px]">
            <Sparkles className="w-3 h-3 text-accent" />
            AI Detection Active
          </Badge>
        )}
      </div>

      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        id="image-upload"
        accept={acceptedTypes.join(",")}
        disabled={disabled}
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.[0]) {
            handleFile(e.target.files[0]);
          }
          // Reset value to allow re-selecting the exact same file if removed
          e.target.value = "";
        }}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        disabled={disabled}
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.[0]) {
            handleFile(e.target.files[0]);
          }
          // Reset value to allow re-selecting the exact same file if removed
          e.target.value = "";
        }}
      />

      {/* Inline Validation Error Banner */}
      {localError && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive flex items-center justify-between gap-2 animate-in fade-in duration-150">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{localError}</span>
          </div>
          <button
            type="button"
            onClick={() => reportError(null)}
            className="p-1 hover:bg-destructive/10 rounded-md transition-colors"
            aria-label="Dismiss error"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {value && previewUrl ? (
        /* Image Preview State */
        <div className="relative rounded-xl border border-border/40 bg-card overflow-hidden transition-all shadow-sm">
          <div className="relative h-64 w-full bg-black/5 flex items-center justify-center overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt="Uploaded preview"
              className="h-full w-full object-contain"
            />
            <button
              type="button"
              disabled={disabled}
              onClick={handleRemove}
              aria-label="Remove photo"
              className="absolute top-3 right-3 h-8 w-8 rounded-full bg-secondary text-secondary-foreground hover:bg-secondary/80 flex items-center justify-center p-0 shadow-md hover:scale-105 transition-all cursor-pointer disabled:opacity-50 disabled:pointer-events-none border border-secondary-foreground/20"
            >
              <X className="w-4 h-4 shrink-0" />
            </button>
          </div>

          <div className="p-3 bg-card border-t border-border/30 flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-2 truncate pr-2">
              <ImageIcon className="w-4 h-4 shrink-0 text-primary" />
              <span className="truncate font-normal text-foreground">
                {value.name}
              </span>
              <span className="shrink-0 text-muted-foreground/70">
                ({formatFileSize(value.size)})
              </span>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled}
              onClick={() => fileInputRef.current?.click()}
              className="h-7 text-xs gap-1.5 shrink-0"
            >
              <RefreshCw className="w-3 h-3" />
              Change Photo
            </Button>
          </div>
        </div>
      ) : (
        /* Dropzone / Upload State */
        <div
          role="button"
          tabIndex={disabled ? -1 : 0}
          aria-label="Upload photo dropzone. Press Enter to select a file or drag and drop."
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onKeyDown={handleDropzoneKeyDown}
          onClick={(e) => {
            if (disabled) return;
            // Only trigger file picker if clicking the dropzone container itself, not child buttons
            if (e.target === e.currentTarget || !(e.target as HTMLElement).closest("button")) {
              fileInputRef.current?.click();
            }
          }}
          className={`relative rounded-xl border-2 border-dashed p-6 transition-all duration-200 text-center flex flex-col items-center justify-center gap-3 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring ${
            isDragging
              ? "border-primary bg-primary/5 scale-[1.01]"
              : "border-border/40 hover:border-primary/50 bg-card/50 hover:bg-card"
          } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
        >
          <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center">
            <UploadCloud className="w-6 h-6" />
          </div>

          <div className="space-y-1 max-w-sm">
            <p className="text-sm font-normal text-foreground">
              <span className="font-semibold text-primary underline underline-offset-4">
                Click to upload
              </span>{" "}
              or drag and drop
            </p>
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled}
              onClick={handleTakePhotoClick}
              className="h-8 gap-1.5 text-xs bg-card"
            >
              <Camera className="w-3.5 h-3.5 text-primary" />
              Take Photo
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled}
              onClick={() => fileInputRef.current?.click()}
              className="h-8 gap-1.5 text-xs bg-card"
            >
              <UploadCloud className="w-3.5 h-3.5 text-primary" />
              Browse Gallery
            </Button>
          </div>

          {helperText && (
            <p className="text-[11px] text-muted-foreground/80 mt-1">
              {helperText}
            </p>
          )}
        </div>
      )}

      {/* Reusable Camera Modal (Rendered via React Portal) */}
      <CameraModal
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onCapture={handleFile}
        title={cameraTitle}
        preferredFacingMode="environment"
        onFallbackToFileUpload={() => fileInputRef.current?.click()}
      />
    </div>
  );
}
