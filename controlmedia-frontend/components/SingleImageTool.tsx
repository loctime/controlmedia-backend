"use client";

import { useImageProcessor } from '@/hooks/useImageProcessor';
import { DropZone } from '@/components/DropZone';
import { ProgressBar } from '@/components/ProgressBar';
import { DownloadButton } from '@/components/DownloadButton';

export function SingleImageTool() {
  const { job, process, reset } = useImageProcessor();

  if (!job) {
    return (
      <DropZone
        mode="single"
        onAccepted={(files) => {
          if (files.length > 0) process(files[0]);
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Original image preview */}
      <div>
        <p className="text-sm text-gray-500 mb-2">Original</p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={job.originalUrl}
          alt="Original"
          className="max-h-64 rounded-lg border border-gray-200 object-contain"
        />
      </div>

      {/* Upload progress */}
      {job.status === 'uploading' && (
        <ProgressBar value={job.uploadProgress} label="Subiendo" />
      )}

      {/* Processing state (upload done but no response yet — handled by uploading state until complete) */}
      {job.status === 'uploading' && job.uploadProgress === 100 && (
        <p className="text-sm text-gray-500">Procesando…</p>
      )}

      {/* Processed result */}
      {job.status === 'complete' && job.processedUrl && (
        <div>
          <p className="text-sm text-gray-500 mb-2">Optimizada</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={job.processedUrl}
            alt="Optimizada"
            className="max-h-64 rounded-lg border border-gray-200 object-contain"
          />

          {/* Size info */}
          {job.originalSize !== null && job.resultSize !== null && (
            <p className="text-sm text-gray-500 mt-2">
              {Math.round(job.originalSize / 1024)} KB →{' '}
              {Math.round(job.resultSize / 1024)} KB
              {job.reductionPct !== null && ` (${job.reductionPct}% reducción)`}
            </p>
          )}

          <div className="flex gap-3 mt-4">
            <DownloadButton
              blob={job.blob}
              contentType={job.contentType}
            />
            <button
              onClick={reset}
              className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Procesar otra
            </button>
          </div>
        </div>
      )}

      {/* Error state */}
      {job.status === 'error' && (
        <div>
          <div role="alert" className="p-3 rounded-lg bg-red-50 text-red-700 text-sm">
            {job.error}
          </div>
          <button
            onClick={reset}
            className="mt-3 px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Reintentar
          </button>
        </div>
      )}
    </div>
  );
}
