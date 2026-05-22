import multer from 'multer'
import sharp from 'sharp'

// Set Sharp concurrency and cache globally at module load (D-11, CLAUDE.md Constraint 6)
// This must run once — not per request
sharp.concurrency(1)
sharp.cache(false)

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
  'image/gif',
])

// HEIC/HEIF must be blocked before Sharp is called (D-09, CLAUDE.md Constraint 4)
const BLOCKED_MIME_TYPES = new Set([
  'image/heic',
  'image/heif',
])

/**
 * fileFilter — reject HEIC/HEIF via both MIME type and file extension
 * (Pitfall 3: some browsers send application/octet-stream for HEIC files)
 */
function fileFilter(req, file, cb) {
  // Dual check: MIME type AND file extension (CLAUDE.md Constraint 4)
  if (
    BLOCKED_MIME_TYPES.has(file.mimetype) ||
    /\.(heic|heif)$/i.test(file.originalname)
  ) {
    return cb(
      Object.assign(
        new Error('HEIC/HEIF format is not supported. Please convert to JPG first.'),
        { code: 'INVALID_FILE_TYPE' }
      )
    )
  }

  if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
    return cb(
      Object.assign(
        new Error(`Unsupported file type: ${file.mimetype}`),
        { code: 'INVALID_FILE_TYPE' }
      )
    )
  }

  cb(null, true)
}

const multerConfig = {
  storage: multer.memoryStorage(), // D-08: images in RAM buffers, no disk I/O
  limits: {
    fileSize: 20 * 1024 * 1024, // D-02: 20MB per file
  },
  fileFilter,
}

// Single file upload — used by POST /api/images/process
export const imageUpload = multer(multerConfig)

// Multi-file upload — used by POST /api/images/batch (up to 20 files, BATCH-01)
export const imageUploadArray = multer(multerConfig).array('files', 20)
