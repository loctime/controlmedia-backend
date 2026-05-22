export type ProcessOptions = {
  quality?: number;
  format?: 'jpeg' | 'png' | 'webp' | 'avif';
  width?: number;
  height?: number;
};

export type BatchJob = {
  files: File[];
  status: 'idle' | 'uploading' | 'processing' | 'complete' | 'error';
  uploadProgress: number;
  zipBlob: Blob | null;
  error: string | null;
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
  originalFile: File;
  originalDimensions: { width: number; height: number } | null;
  originalUrl: string;
  status: 'idle' | 'uploading' | 'complete' | 'error';
  uploadProgress: number;
  processedUrl: string | null;
  blob: Blob | null;
  contentType: string | null;
  originalSize: number | null;
  resultSize: number | null;
  reductionPct: number | null;
  error: string | null;
};
