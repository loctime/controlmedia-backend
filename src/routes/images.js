/**
 * images.js — Express router for image processing endpoints
 *
 * Routes:
 *   POST /process — single image: upload → Sharp pipeline → binary response
 *   POST /batch   — up to 20 images → p-limit(3) Sharp → streaming ZIP response
 *
 * Mounted at /api/images in src/index.js:
 *   app.use('/api/images', imagesRouter)
 *
 * Dependencies:
 *   imageUpload      — multer memoryStorage single-file middleware (from upload.js)
 *   imageUploadArray — multer memoryStorage array middleware, max 20 files (from upload.js)
 *   processImage     — Sharp pipeline service (from imageProcessor.js)
 *   pLimit           — concurrency cap for batch Sharp operations (D-11: max 3)
 *   archiver         — streaming ZIP creation piped directly to res
 */

import { Router } from 'express'
import pLimit from 'p-limit'
import { ZipArchive } from 'archiver'
import { imageUpload, imageUploadArray } from '../middleware/upload.js'
import { processImage } from '../services/imageProcessor.js'

const router = Router()

/**
 * POST /api/images/process
 *
 * Accepts a multipart upload with field name 'file'.
 * Applies Sharp pipeline: optional resize → format conversion → quality control.
 * Returns processed image as binary body with size metadata in response headers.
 *
 * Request body (multipart/form-data):
 *   file     {File}   Required. JPG, PNG, WebP, AVIF, or GIF. Max 20MB. HEIC rejected.
 *   quality  {number} Optional. 1–100. Default: 80 (D-06)
 *   format   {string} Optional. jpeg|png|avif|webp. Default: webp (D-06)
 *   width    {number} Optional. Resize max width in px, preserves aspect ratio.
 *   height   {number} Optional. Resize max height in px, preserves aspect ratio.
 *
 * Success response (200):
 *   Content-Type: image/{format}
 *   Content-Disposition: inline; filename="optimized.{format}"
 *   X-Original-Size: {bytes} (original upload size)
 *   X-Result-Size: {bytes} (processed output size)
 *   X-Reduction-Pct: {integer} (percentage reduction)
 *   Content-Length: {bytes}
 *   Access-Control-Expose-Headers: X-Original-Size, X-Result-Size, X-Reduction-Pct
 *   Body: binary image data
 *
 * Error responses (consistent shape { error, message } via errorHandler):
 *   400 MISSING_FILE      — no file field in request
 *   400 INVALID_FILE_TYPE — HEIC or unsupported MIME type
 *   413 FILE_TOO_LARGE    — file exceeds 20MB limit
 *   422 PROCESSING_ERROR  — decompression bomb or Sharp processing failure
 *   500 PROCESSING_ERROR  — unexpected error
 */
router.post('/process', imageUpload.single('file'), async (req, res, next) => {
  // Guard: file field is required (D-06 — missing file returns 400 MISSING_FILE)
  if (!req.file) {
    const err = Object.assign(
      new Error('No file uploaded. Please include a file field in the request.'),
      { code: 'MISSING_FILE' }
    )
    return next(err)
  }

  try {
    // Parse processing options from multipart body fields (T-02-02: cast to Number in service)
    const options = {
      quality: req.body.quality || 80,
      format: req.body.format || 'webp',
      // width/height may be undefined — processImage handles the absent case
      ...(req.body.width && { width: req.body.width }),
      ...(req.body.height && { height: req.body.height }),
    }

    const { data, info } = await processImage(req.file.buffer, options)

    // Size metadata for frontend display (IMG-07, RESEARCH.md Pattern 5)
    const originalSize = req.file.size  // bytes of original upload
    const resultSize = info.size         // bytes of processed output
    const reductionPct = Math.round((1 - resultSize / originalSize) * 100)

    // Set all response headers before sending binary body
    res.set('Content-Type', `image/${info.format}`)
    res.set('Content-Disposition', `inline; filename="optimized.${info.format}"`)
    res.set('X-Original-Size', String(originalSize))
    res.set('X-Result-Size', String(resultSize))
    res.set('X-Reduction-Pct', String(reductionPct))
    res.set('Content-Length', String(data.length))
    // Expose custom headers to browser (cross-origin requests can read these)
    res.set('Access-Control-Expose-Headers', 'X-Original-Size, X-Result-Size, X-Reduction-Pct')

    res.send(data)
  } catch (err) {
    // Forward to errorHandler — covers PROCESSING_ERROR (decompression bomb, Sharp errors)
    next(err)
  }
})

/**
 * POST /api/images/batch
 *
 * Accepts up to 20 images as multipart upload with field name 'files'.
 * Applies the same Sharp pipeline as /process to each file, capped at 3
 * concurrent operations via p-limit (D-11: pLimit(3) + sharp.concurrency(1)).
 * Streams a ZIP archive directly to the response — never buffers the full ZIP
 * in memory (archiver.pipe(res) before any .append() calls — Pitfall 6).
 *
 * Request body (multipart/form-data):
 *   files[]  {File[]} Required. 1–20 files. JPG, PNG, WebP, AVIF, or GIF. Max 20MB each. HEIC rejected.
 *   quality  {number} Optional. 1–100. Default: 80 (D-06)
 *   format   {string} Optional. jpeg|png|avif|webp. Default: webp (D-06)
 *   width    {number} Optional. Resize max width in px, preserves aspect ratio.
 *   height   {number} Optional. Resize max height in px, preserves aspect ratio.
 *
 * Success response (200):
 *   Content-Type: application/zip
 *   Content-Disposition: attachment; filename="optimized.zip"
 *   Body: streaming ZIP containing optimized-1.{format} … optimized-N.{format}
 *
 * Error responses (consistent shape { error, message } via errorHandler):
 *   400 MISSING_FILE      — no files field in request
 *   400 INVALID_FILE_TYPE — HEIC or unsupported MIME type (rejected by multer fileFilter)
 *   413 FILE_TOO_LARGE    — any file exceeds 20MB limit
 *   422 PROCESSING_ERROR  — decompression bomb or Sharp processing failure
 *   500 PROCESSING_ERROR  — unexpected error or archiver error
 */
router.post('/batch', imageUploadArray, async (req, res, next) => {
  // Guard: at least one file is required
  if (!req.files || req.files.length === 0) {
    const err = Object.assign(
      new Error('No files uploaded. Please include at least one file field in the request.'),
      { code: 'MISSING_FILE' }
    )
    return next(err)
  }

  try {
    // Parse shared processing options from multipart body fields (same defaults as /process)
    const quality = req.body.quality || 80
    const format = req.body.format || 'webp'
    const width = req.body.width
    const height = req.body.height

    const options = {
      quality,
      format,
      ...(width && { width }),
      ...(height && { height }),
    }

    // p-limit(3): cap concurrent Sharp operations to prevent libvips thread explosion (D-11, T-03-02)
    const limit = pLimit(3)

    // Process all files with concurrency cap — preserve 1-based index for ZIP naming
    const results = await Promise.all(
      req.files.map((file, i) =>
        limit(() =>
          processImage(file.buffer, options).then(r => ({ ...r, index: i + 1 }))
        )
      )
    )

    // Set response headers for ZIP download
    res.set('Content-Type', 'application/zip')
    res.set('Content-Disposition', 'attachment; filename="optimized.zip"')

    // Create archiver — zlib level 6 not 9: images already compressed, level 9 wastes CPU (T-03-03)
    // archiver v8 uses named class exports; ZipArchive replaces the old archiver('zip', opts) factory
    const archive = new ZipArchive({ zlib: { level: 6 } })

    // MANDATORY: attach error handler BEFORE archive.pipe(res) to prevent unhandled error events
    // (Pitfall 6: archive.on('error') after pipe → Node.js process crash on archiver errors)
    archive.on('error', (err) => next(err))

    // Pipe archive stream directly to response — ZIP streams incrementally, never fully buffered
    archive.pipe(res)

    // Append each processed buffer — file name uses 1-based index + actual output format from Sharp
    results.forEach(({ data, index, info }) => {
      archive.append(data, { name: `optimized-${index}.${info.format}` })
    })

    // Trigger ZIP finalization — archiver emits 'end' when done, res closes automatically
    await archive.finalize()
  } catch (err) {
    // Forward to errorHandler — covers PROCESSING_ERROR (decompression bomb, Sharp errors, archiver errors)
    next(err)
  }
})

export default router
