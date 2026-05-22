"use client";

import { useDropzone, FileRejection } from 'react-dropzone';

const ACCEPTED_TYPES = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
  'image/avif': ['.avif'],
  'image/gif': ['.gif'],
};

function heicValidator(file: File) {
  const isHeic =
    file.type === 'image/heic' ||
    file.type === 'image/heif' ||
    /\.(heic|heif)$/i.test(file.name);
  if (isHeic) {
    return {
      code: 'heic-not-supported',
      message:
        'Este archivo es formato HEIC/HEIF. Por favor convertí la imagen a JPG primero.',
    };
  }
  return null;
}

interface DropZoneProps {
  mode?: 'single' | 'batch';
  onAccepted: (files: File[]) => void;
}

export function DropZone({ mode = 'single', onAccepted }: DropZoneProps) {
  const {
    getRootProps,
    getInputProps,
    isDragActive,
    fileRejections,
  } = useDropzone({
    accept: ACCEPTED_TYPES,
    maxFiles: mode === 'batch' ? 20 : 1,
    validator: heicValidator,
    onDropAccepted: onAccepted,
  });

  // Prioritize heic-not-supported error message over generic type errors
  const firstError = (() => {
    if (fileRejections.length === 0) return null;
    const allErrors = fileRejections[0].errors;
    const heicError = allErrors.find((e) => e.code === 'heic-not-supported');
    if (heicError) return heicError.message;
    return allErrors.length > 0 ? allErrors[0].message : null;
  })();

  return (
    <div>
      <div
        {...getRootProps()}
        role="button"
        className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
          isDragActive
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 hover:bg-gray-50'
        }`}
      >
        <input {...getInputProps()} />
        <p className="text-gray-600">
          Arrastrá tu imagen acá o hacé click para seleccionar
        </p>
        <p className="text-sm text-gray-400 mt-2">
          JPG, PNG, WebP, AVIF, GIF · Max 20 MB
        </p>
      </div>

      {firstError && (
        <div role="alert" className="mt-3 p-3 rounded-lg bg-red-50 text-red-700 text-sm">
          {firstError}
        </div>
      )}
    </div>
  );
}
