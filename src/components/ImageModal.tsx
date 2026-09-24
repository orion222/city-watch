"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Loader2 } from "lucide-react";

export interface ImageModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl?: string | null;
  altText?: string;
  title?: string;
}

export default function ImageModal({
  isOpen,
  onClose,
  imageUrl,
  altText = "Incident photo full preview",
  title,
}: ImageModalProps) {
  const [mounted, setMounted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Ensure createPortal only runs client-side
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Reset loading state whenever image URL changes or modal opens
  useEffect(() => {
    if (isOpen) {
      setIsLoading(true);
    }
  }, [isOpen, imageUrl]);

  // Handle ESC key and prevent body scrolling while modal is open
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !mounted || !imageUrl) return null;

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const modalContent = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title || altText}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 sm:p-6 md:p-8 animate-in fade-in duration-200"
    >
      <div
        className="relative flex flex-col items-center justify-center max-w-[95vw] max-h-[92vh] w-fit h-fit overflow-hidden rounded-2xl bg-card p-2 sm:p-3 shadow-2xl border border-border/20"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 z-20 w-8 h-8 rounded-full bg-black/60 hover:bg-black text-white flex items-center justify-center shadow-md transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring"
          aria-label="Close photo"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Image Container */}
        <div className="relative flex items-center justify-center overflow-hidden rounded-xl bg-black/5">
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-muted/40 min-w-[200px] min-h-[200px] rounded-xl z-10">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          )}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt={altText}
            onLoad={() => setIsLoading(false)}
            className={`max-h-[82vh] max-w-[90vw] w-auto h-auto object-contain rounded-xl select-none transition-opacity duration-200 ${
              isLoading ? "opacity-0" : "opacity-100"
            }`}
          />
        </div>

        {/* Optional Title Caption */}
        {title && (
          <div className="mt-2 px-1 text-center text-xs sm:text-sm font-medium text-foreground truncate max-w-full">
            {title}
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
