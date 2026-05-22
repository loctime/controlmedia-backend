/**
 * Returns the file extension (without leading dot) for a given Content-Type.
 * Falls back to 'bin' for unknown types.
 */
export function extensionFromContentType(ct: string): string {
  if (ct.startsWith('application/zip')) return 'zip';
  switch (ct) {
    case 'image/jpeg':
      return 'jpg';
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    case 'image/avif':
      return 'avif';
    default:
      return 'bin';
  }
}

/**
 * Formats a byte count as a human-readable string.
 * Examples: 0 → '0 B', 1023 → '1023 B', 1024 → '1.0 KB', 1048576 → '1.0 MB'
 */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes)) return '';
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(1)} MB`;
}
