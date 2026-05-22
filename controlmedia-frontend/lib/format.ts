/**
 * Returns the file extension (without leading dot) for a given Content-Type.
 * Falls back to 'bin' for unknown types.
 */
export function extensionFromContentType(ct: string): string {
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
