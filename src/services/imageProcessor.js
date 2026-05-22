/**
 * imageProcessor.js — Sharp-based image processing pipeline
 *
 * Exports:
 *   processImage(buffer, options) → Promise<{ data, info, originalSize }>
 *
 * Security:
 *   - Decompression bomb guard: checks width*height > MAX_PIXELS before allocating
 *     pixel memory (T-02-01, RESEARCH.md Pitfall 1)
 *   - All option values cast to Number() before passing to Sharp (T-02-02)
 *
 * Constraints:
 *   - AVIF effort:2 hard-coded (NOT default 4) — prevents minutes-long encodes (T-02-03, Pitfall 4)
 *   - sharp.concurrency(1) + sharp.cache(false) are set in upload.js at module load (D-11)
 */

import sharp from 'sharp'

// 25 megapixels = 5000×5000 — images beyond this are potential decompression bombs
const MAX_PIXELS = 25_000_000

/**
 * Process a single image buffer through the Sharp pipeline.
 *
 * @param {Buffer} buffer - Raw image data from multer memoryStorage
 * @param {object} [options={}]
 * @param {number} [options.quality=80] - Output quality (1–100). Ignored for PNG.
 * @param {string} [options.format='webp'] - Output format: jpeg|jpg|png|avif|webp
 * @param {number} [options.width] - Optional resize max width (preserves aspect ratio)
 * @param {number} [options.height] - Optional resize max height (preserves aspect ratio)
 * @returns {Promise<{ data: Buffer, info: object, originalSize: number }>}
 *   data        — processed image as Buffer
 *   info        — Sharp output info: { format, width, height, channels, size, ... }
 *   originalSize — input buffer.length in bytes
 */
export async function processImage(buffer, options = {}) {
  const { quality = 80, format = 'webp', width, height } = options

  // ── Step 1: Decompression bomb guard ────────────────────────────────────────
  // metadata() reads the image header only — no pixel decoding, no RAM spike.
  // If dimensions exceed MAX_PIXELS, throw before Sharp ever allocates the pixel buffer.
  const meta = await sharp(buffer).metadata()
  if (meta.width * meta.height > MAX_PIXELS) {
    throw Object.assign(
      new Error(
        `Image too large: ${meta.width}x${meta.height} pixels. Maximum is 25MP.`
      ),
      { code: 'PROCESSING_ERROR' }
    )
  }

  // ── Step 2: Build pipeline ───────────────────────────────────────────────────
  let pipeline = sharp(buffer)

  // ── Step 3: Optional resize ──────────────────────────────────────────────────
  // Only call .resize() if width or height is provided — omitting it leaves dimensions unchanged.
  // fit:'inside' scales to fit within the box without cropping.
  // withoutEnlargement:true never upscales a smaller image.
  if (width || height) {
    pipeline = pipeline.resize(
      width ? Number(width) : null,
      height ? Number(height) : null,
      { fit: 'inside', withoutEnlargement: true }
    )
  }

  // ── Step 4: Format + quality ─────────────────────────────────────────────────
  // Format-specific options for best compression control per codec.
  switch (format) {
    case 'jpeg':
    case 'jpg':
      // mozjpeg:true enables the Mozilla JPEG encoder for better compression
      pipeline = pipeline.jpeg({ quality: Number(quality), mozjpeg: true })
      break

    case 'png':
      // PNG has no quality setting — compressionLevel controls deflate speed/ratio
      pipeline = pipeline.png({ compressionLevel: 6 })
      break

    case 'avif':
      // effort:2 = fast encode (NOT default effort:4 which takes minutes per Pitfall 4 / T-02-03)
      pipeline = pipeline.avif({ quality: Number(quality), effort: 2 })
      break

    case 'webp':
    default:
      pipeline = pipeline.webp({ quality: Number(quality) })
      break
  }

  // ── Step 5: Execute pipeline and return ─────────────────────────────────────
  // resolveWithObject:true returns { data: Buffer, info: { size, width, height, format, ... } }
  const { data, info } = await pipeline.toBuffer({ resolveWithObject: true })

  return {
    data,         // processed image Buffer
    info,         // Sharp output metadata (info.size = bytes in output)
    originalSize: buffer.length,  // bytes in original upload
  }
}
