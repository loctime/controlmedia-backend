"use client";

import { useState } from 'react';
import { api } from '@/lib/api';
import type { BatchJob, ProcessOptions } from '@/types/image';

const initialBatch: BatchJob = {
  files: [],
  status: 'idle',
  uploadProgress: 0,
  zipBlob: null,
  error: null,
};

type UseBatchProcessorReturn = {
  batch: BatchJob;
  addFiles: (files: File[]) => void;
  removeFile: (name: string) => void;
  clear: () => void;
  processAll: (options: ProcessOptions) => void;
};

export function useBatchProcessor(): UseBatchProcessorReturn {
  const [batch, setBatch] = useState<BatchJob>(() => ({ ...initialBatch }));

  function addFiles(files: File[]) {
    setBatch((prev) => {
      const remaining = Math.max(0, 20 - prev.files.length);
      const accepted = files.slice(0, remaining);
      const dropped = files.length - accepted.length;
      const next: BatchJob = { ...prev, files: [...prev.files, ...accepted] };
      if (dropped > 0) {
        next.error = 'Máximo 20 archivos. Los archivos excedentes fueron ignorados.';
      } else {
        next.error = null;
      }
      return next;
    });
  }

  function removeFile(name: string) {
    setBatch((prev) => {
      let removed = false;
      const files = prev.files.filter((f) => {
        if (!removed && f.name === name) {
          removed = true;
          return false;
        }
        return true;
      });
      return { ...prev, files, error: null };
    });
  }

  function clear() {
    setBatch({ ...initialBatch });
  }

  function processAll(options: ProcessOptions) {
    setBatch((prev) => {
      if (prev.files.length === 0) return prev;
      return prev;
    });

    // Read current files synchronously before async operations
    setBatch((prev) => {
      if (prev.files.length === 0) return prev;

      const files = prev.files;
      const form = new FormData();
      files.forEach((f) => form.append('files', f));
      if (options.quality != null) form.append('quality', String(options.quality));
      if (options.format) form.append('format', options.format);
      if (options.width) form.append('width', String(options.width));
      if (options.height) form.append('height', String(options.height));

      // Kick off the upload asynchronously
      const nextState: BatchJob = {
        ...prev,
        status: 'uploading',
        uploadProgress: 0,
        zipBlob: null,
        error: null,
      };

      api
        .post('/api/images/batch', form, {
          responseType: 'blob',
          onUploadProgress: (e) => {
            const pct = Math.round(
              ((e.progress ?? (e.total ? e.loaded / e.total : 0)) * 100)
            );
            setBatch((b) => ({
              ...b,
              uploadProgress: pct,
              status: pct >= 100 ? 'processing' : 'uploading',
            }));
          },
        })
        .then((res) => {
          setBatch((b) => ({
            ...b,
            status: 'complete',
            zipBlob: res.data as Blob,
          }));
        })
        .catch((err) => {
          const msg =
            err?.response?.status === 400
              ? 'Algún archivo no es válido (revisá que no haya HEIC).'
              : 'No se pudo procesar el batch. Verificá tu conexión.';
          setBatch((b) => ({ ...b, status: 'error', error: msg }));
        });

      return nextState;
    });
  }

  return { batch, addFiles, removeFile, clear, processAll };
}
