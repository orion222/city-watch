"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { NEXT_PUBLIC_GEOAPIFY_API_KEY, BACKEND_URL } from "@/lib/constants";
import { useRouter } from "next/navigation";
import ImageUpload from "@/components/ImageUpload";
import { AlertCircle, CheckCircle2, Loader2, Sparkles } from "lucide-react";

interface ReportFormData {
  status: string;
  location: string;
  position?: [number, number];
  description?: string;
  reporterName?: string;
  reporterEmail?: string;
  contactNumber?: string;
}

function LocationAutocomplete({
  value,
  onChange,
  onPick,
  required,
  limit = 7,
  debounceMs = 250,
  labelText = "Location *",
  placeholder = "Enter an address, intersection, landmark…",
}: {
  value: string;
  onChange: (v: string) => void;
  onPick: (label: string, coords: [number, number]) => void; // [lon, lat]
  required?: boolean;
  limit?: number;
  debounceMs?: number;
  labelText?: string;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<
    {
      id: string | number;
      label: string;
      lon: number;
      lat: number;
      country: string;
      state: string;
      street: string;
      postcode: string | null;
    }[]
  >([]);

  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const apiKey = NEXT_PUBLIC_GEOAPIFY_API_KEY; // same source as your JSONViewer

  const url = useMemo(() => {
    const q = value.trim();
    setError(null);
    if (!q || !apiKey) return "";
    const params = new URLSearchParams({
      text: q,
      limit: String(limit),
      apiKey,
    });
    return `https://api.geoapify.com/v1/geocode/search?${params.toString()}`;
  }, [value, apiKey, limit]);

  // Debounced fetch (same behavior style as your JSONViewer)
  useEffect(() => {
    if (!url) {
      setItems([]);
      setOpen(!!value.trim());
      if (!apiKey && value.trim())
        setError("Missing NEXT_PUBLIC_GEOAPIFY_API_KEY");
      return;
    }
    setLoading(true);
    setOpen(true);

    const t = setTimeout(async () => {
      try {
        abortRef.current?.abort();
        const ctrl = new AbortController();
        abortRef.current = ctrl;

        const res = await fetch(url, { signal: ctrl.signal });
        if (!res.ok) {
          const text = await res.text();
          setError(`API error ${res.status}: ${text}`);
          setItems([]);
          return;
        }
        const data = await res.json();

        const next =
          (data?.features ?? []).map(
            (f: {
              properties?: {
                place_id?: string;
                lat?: number;
                lon?: number;
                formatted?: string;
                country?: string;
                state?: string;
                street?: string;
                postcode?: string;
                city?: string;
              };
            }) => ({
              id:
                f?.properties?.place_id ??
                `${f?.properties?.lat},${f?.properties?.lon}`,
              label: f?.properties?.formatted ?? "",
              lon: Number(f?.properties?.lon),
              lat: Number(f?.properties?.lat),
              country: f?.properties?.country,
              state: f?.properties?.state,
              street: f?.properties?.street,
              postalcode: f?.properties?.postcode,
              city: f?.properties?.city,
            }),
          ) ?? [];

        setItems(next);
        setError(null);
      } catch (e: unknown) {
        if (e instanceof Error && e.name !== "AbortError")
          setError("Network error");
        setItems([]);
      } finally {
        setLoading(false);
      }
    }, debounceMs);

    return () => clearTimeout(t);
  }, [url, debounceMs, value, apiKey]);

  const pick = (it: { label: string; lon: number; lat: number }) => {
    if (value === it.label) return; // Prevent redundant updates
    onPick(it.label, [it?.lon ?? 0, it?.lat ?? 0]);
    setOpen(false);
  };

  const validItems = items.filter(
    (it) => it && it.label && it.lon != null && it.lat != null,
  );

  return (
    <div className="space-y-2">
      <Label htmlFor="location">{labelText}</Label>
      <div className="relative">
        <Input
          id="location"
          placeholder={placeholder}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            if (!open) setOpen(true);
          }}
          onFocus={() => items.length && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          required={required}
          autoComplete="off"
        />

        {open && (
          <ul className="absolute z-50 mt-1 max-h-64 w-full overflow-auto rounded-md border bg-background p-1 shadow">
            {loading && (
              <li className="px-3 py-2 text-sm text-muted-foreground">
                Searching…
              </li>
            )}
            {!loading && error && (
              <li className="px-3 py-2 text-sm text-red-600">{error}</li>
            )}
            {!loading && !error && items.length === 0 && value.trim() && (
              <li className="px-3 py-2 text-sm text-muted-foreground">
                No results
              </li>
            )}
            {!loading &&
              !error &&
              validItems.map((it) => (
                <li
                  key={it.id}
                  className="cursor-pointer rounded px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    pick(it);
                  }}
                >
                  {it.label}
                </li>
              ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default function SubmitReportPage() {
  const router = useRouter();
  const [formData, setFormData] = useState<ReportFormData>({
    status: "",
    location: "",
    description: "",
    reporterName: "",
    reporterEmail: "",
    contactNumber: "",
  });
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleInputChange = (field: keyof ReportFormData, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
    // Clear any previous error when user edits
    if (errorMessage) setErrorMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const baseUrl = BACKEND_URL.trim();

    try {
      let response: Response;

      if (selectedImage) {
        const multipartData = new FormData();
        multipartData.append("image", selectedImage);

        const notes: string[] = [];
        if (formData.location?.trim()) {
          notes.push(`Location hint: ${formData.location.trim()}`);
        }
        if (formData.description?.trim()) {
          notes.push(`Description: ${formData.description.trim()}`);
        }
        if (formData.status?.trim()) {
          notes.push(`Urgency: ${formData.status.trim()}`);
        }
        if (formData.reporterName?.trim()) {
          notes.push(`Reporter Name: ${formData.reporterName.trim()}`);
        }
        if (formData.contactNumber?.trim()) {
          notes.push(`Contact: ${formData.contactNumber.trim()}`);
        }
        if (formData.reporterEmail?.trim()) {
          notes.push(`Email: ${formData.reporterEmail.trim()}`);
        }

        multipartData.append("description", notes.join("; "));

        response = await fetch(`${baseUrl}/submit-report-gemini-multimodal`, {
          method: "POST",
          headers: {
            "ngrok-skip-browser-warning": "true",
          },
          body: multipartData,
        });
      } else {
        // --- Standard Text-Only Submission ---
        let gemini_arg = "";
        for (const [k, v] of Object.entries(formData)) {
          if (v) gemini_arg += `${k}: ${v}, `;
        }

        response = await fetch(`${baseUrl}/submit-report-gemini`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "ngrok-skip-browser-warning": "true",
          },
          body: JSON.stringify({ description: gemini_arg }),
        });
      }

      if (response.ok) {
        const data = await response.json();
        const reportTitle = data?.report?.title
          ? `"${data.report.title}"`
          : "Report";
        setSuccessMessage(
          `${reportTitle} submitted successfully! Redirecting to map...`,
        );

        // Reset form
        setFormData({
          status: "",
          location: "",
          description: "",
          reporterName: "",
          reporterEmail: "",
          contactNumber: "",
        });
        setSelectedImage(null);

        // Navigate to map after brief confirmation
        setTimeout(() => {
          router.push("/map");
        }, 1500);
      } else {
        // Parse error message from backend
        let detail = "Error submitting report. Please try again.";
        try {
          const errData = await response.json();
          if (errData?.detail) {
            detail =
              typeof errData.detail === "string"
                ? errData.detail
                : JSON.stringify(errData.detail);
          } else if (errData?.error) {
            detail = errData.error;
          }
        } catch {
          detail = `Server returned status ${response.status}. Please check your connection or try again.`;
        }
        setErrorMessage(detail);
      }
    } catch (error) {
      console.error("Submission error:", error);
      setErrorMessage(
        "Network error occurred. Please verify your connection and try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-bold">
            Submit City Issue Report
          </CardTitle>
          <CardDescription className="mt-2">
            Help us maintain a safe, clean, and accessible city by reporting
            public issues you encounter.
          </CardDescription>
          <CardDescription>
            Photograph or describe problems such as damaged roads, broken
            streetlights, graffiti, illegal dumping, or safety hazards.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Photo Upload (ENG-20) */}
            <ImageUpload
              value={selectedImage}
              onChange={(file) => {
                setSelectedImage(file);
                if (errorMessage) setErrorMessage(null);
              }}
              disabled={isSubmitting}
            />

            {/* AI Photo Notice Banner */}
            {selectedImage && (
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-3.5 text-xs text-foreground flex items-start gap-2.5">
                <Sparkles className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <div className="space-y-0.5 font-light">
                  <p className="font-normal text-primary">
                    AI Photo-to-Report Active
                  </p>
                  <p className="text-muted-foreground">
                    It will automatically determine the location, urgency, and
                    description from your photo.
                  </p>
                </div>
              </div>
            )}

            {/* Error Banner */}
            {errorMessage && (
              <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive flex items-start gap-3">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-normal">Submission Feedback</p>
                  <p className="font-light text-xs leading-relaxed">
                    {errorMessage}
                  </p>
                </div>
              </div>
            )}

            {/* Success Banner */}
            {successMessage && (
              <div className="rounded-xl border border-green-600/30 bg-green-500/10 p-4 text-sm text-green-700 flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5 text-green-600" />
                <div className="space-y-0.5">
                  <p className="font-normal text-green-800">Report Accepted</p>
                  <p className="font-light text-xs text-green-700">
                    {successMessage}
                  </p>
                </div>
              </div>
            )}

            {/* Location Autocomplete */}
            <LocationAutocomplete
              value={formData.location}
              onChange={(val) => handleInputChange("location", val)}
              onPick={(label, [lon, lat]) =>
                setFormData((prev) => ({
                  ...prev,
                  location: label,
                  position: [lon ?? 0, lat ?? 0],
                }))
              }
              labelText={
                selectedImage
                  ? "Location (Optional with photo — GPS will auto-detect)"
                  : "Location *"
              }
              placeholder={
                selectedImage
                  ? "Enter location or leave blank to use photo GPS…"
                  : "Enter an address, intersection, landmark…"
              }
              required={!selectedImage}
            />

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">
                {selectedImage
                  ? "Description (Optional with photo)"
                  : "Description *"}
              </Label>
              <Textarea
                id="description"
                placeholder={
                  selectedImage
                    ? "Optional: Add any extra notes or context to assist Gemini AI..."
                    : "Provide details about the issue, its condition, behavior, or any concerns..."
                }
                value={formData.description}
                onChange={(e) =>
                  handleInputChange("description", e.target.value)
                }
                rows={4}
                required={!selectedImage}
              />
            </div>

            {/* Urgency Level */}
            <div className="space-y-2">
              <Label htmlFor="urgency">
                {selectedImage
                  ? "Urgency Level (Optional with photo)"
                  : "Urgency Level *"}
              </Label>
              <Select
                value={formData.status}
                onValueChange={(value) => handleInputChange("status", value)}
                required={!selectedImage}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      selectedImage
                        ? "Auto-detected by AI (or override here)"
                        : "Select urgency level"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Low">
                    Low - Minor issue (no immediate hazard)
                  </SelectItem>
                  <SelectItem value="Medium">
                    Medium - Requires attention
                  </SelectItem>
                  <SelectItem value="High">
                    High - Urgent or safety concern
                  </SelectItem>
                  <SelectItem value="Critical">
                    Critical - Emergency / public danger
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Reporter Information */}
            <div className="border-t pt-6">
              <h3 className="text-lg font-semibold mb-4">
                Contact Information
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="reporterName">Your Name</Label>
                  <Input
                    id="reporterName"
                    placeholder="Enter your full name"
                    value={formData.reporterName}
                    onChange={(e) =>
                      handleInputChange("reporterName", e.target.value)
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="contactNumber">Contact Number</Label>
                  <Input
                    id="contactNumber"
                    type="tel"
                    placeholder="Enter your phone number"
                    value={formData.contactNumber}
                    onChange={(e) =>
                      handleInputChange("contactNumber", e.target.value)
                    }
                  />
                </div>
              </div>

              <div className="space-y-2 mt-4">
                <Label htmlFor="reporterEmail">Email Address</Label>
                <Input
                  id="reporterEmail"
                  type="email"
                  placeholder="Enter your email address"
                  value={formData.reporterEmail}
                  onChange={(e) =>
                    handleInputChange("reporterEmail", e.target.value)
                  }
                />
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-6">
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {selectedImage
                      ? "Analyzing photo with Gemini AI..."
                      : "Submitting Report..."}
                  </span>
                ) : selectedImage ? (
                  "Submit Photo Report"
                ) : (
                  "Submit Report"
                )}
              </Button>
            </div>

            <p className="text-sm text-gray-600 text-center">
              {selectedImage
                ? "* With a photo, location & description are optional. Your information will be kept confidential."
                : "* Required fields. Your information will be kept confidential and used only for follow-up purposes."}
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
