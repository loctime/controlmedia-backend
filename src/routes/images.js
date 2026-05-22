/**
 * images.js — Express router for image processing endpoints
 *
 * Routes:
 *   POST /process — single image: upload → Sharp pipeline → binary response
 *
 * Mounted at /api/images in src/index.js:
 *   app.use('/api/images', imagesRouter)
 *
 * Dependencies:
 *   imageUpload  — multer memoryStorage single-file middleware (from upload.js)
 *   processImage — Sharp pipeline service (from imageProcessor.js)
 */

import { Router } from 'express'
import { imageUpload } from '../middleware/upload.js'
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

export default router
