export type ProcessOptions = {
  quality?: number;
  format?: 'jpeg' | 'png' | 'webp' | 'avif';
  width?: number;
  height?: number;
};

export type ProcessResult = {
  blob: Blob;
  contentType: string;
  originalSize: number;
  resultSize: number;
  reductionPct: number;
};

export type FileJob = {
  id: string;
  file: File;
  originalUrl: string;
  status: 'idle' | 'uploading' | 'complete' | 'error';
  uploadProgress: number;
  processedUrl: string | null;
  blob: Blob | null;
  contentType: string;
  originalSize: number | null;
  resultSize: number | null;
  reductionPct: number | null;
  error: string | null;
};
