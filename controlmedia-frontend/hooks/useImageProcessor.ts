"use client";

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import type { ProcessOptions, FileJob } from '@/types/image';

type UseImageProcessorReturn = {
  job: FileJob | null;
  process: (file: File, options?: ProcessOptions) => Promise<void>;
  reset: () => void;
};

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

  async function process(file: File, options: ProcessOptions = {}) {
    // Build initial job state
    const originalUrl = URL.createObjectURL(file);
    const initialJob: FileJob = {
      id: crypto.randomUUID(),
      file,
      originalUrl,
      status: 'uploading',
      uploadProgress: 0,
      processedUrl: null,
      blob: null,
      contentType: 'image/webp',
      originalSize: null,
      resultSize: null,
      reductionPct: null,
      error: null,
    };
    setJob(initialJob);

    // Build FormData
    const form = new FormData();
    form.append('file', file);
    if (options.quality !== undefined)
      form.append('quality', String(options.quality));
    if (options.format !== undefined) form.append('format', options.format);
    if (options.width !== undefined) form.append('width', String(options.width));
    if (options.height !== undefined)
      form.append('height', String(options.height));

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

      // Parse size metadata from response headers (lowercase — axios normalizes)
      const originalSize = Number(response.headers['x-original-size']);
      const resultSize = Number(response.headers['x-result-size']);
      const reductionPct = Number(response.headers['x-reduction-pct']);
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
              originalSize: isNaN(originalSize) ? null : originalSize,
              resultSize: isNaN(resultSize) ? null : resultSize,
              reductionPct: isNaN(reductionPct) ? null : reductionPct,
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

  function reset() {
    setJob((current) => {
      if (current) {
        if (current.originalUrl) URL.revokeObjectURL(current.originalUrl);
        if (current.processedUrl) URL.revokeObjectURL(current.processedUrl);
      }
      return null;
    });
  }

  return { job, process, reset };
}
