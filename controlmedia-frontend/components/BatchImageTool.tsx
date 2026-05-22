"use client";

import { useState } from 'react';
import { useBatchProcessor } from '@/hooks/useBatchProcessor';
import { DropZone } from '@/components/DropZone';
import { BatchFileList } from '@/components/BatchFileList';
import { ImageOptionsPanel } from '@/components/ImageOptionsPanel';
import { ProgressBar } from '@/components/ProgressBar';
import { DownloadButton } from '@/components/DownloadButton';
import type { ProcessOptions } from '@/types/image';

export function BatchImageTool() {
  const { batch, addFiles, removeFile, processAll } = useBatchProcessor();
  const [options, setOptions] = useState<ProcessOptions>({ quality: 80, format: 'webp' });

  const isProcessing =
    batch.status === 'uploading' || batch.status === 'processing';

  return (
    <div className="space-y-6">
      {/* Drop zone for batch files */}
      <DropZone mode="batch" onAccepted={addFiles} />

      {/* File list */}
      <BatchFileList files={batch.files} onRemove={removeFile} />

      {/* Error / cap warning */}
      {batch.error && batch.status !== 'error' && (
        <div role="alert" className="p-3 rounded-lg bg-yellow-50 text-yellow-800 text-sm">
          {batch.error}
        </div>
      )}

      {/* Options panel */}
      <div className="border border-gray-200 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Opciones</h3>
        <ImageOptionsPanel
          value={options}
          onChange={setOptions}
          originalDimensions={null}
        />
      </div>

      {/* Process button */}
      <button
        onClick={() => processAll(options)}
        disabled={batch.files.length === 0 || isProcessing}
        className="w-full px-4 py-3 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
        type="button"
      >
        {isProcessing ? 'Procesando…' : 'Procesar batch'}
      </button>

      {/* Upload progress */}
      {batch.status === 'uploading' && (
        <div className="space-y-2">
          <p className="text-sm text-gray-600">
            Subiendo… {batch.uploadProgress}%
          </p>
          <ProgressBar value={batch.uploadProgress} />
        </div>
      )}

      {/* Processing phase */}
      {batch.status === 'processing' && (
        <p className="text-sm text-gray-600">
          Procesando {batch.files.length} imágenes…
        </p>
      )}

      {/* Success — ZIP download */}
      {batch.status === 'complete' && (
        <div className="flex items-center gap-3">
          <DownloadButton
            blob={batch.zipBlob}
            contentType="application/zip"
            baseName="optimized"
          />
          <span className="text-sm text-green-700 font-medium">Descargar ZIP</span>
        </div>
      )}

      {/* Error state */}
      {batch.status === 'error' && (
        <div role="alert" className="p-3 rounded-lg bg-red-50 text-red-700 text-sm">
          {batch.error}
        </div>
      )}
    </div>
  );
}
