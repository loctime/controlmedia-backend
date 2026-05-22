"use client";

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import type { ProcessOptions, FileJob } from '@/types/image';

type UseImageProcessorReturn = {
  job: FileJob | null;
  process: (file: File, options?: ProcessOptions) => Promise<void>;
  reprocess: (options: ProcessOptions) => Promise<void>;
  reset: () => void;
};

function buildForm(file: File, options: ProcessOptions): FormData {
  const form = new FormData();
  form.append('file', file);
  if (options.quality != null) form.append('quality', String(options.quality));
  if (options.format != null) form.append('format', options.format);
  if (options.width != null) form.append('width', String(options.width));
  if (options.height != null) form.append('height', String(options.height));
  return form;
}

function parseNum(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function useImageProcessor(): UseImageProcessorReturn {
  const [job, setJob] = useState<FileJob | null>(null);

  // Cleanup on unmount — revoke any active object URLs
  useEffect(() => {
    return () => {
      setJob((current) => {
        if (current) {
          if (current.originalUrl) URL.revokeObjectURL(current.originalUrl);
          if (current.processedUrl) URL.revokeObjectURL(current.processedUrl);
        }
        return null;
      });
    };
  }, []);

  async function runUpload(file: File, originalUrl: string, options: ProcessOptions): Promise<void> {
    const form = buildForm(file, options);

    try {
      const response = await api.post('/api/images/process', form, {
        responseType: 'blob',
        onUploadProgress: ({ loaded, total, progress }) => {
          const pct = Math.round(
            (progress ?? (total ? loaded / total : 0)) * 100
          );
          setJob((j) => (j ? { ...j, uploadProgress: pct } : j));
        },
      });

      const contentType =
        (response.headers['content-type'] as string) || 'image/webp';
      const processedBlob = response.data as Blob;
      const processedUrl = URL.createObjectURL(processedBlob);

      setJob((j) =>
        j
          ? {
              ...j,
              status: 'complete',
              uploadProgress: 100,
              processedUrl,
              blob: processedBlob,
              contentType,
              originalSize: parseNum(response.headers['x-original-size']),
              resultSize: parseNum(response.headers['x-result-size']),
              reductionPct: parseNum(response.headers['x-reduction-pct']),
            }
          : j
      );
    } catch {
      setJob((j) =>
        j
          ? {
              ...j,
              status: 'error',
              error:
                'No se pudo procesar la imagen. Verificá tu conexión y volvé a intentar.',
            }
          : j
      );
    }
  }

  async function process(file: File, options: ProcessOptions = {}) {
    const originalUrl = URL.createObjectURL(file);
    const initialJob: FileJob = {
      id: crypto.randomUUID(),
      file,
      originalFile: file,
      originalDimensions: null,
      originalUrl,
      status: 'uploading',
      uploadProgress: 0,
      processedUrl: null,
      blob: null,
      contentType: null,
      originalSize: null,
      resultSize: null,
      reductionPct: null,
      error: null,
    };
    setJob(initialJob);

    // Probe natural dimensions in parallel with upload
    const img = new Image();
    img.src = originalUrl;
    img.onload = () => {
      setJob((j) =>
        j && j.originalUrl === originalUrl
          ? {
              ...j,
              originalDimensions: {
                width: img.naturalWidth,
                height: img.naturalHeight,
              },
            }
          : j
      );
    };

    await runUpload(file, originalUrl, options);
  }

  async function reprocess(options: ProcessOptions): Promise<void> {
    setJob((current) => {
      if (!current?.originalFile) return current;
      // Revoke old processed URL before creating a new one
      if (current.processedUrl) URL.revokeObjectURL(current.processedUrl);
      return {
        ...current,
        status: 'uploading',
        uploadProgress: 0,
        processedUrl: null,
        blob: null,
        originalSize: null,
        resultSize: null,
        reductionPct: null,
        error: null,
      };
    });

    // Read originalFile synchronously — must be called after setJob resolves
    // Use a local snapshot to avoid stale closure
    setJob((current) => {
      if (!current?.originalFile) return current;
      // Trigger the upload asynchronously
      runUpload(current.originalFile, current.originalUrl, options).catch(() => {});
      return current;
    });
  }

  function reset() {
    setJob((current) => {
      if (current) {
        if (current.originalUrl) URL.revokeObjectURL(current.originalUrl);
        if (current.processedUrl) URL.revokeObjectURL(current.processedUrl);
      }
      return null;
    });
  }

  return { job, process, reprocess, reset };
}
