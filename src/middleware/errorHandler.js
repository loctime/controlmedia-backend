/**
 * errorHandler — consistent error shape for all 4xx/5xx responses (D-07)
 * Shape: { "error": "ERROR_CODE", "message": "..." }
 *
 * MUST be the last app.use() in index.js — after all routes (RESEARCH.md Pattern 6).
 * CORS middleware must run BEFORE this so error responses carry CORS headers (Pitfall 2).
 */
export function errorHandler(err, req, res, next) {
  // multer: file too large
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      error: 'FILE_TOO_LARGE',
      message: 'Maximum file size is 20MB per image',
    })
  }

  // multer fileFilter or upstream validation: unsupported/blocked file type
  if (err.code === 'INVALID_FILE_TYPE') {
    return res.status(400).json({
      error: 'INVALID_FILE_TYPE',
      message: err.message,
    })
  }

  // Sharp processing error (e.g. decompression bomb, unsupported format)
  if (err.code === 'PROCESSING_ERROR') {
    return res.status(422).json({
      error: 'PROCESSING_ERROR',
      message: err.message,
    })
  }

  // Missing required file field
  if (err.code === 'MISSING_FILE') {
    return res.status(400).json({
      error: 'MISSING_FILE',
      message: err.message || 'A file is required',
    })
  }

  // CORS rejection
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({
      error: 'CORS_REJECTED',
      message: 'Origin not allowed',
    })
  }

  // Fallback — unexpected error
  console.error('[errorHandler]', err)
  res.status(500).json({
    error: 'PROCESSING_ERROR',
    message: 'An unexpected error occurred during processing',
  })
}
