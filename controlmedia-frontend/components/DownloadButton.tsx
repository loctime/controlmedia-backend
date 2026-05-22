"use client";

import { extensionFromContentType } from '@/lib/format';

interface DownloadButtonProps {
  blob: Blob | null;
  contentType: string;
  baseName?: string;
}

export function DownloadButton({ blob, contentType, baseName }: DownloadButtonProps) {
  function handleDownload() {
    if (!blob) return;
    const ext = extensionFromContentType(contentType);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${baseName ?? 'optimized'}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <button
      onClick={handleDownload}
      disabled={blob === null}
      className="px-4 py-2 rounded-lg bg-green-600 text-white disabled:opacity-50 hover:bg-green-700 transition-colors font-medium"
    >
      Descargar
    </button>
  );
}
