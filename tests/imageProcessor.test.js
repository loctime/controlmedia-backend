/**
 * Tests for src/services/imageProcessor.js
 *
 * RED phase: these tests are written before the implementation.
 * They MUST fail before implementation exists.
 */

import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'
import sharp from 'sharp'

// Helper: create a valid JPEG buffer from a 100x100 red square
async function makeJpegBuffer(width = 100, height = 100) {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 255, g: 0, b: 0 },
    },
  })
    .jpeg()
    .toBuffer()
}

// Helper: create a fake "decompression bomb" buffer — real small JPEG
// but we mock what metadata() reports via a stub pattern.
// Actually we create a real large-pixel image for the bomb test.
// Sharp can create a 5001×5001 image for testing (25_010_001 pixels > 25MP limit).
async function makeBombBuffer() {
  // Create a 5001x5001 WebP (compressed small, but metadata shows > 25MP)
  return sharp({
    create: {
      width: 5001,
      height: 5001,
      channels: 3,
      background: { r: 255, g: 255, b: 255 },
    },
  })
    .webp({ quality: 1 }) // minimal size, but width*height = 25_010_001 > 25_000_000
    .toBuffer()
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('processImage', () => {
  let processImage
  let jpegBuf
  let bombBuf

  before(async () => {
    const mod = await import('../src/services/imageProcessor.js')
    processImage = mod.processImage
    jpegBuf = await makeJpegBuffer()
    bombBuf = await makeBombBuffer()
  })

  it('returns { data, info, originalSize } with defaults quality=80, format=webp', async () => {
    const result = await processImage(jpegBuf, {})
    assert.ok(result.data instanceof Buffer, 'data must be a Buffer')
    assert.ok(typeof result.info === 'object', 'info must be an object')
    assert.ok(typeof result.info.size === 'number', 'info.size must be a number')
    assert.strictEqual(result.originalSize, jpegBuf.length, 'originalSize must equal input buffer length')
    // Default format = webp
    assert.strictEqual(result.info.format, 'webp', 'default format must be webp')
  })

  it('applies mozjpeg:true when format is jpeg', async () => {
    const result = await processImage(jpegBuf, { format: 'jpeg', quality: 60 })
    assert.ok(result.data instanceof Buffer, 'data must be a Buffer')
    assert.strictEqual(result.info.format, 'jpeg', 'output format must be jpeg')
  })

  it('converts to png when format is png', async () => {
    const result = await processImage(jpegBuf, { format: 'png' })
    assert.strictEqual(result.info.format, 'png', 'output format must be png')
  })

  it('converts to avif when format is avif (effort:2)', async () => {
    const result = await processImage(jpegBuf, { format: 'avif', quality: 80 })
    assert.strictEqual(result.info.format, 'heif', 'output format for avif is heif in Sharp info')
    assert.ok(result.data instanceof Buffer, 'data must be a Buffer')
  })

  it('resizes to max 800px wide preserving aspect ratio when width=800', async () => {
    // Create a 2000x1000 input
    const wideBuf = await sharp({
      create: { width: 2000, height: 1000, channels: 3, background: { r: 0, g: 0, b: 255 } },
    })
      .jpeg()
      .toBuffer()
    const result = await processImage(wideBuf, { width: 800, format: 'webp' })
    assert.ok(result.info.width <= 800, `width should be <= 800, got ${result.info.width}`)
    // aspect ratio preserved: 2000x1000 → 800x400
    assert.ok(result.info.height > 0, 'height must be positive')
  })

  it('does NOT resize when neither width nor height is provided', async () => {
    // 100x100 input with no resize options
    const result = await processImage(jpegBuf, { format: 'webp' })
    assert.strictEqual(result.info.width, 100, 'width must be unchanged at 100')
    assert.strictEqual(result.info.height, 100, 'height must be unchanged at 100')
  })

  it('throws with code PROCESSING_ERROR for decompression bomb (> 25MP)', async () => {
    let threw = false
    let errorCode
    try {
      await processImage(bombBuf, {})
    } catch (err) {
      threw = true
      errorCode = err.code
    }
    assert.ok(threw, 'processImage must throw for > 25MP image')
    assert.strictEqual(errorCode, 'PROCESSING_ERROR', 'error.code must be PROCESSING_ERROR')
  })

  it('originalSize equals input buffer.length', async () => {
    const result = await processImage(jpegBuf, { format: 'webp' })
    assert.strictEqual(result.originalSize, jpegBuf.length)
  })
})
