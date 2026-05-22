"use client";

import { useState } from 'react';
import { useImageProcessor } from '@/hooks/useImageProcessor';
import { DropZone } from '@/components/DropZone';
import { ProgressBar } from '@/components/ProgressBar';
import { DownloadButton } from '@/components/DownloadButton';
import { ImageOptionsPanel } from '@/components/ImageOptionsPanel';
import { SizeReadout } from '@/components/SizeReadout';
import { BeforeAfterSlider } from '@/components/BeforeAfterSlider';
import type { ProcessOptions } from '@/types/image';

export function SingleImageTool() {
  const { job, process, reprocess, reset } = useImageProcessor();
  const [options, setOptions] = useState<ProcessOptions>({ quality: 80, format: 'webp' });

  if (!job) {
    return (
      <DropZone
        mode="single"
        onAccepted={(files) => {
          if (files.length > 0) process(files[0], options);
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Before/after comparison slider (shown after processing completes) */}
      {job.status === 'complete' ? (
        <div>
          <h2 className="text-lg font-semibold text-gray-800 mb-3">Comparación antes / después</h2>
          <BeforeAfterSlider
            originalUrl={job.originalUrl}
            processedUrl={job.processedUrl}
          />
        </div>
      ) : (
        /* Original preview while uploading/processing */
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={job.originalUrl}
            alt="Original"
            className="max-h-64 w-full rounded-lg border border-gray-200 object-contain"
          />
        </div>
      )}

      {/* Upload progress */}
      {job.status === 'uploading' && job.uploadProgress < 100 && (
        <ProgressBar value={job.uploadProgress} label="Subiendo" />
      )}

      {/* Processing state (upload done but no response yet) */}
      {job.status === 'uploading' && job.uploadProgress === 100 && (
        <p className="text-sm text-gray-500">Procesando…</p>
      )}

      {/* Options panel — always visible after a job exists */}
      <div className="border border-gray-200 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Opciones</h3>
        <ImageOptionsPanel
          value={options}
          onChange={setOptions}
          originalDimensions={job.originalDimensions ?? null}
        />
      </div>

      {/* Actions */}
      <div className="flex gap-3 flex-wrap">
        {job.status === 'complete' && (
          <>
            <button
              onClick={() => reprocess(options)}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
            >
              Re-procesar
            </button>
            <DownloadButton
              blob={job.blob}
              contentType={job.contentType ?? 'image/webp'}
            />
          </>
        )}
        <button
          onClick={reset}
          className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Procesar otra
        </button>
      </div>

      {/* Size readout */}
      {job.status === 'complete' && (
        <SizeReadout
          original={job.originalSize}
          result={job.resultSize}
          pct={job.reductionPct}
        />
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
