import { useEffect, useMemo, useRef } from "react";
import { ImagePlus, Trash2, Upload } from "lucide-react";

import { Button } from "../ui/button";
import { cn } from "../../lib/cn";

export const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const MAX_FILE_BYTES = 8_000_000;

export interface PickedPhoto {
  id: string;
  file: File;
  url: string;
}

interface Props {
  photos: PickedPhoto[];
  onChange: (photos: PickedPhoto[]) => void;
  max?: number;
  cameraEnabled?: boolean;
  onCameraCapture?: () => void;
  disabled?: boolean;
}

export function validatePhotoFile(file: File): string | null {
  if (!ACCEPTED_TYPES.includes(file.type)) {
    return `${file.name}: use a JPEG, PNG or WebP image.`;
  }
  if (file.size > MAX_FILE_BYTES) {
    return `${file.name}: that file is larger than 8 MB.`;
  }
  return null;
}

export function PhotoPicker({
  photos,
  onChange,
  max = 3,
  cameraEnabled = false,
  onCameraCapture,
  disabled,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const photosRef = useRef(photos);
  photosRef.current = photos;

  useEffect(() => {
    return () => {
      photosRef.current.forEach((photo) => URL.revokeObjectURL(photo.url));
    };
  }, []);

  const remaining = max - photos.length;
  const fileList = useMemo(() => photos.map((photo) => photo.file.name).join(", "), [photos]);

  const addFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const accepted: PickedPhoto[] = [];
    for (const file of Array.from(files).slice(0, Math.max(0, remaining))) {
      if (validatePhotoFile(file)) continue;
      accepted.push({
        id: `${file.name}-${file.size}-${Math.random().toString(36).slice(2, 8)}`,
        file,
        url: URL.createObjectURL(file),
      });
    }
    onChange([...photos, ...accepted]);
    if (inputRef.current) inputRef.current.value = "";
  };

  const removeAt = (id: string) => {
    const target = photos.find((photo) => photo.id === id);
    if (target) URL.revokeObjectURL(target.url);
    onChange(photos.filter((photo) => photo.id !== id));
  };

  return (
    <section aria-labelledby="photos-heading" className="rounded-card border border-line p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="photos-heading" className="text-sm font-semibold text-ink">
            Enrolment photos ({photos.length} of {max})
          </h2>
          <p className="mt-1 max-w-xl text-sm text-muted">
            One to three front-facing photos works best in our design. This is a target to evaluate,
            not a guarantee that recognition will succeed. JPEG, PNG or WebP, up to 8 MB each.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            ref={inputRef}
            id="photo-input"
            type="file"
            accept={ACCEPTED_TYPES.join(",")}
            multiple
            className="visually-hidden"
            onChange={(event) => addFiles(event.target.files)}
            disabled={disabled || remaining <= 0}
          />
          <Button
            variant="secondary"
            size="sm"
            onClick={() => inputRef.current?.click()}
            disabled={disabled || remaining <= 0}
          >
            <Upload className="h-4 w-4" aria-hidden="true" />
            Choose photos
          </Button>
          {cameraEnabled && onCameraCapture ? (
            <Button variant="secondary" size="sm" onClick={onCameraCapture} disabled={disabled || remaining <= 0}>
              <ImagePlus className="h-4 w-4" aria-hidden="true" />
              Capture from camera
            </Button>
          ) : null}
        </div>
      </div>

      {photos.length === 0 ? (
        <p className="mt-4 rounded-control bg-surface-muted px-3 py-6 text-center text-sm text-muted">
          No photos selected yet. You can save the profile first and add photos afterwards.
        </p>
      ) : (
        <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {photos.map((photo) => (
            <li key={photo.id} className="overflow-hidden rounded-card border border-line">
              <img
                src={photo.url}
                alt={`Selected enrolment photo ${photo.file.name}`}
                className="aspect-square w-full object-cover"
              />
              <div className="flex items-center justify-between gap-2 bg-surface px-2 py-2">
                <span className="truncate text-xs text-muted">{photo.file.name}</span>
                <button
                  type="button"
                  onClick={() => removeAt(photo.id)}
                  className={cn(
                    "inline-flex h-8 w-8 items-center justify-center rounded-control text-danger hover:bg-danger-soft",
                  )}
                  aria-label={`Remove ${photo.file.name}`}
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {fileList ? (
        <p className="visually-hidden">Selected files: {fileList}</p>
      ) : null}
    </section>
  );
}
