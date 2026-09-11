"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Camera, UploadCloud, X, Sparkles, Image as ImageIcon, RefreshCw } from "lucide-react";

interface ImageUploadProps {
  value: File | null
  onChange: (file: File | null) => void
  disabled?: boolean
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ImageUpload({ value, onChange, disabled = false }: ImageUploadProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
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

  const handleFile = useCallback(
    (file: File | null) => {
      if (!file) return;
      onChange(file);
    },
    [onChange]
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
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label htmlFor="image-upload" className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
          <span>Incident Photo</span>
          <span className="text-xs font-light text-muted-foreground">(Optional)</span>
        </Label>
        {value && (
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
        accept="image/*"
        disabled={disabled}
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.[0]) {
            handleFile(e.target.files[0]);
          }
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
        }}
      />

      {value && previewUrl ? (
        /* Image Preview State */
        <div className="relative rounded-xl border border-border/40 bg-card overflow-hidden transition-all shadow-sm">
          <div className="relative h-64 w-full bg-black/5 flex items-center justify-center overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt="Incident preview"
              className="h-full w-full object-contain"
            />
            <Button
              type="button"
              variant="destructive"
              size="icon"
              disabled={disabled}
              onClick={handleRemove}
              aria-label="Remove photo"
              className="absolute top-3 right-3 h-8 w-8 rounded-full shadow-md hover:scale-105 transition-transform"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          <div className="p-3 bg-card border-t border-border/30 flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-2 truncate pr-2">
              <ImageIcon className="w-4 h-4 shrink-0 text-primary" />
              <span className="truncate font-normal text-foreground">{value.name}</span>
              <span className="shrink-0 text-muted-foreground/70">({formatFileSize(value.size)})</span>
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
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={`relative rounded-xl border-2 border-dashed p-6 transition-all duration-200 text-center flex flex-col items-center justify-center gap-3 ${
            isDragging
              ? "border-primary bg-primary/5 scale-[1.01]"
              : "border-border/40 hover:border-primary/50 bg-card/50 hover:bg-card"
          } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
          onClick={() => !disabled && fileInputRef.current?.click()}
        >
          <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center">
            <UploadCloud className="w-6 h-6" />
          </div>

          <div className="space-y-1 max-w-sm">
            <p className="text-sm font-normal text-foreground">
              <span className="font-semibold text-primary underline underline-offset-4">Click to upload</span> or drag and drop
            </p>
            <p className="text-xs text-muted-foreground">
              Take or select a photo of the problem. Gemini AI will analyze it to prefill your report.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2 pt-1" onClick={(e) => e.stopPropagation()}>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled}
              onClick={() => cameraInputRef.current?.click()}
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

          <p className="text-[11px] text-muted-foreground/80 mt-1">
            Phone photos with GPS will automatically locate the incident.
          </p>
        </div>
      )}
    </div>
  );
}
