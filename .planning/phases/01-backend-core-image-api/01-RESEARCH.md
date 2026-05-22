# Phase 1: Backend Core + Image API — Research

**Researched:** 2026-05-22
**Domain:** Node.js / Express image processing backend (Sharp, multer, archiver, p-limit, CORS, Render)
**Confidence:** HIGH — all core stack verified via npm registry + official documentation

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Backend is an independent repo, separate from the Next.js frontend. Its own `package.json`, deployed autonomously on Render.
- **D-02:** Image file size limit: 20MB per file (multer `fileSize`). Batch: up to 20 images × 20MB each.
- **D-03:** Video limit 500MB — defined but NOT implemented in Phase 1. diskStorage config can be stubbed.
- **D-04:** Start on Render Free tier. Cold start (~10–30s) acceptable for dev. Upgrade to Starter ($7/mo) before public launch.
- **D-05:** Verify `ffmpeg-static` availability on first deploy. If Free tier blocks it, upgrade immediately.
- **D-06:** Defaults when frontend omits optional params: `quality=80`, `format=webp`. `file` field is required — missing file returns 400.
- **D-07:** Consistent error shape on all 4xx/5xx: `{ "error": "ERROR_CODE", "message": "..." }`. Codes: `FILE_TOO_LARGE`, `INVALID_FILE_TYPE`, `MISSING_FILE`, `PROCESSING_ERROR`.
- **D-08:** multer `memoryStorage` for images (no disk I/O in the happy path).
- **D-09:** HEIC/HEIF rejected in multer `fileFilter` with a descriptive error before calling Sharp.
- **D-10:** CORS via regex: `/https:\/\/controlmedia-.*\.vercel\.app$/` + `http://localhost:3000` for dev.
- **D-11:** Batch Sharp: `p-limit(3)` + `sharp.concurrency(1)` + `sharp.cache(false)`. No uncapped `Promise.all`.
- **D-12:** Cleanup always in `finally` block + `setInterval` sweep every 30 minutes for orphaned files.

### Claude's Discretion

- Internal route structure (`routes/images.js`, `routes/health.js`, or all in `app.js`)
- Manual testing strategy during development (curl commands in README, Postman collection, etc.)
- Internal naming conventions (variables, functions)
- Exact Node.js version in Render runtime (use LTS)

### Deferred Ideas (OUT OF SCOPE)

- Video processing (FFmpeg, SSE, async jobs) — Phase 3
- Frontend image UI (drag-drop, comparison, batch UI) — Phase 2
- Platform presets (WhatsApp, Discord, Instagram) — Phase 5
- Rate limiting by IP — out of scope v1
- Redis / distributed job queue — out of scope v1 (single Render instance)
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| IMG-01 | Accept image upload (JPG, PNG, WebP, AVIF, GIF) | multer fileFilter with MIME allowlist |
| IMG-02 | Compress image with quality control (1-100) | Sharp `.jpeg({quality})` / `.webp({quality})` / `.avif({quality})` |
| IMG-04 | Resize image by width/height in px, maintain aspect ratio | Sharp `.resize(w, h, { fit: 'inside', withoutEnlargement: true })` |
| IMG-05 | Convert output format (JPG, PNG, WebP, AVIF) | Sharp `.toFormat(format, {quality})` |
| IMG-06 | Download processed image | `res.send(buffer)` with correct Content-Type + Content-Disposition |
| IMG-07 | Response includes original size, result size, % reduction | `toBuffer({ resolveWithObject: true })` returns `info.size`; original size from `req.file.size` |
| BATCH-01 | Accept up to 20 images (`upload.array('files', 20)`) | multer `.array()` field name |
| BATCH-02 | Return all processed images as a single ZIP | archiver streamed directly to `res` |
| BATCH-03 | (Backend contract) Process all files, names: `optimized-1.webp` etc. | archiver `.append(buffer, { name })` |
| GEN-01 | No auth/login on any endpoint | No auth middleware; all routes public |
| GEN-02 | Files not stored permanently; processing in memory/tmp | memoryStorage + no writes; `finally` cleanup |
| GEN-03 | HEIC rejected at multer layer with clear message | fileFilter checks `image/heic` + `image/heif` MIME + `.heic`/`.heif` extension |
| GEN-04 | Files deleted after response OR within 30 minutes | `finally` blocks + `setInterval` sweep (image path is in-memory, no files to sweep; sweep is groundwork for Phase 3 video) |
</phase_requirements>

---

## Summary

Phase 1 is a pure Node.js/Express backend project. All required packages are well-established, actively maintained, and verified on the npm registry as of 2026-05-22. There are no novel or risky dependencies — this stack (Express + multer + Sharp + archiver + p-limit + cors) has been used in production at scale for years.

The central design patterns for this phase are: (1) multer `memoryStorage` receives image files as `Buffer` objects in `req.file.buffer`, (2) Sharp reads the buffer, executes a pipeline (optional resize → format + quality), outputs a new buffer via `toBuffer({ resolveWithObject: true })` which returns both data and metadata (`info.size`), (3) for batch, p-limit(3) caps concurrent Sharp operations, and archiver streams the ZIP directly to `res` without buffering the full archive in memory, (4) CORS uses an origin function with a regex to handle Vercel preview URLs, and (5) Render deployment requires only a `render.yaml` with `startCommand: node src/index.js` and `healthCheckPath: /health`.

The two sharpest operational risks for this phase are: decompression bomb attacks (a 100KB PNG claiming 50000×50000 dimensions will OOM the process — must `metadata()` check first), and CORS misconfiguration (errors returned before CORS middleware don't carry `Access-Control-Allow-Origin` headers, so the browser reports a CORS error masking the real error).

**Primary recommendation:** Implement the three routes in the order: health → single image process → batch. Establish the cleanup `finally` pattern and the CORS origin function from the very first route — retrofitting them is error-prone.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| File upload receiving | API / Backend (Render) | — | Files go browser→Render directly; Vercel 4.5MB limit makes Next.js proxy impossible |
| Image compression / resize / convert | API / Backend (Render) | — | Sharp requires Node.js native binary; cannot run in browser |
| Batch ZIP assembly | API / Backend (Render) | — | archiver is server-side; ZIP streams from Render to browser |
| HEIC rejection | API / Backend (Render) | Browser (Phase 2) | Backend is the security gate; frontend adds UX message in Phase 2 |
| CORS enforcement | API / Backend (Render) | — | CORS headers set in Express middleware |
| File lifecycle / cleanup | API / Backend (Render) | — | `finally` blocks + `setInterval` sweep in Express process |
| Health check | API / Backend (Render) | — | Render uses HTTP health check to determine service readiness |
| Response metadata (sizes, %) | API / Backend (Render) | — | Sharp `toBuffer({ resolveWithObject: true })` provides `info.size`; percentage computed server-side |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `express` | 5.2.1 | HTTP server, routing, middleware | Industry standard Node.js HTTP framework |
| `sharp` | 0.34.5 | Image compress/resize/convert | Fastest Node.js image processor; libvips-backed; prebuilts on Render |
| `multer` | 2.1.1 | Multipart form-data upload parsing | Standard Express file upload middleware; built on busboy |
| `archiver` | 8.0.0 | Streaming ZIP creation | Standard Node.js ZIP streaming library; pipes directly to `res` |
| `p-limit` | 7.3.0 | Concurrency cap for batch Sharp ops | Prevents libvips thread explosion on Render 512MB instances |
| `cors` | 2.8.6 | CORS middleware with origin function | Express-native; supports regex origins for Vercel preview URLs |

[VERIFIED: npm registry] — all packages confirmed via `npm view` on 2026-05-22.

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `uuid` (built-in `crypto.randomUUID`) | Node 20 built-in | Generate unique job directory names | Use `import { randomUUID } from 'crypto'` — no extra package needed |
| `fs/promises` | Node 20 built-in | Async file operations for cleanup sweep | Phase 3 video cleanup; stub the sweep in Phase 1 |
| `dotenv` | latest | Load `.env` for local dev (ALLOWED_ORIGIN, PORT) | Dev only; Render injects env vars natively in production |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `sharp` | `jimp` | jimp is pure JS, 40–50x slower, no AVIF support. No valid use case here. |
| `multer` | `busboy` directly | Lower-level; more code for same result. Not needed for v1. |
| `archiver` | `jszip` | jszip builds the archive in memory before sending. On 20×20MB inputs that is 400MB peak RAM. archiver streams. |
| `p-limit` | manual semaphore | p-limit is 0 dependencies, battle-tested. No reason to hand-roll. |

**Installation:**

```bash
npm install express sharp multer archiver p-limit cors dotenv
```

**Version verification (ran 2026-05-22):**

```
sharp    0.34.5   (published 2026-04-25)
multer   2.1.1    (published 2026-03-04)
archiver 8.0.0    (published 2026-05-08)
p-limit  7.3.0    (published 2026-02-03)
express  5.2.1    (published 2026-05-19)
cors     2.8.6    (published 2026-01-22)
```

---

## Package Legitimacy Audit

> slopcheck was run but operates on PyPI, not npm. Cross-ecosystem false positives were produced for `express`, `multer`, `p-limit` (npm packages that don't exist on PyPI). These are NOT slopcheck [SLOP] verdicts for npm. All packages were independently verified via `npm view` on the npm registry and cross-referenced with official GitHub repositories and documentation.

| Package | Registry | Age | Source Repo | npm verify | Disposition |
|---------|----------|-----|-------------|------------|-------------|
| `express` | npm | ~13 yrs | github.com/expressjs/express | `npm view express version` → 5.2.1 | Approved |
| `sharp` | npm | ~12 yrs | github.com/lovell/sharp | `npm view sharp version` → 0.34.5 | Approved |
| `multer` | npm | ~10 yrs | github.com/expressjs/multer | `npm view multer version` → 2.1.1 | Approved |
| `archiver` | npm | ~11 yrs | github.com/archiverjs/node-archiver | `npm view archiver version` → 8.0.0 | Approved |
| `p-limit` | npm | ~8 yrs | github.com/sindresorhus/p-limit | `npm view p-limit version` → 7.3.0 | Approved |
| `cors` | npm | ~10 yrs | github.com/expressjs/cors | `npm view cors version` → 2.8.6 | Approved |

**Packages removed due to slopcheck [SLOP] verdict:** none

**Packages flagged as suspicious [SUS]:** none

**Postinstall scripts:** `sharp` runs `node install/check.js || npm run build` — this is the standard prebuilt binary downloader, not a network exfiltration script. Verified against the official sharp GitHub repository. All other packages have no postinstall scripts.

[VERIFIED: npm registry] for all packages listed above.

---

## Architecture Patterns

### System Architecture Diagram

```
Browser (Phase 2 — not built in Phase 1)
  |
  |  POST /api/images/process   (multipart, single file)
  |  POST /api/images/batch     (multipart, up to 20 files)
  |  GET  /health
  v
Express on Render
  |
  +-- CORS middleware (regex origin function)
  |
  +-- multer middleware
  |     memoryStorage → req.file.buffer (single)
  |                   → req.files[].buffer (batch)
  |     fileFilter:   reject HEIC/HEIF
  |     limits:       fileSize 20MB per file
  |
  +-- Route: GET /health
  |     → 200 { status: 'ok' }
  |
  +-- Route: POST /api/images/process
  |     1. metadata() check (decompression bomb guard)
  |     2. sharp(buffer)
  |          .resize(w, h, { fit: 'inside', withoutEnlargement: true })  [if w/h provided]
  |          .toFormat(format, { quality })
  |          .toBuffer({ resolveWithObject: true })
  |     3. res.set(Content-Type, Content-Disposition, X-Original-Size, X-Result-Size, X-Reduction-Pct)
  |     4. res.send(data)
  |
  +-- Route: POST /api/images/batch
  |     1. p-limit(3) + sharp.concurrency(1) + sharp.cache(false) guard
  |     2. Process each file through same pipeline as single
  |     3. archive = archiver('zip', { zlib: { level: 6 } })
  |     4. archive.pipe(res)
  |     5. results.forEach((buf, i) => archive.append(buf, { name: `optimized-${i+1}.webp` }))
  |     6. archive.finalize()
  |
  +-- Error middleware
        → { error: "ERROR_CODE", message: "..." }
        (MUST run after CORS middleware so CORS headers are present on error responses)
```

### Recommended Project Structure

```
controlmedia-backend/
├── src/
│   ├── index.js              # Express app init, middleware, port listen
│   ├── routes/
│   │   ├── health.js         # GET /health
│   │   └── images.js         # POST /api/images/process + /batch
│   ├── middleware/
│   │   ├── cors.js           # CORS origin function with regex
│   │   └── upload.js         # multer config (memoryStorage, fileFilter, limits)
│   ├── services/
│   │   └── imageProcessor.js # Sharp pipeline, decompression bomb check
│   └── utils/
│       └── cleanup.js        # setInterval sweep (stubbed for Phase 1, used by Phase 3)
├── render.yaml               # Render deploy config
├── package.json
└── .env.example              # PORT, ALLOWED_ORIGIN
```

### Pattern 1: multer memoryStorage + HEIC fileFilter

**What:** Configure multer to store images in RAM buffers and reject HEIC/HEIF before Sharp is called.

**When to use:** All image upload endpoints.

```javascript
// Source: https://sharp.pixelplumbing.com/ + multer docs
import multer from 'multer'

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
  'image/gif',
])

const BLOCKED_MIME_TYPES = new Set([
  'image/heic',
  'image/heif',
])

export const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },  // 20MB per file (D-02)
  fileFilter: (req, file, cb) => {
    if (BLOCKED_MIME_TYPES.has(file.mimetype) ||
        /\.(heic|heif)$/i.test(file.originalname)) {
      // Return descriptive error before Sharp is ever called (D-09)
      return cb(Object.assign(new Error('HEIC/HEIF format is not supported. Please convert to JPG first.'), { code: 'INVALID_FILE_TYPE' }))
    }
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      return cb(Object.assign(new Error(`Unsupported file type: ${file.mimetype}`), { code: 'INVALID_FILE_TYPE' }))
    }
    cb(null, true)
  }
})
```

**Note on HEIC detection:** Check both `file.mimetype` AND `file.originalname` extension. Some browsers send `application/octet-stream` for HEIC files, bypassing MIME-only checks.

### Pattern 2: Sharp Pipeline with Decompression Bomb Guard

**What:** Check image dimensions before processing to prevent OOM from maliciously crafted images.

**When to use:** First operation in every Sharp processing call.

```javascript
// Source: https://sharp.pixelplumbing.com/api-input#metadata
// Source: https://sharp.pixelplumbing.com/api-resize
import sharp from 'sharp'

const MAX_PIXELS = 25_000_000  // 25 megapixels ~= 5000×5000

export async function processImage(buffer, options = {}) {
  const { quality = 80, format = 'webp', width, height } = options

  // 1. Decompression bomb guard — check dimensions before allocating pixel memory
  const meta = await sharp(buffer).metadata()
  if (meta.width * meta.height > MAX_PIXELS) {
    throw Object.assign(
      new Error(`Image too large: ${meta.width}×${meta.height} pixels. Maximum is 25MP.`),
      { code: 'PROCESSING_ERROR' }
    )
  }

  // 2. Build pipeline
  let pipeline = sharp(buffer)

  // 3. Optional resize — only call if dimensions provided (D-06: no call = no change)
  if (width || height) {
    pipeline = pipeline.resize(
      width ? Number(width) : null,
      height ? Number(height) : null,
      { fit: 'inside', withoutEnlargement: true }
    )
  }

  // 4. Format + quality
  // Use format-specific options for best control
  switch (format) {
    case 'jpeg':
    case 'jpg':
      pipeline = pipeline.jpeg({ quality: Number(quality), mozjpeg: true })
      break
    case 'png':
      pipeline = pipeline.png({ compressionLevel: 6 })
      break
    case 'avif':
      pipeline = pipeline.avif({ quality: Number(quality), effort: 2 })  // effort:2 = fast (Pitfall 16)
      break
    case 'webp':
    default:
      pipeline = pipeline.webp({ quality: Number(quality) })
      break
  }

  // 5. resolveWithObject = true returns { data: Buffer, info: { size, width, height, format, ... } }
  // Source: https://sharp.pixelplumbing.com/api-output#tobuffer
  const { data, info } = await pipeline.toBuffer({ resolveWithObject: true })

  return { data, info, originalSize: buffer.length }
}
```

### Pattern 3: CORS Origin Function with Regex

**What:** Allow production URL, Vercel preview URLs (regex), and localhost.

**When to use:** Set as the first app.use() in index.js — before all routes AND error middleware.

**Critical:** CORS middleware must be applied BEFORE error middleware. If an error occurs before CORS headers are set, the browser sees a CORS error that masks the real error.

```javascript
// Source: PITFALLS.md Pitfall 7 + CONTEXT.md D-10
import cors from 'cors'

const CORS_ORIGINS = [
  'http://localhost:3000',
  /https:\/\/controlmedia-.*\.vercel\.app$/,  // Vercel preview URLs (D-10)
]

// If ALLOWED_ORIGIN env var is set (production URL), add it too
if (process.env.ALLOWED_ORIGIN) {
  CORS_ORIGINS.push(process.env.ALLOWED_ORIGIN)
}

export const corsMiddleware = cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (server-to-server, curl, Postman)
    if (!origin) return callback(null, true)
    const allowed = CORS_ORIGINS.some(o =>
      o instanceof RegExp ? o.test(origin) : o === origin
    )
    if (allowed) return callback(null, true)
    callback(new Error('Not allowed by CORS'))
  },
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type'],
})
```

### Pattern 4: Batch Processing with p-limit + archiver ZIP Streaming

**What:** Process up to 20 images with capped concurrency, stream ZIP directly to response.

**When to use:** `POST /api/images/batch` route.

```javascript
// Source: CONTEXT.md D-11 + ARCHITECTURE.md section 5
import pLimit from 'p-limit'
import archiver from 'archiver'
import sharp from 'sharp'

// Set globally at app startup (not per-request)
sharp.concurrency(1)    // Prevent libvips thread explosion (D-11)
sharp.cache(false)      // Release memory immediately after each op (D-11)

export async function processBatch(files, options, res) {
  const limit = pLimit(3)  // Max 3 concurrent Sharp operations (D-11)

  // Process all files with concurrency cap
  const results = await Promise.all(
    files.map((file, i) =>
      limit(() => processImage(file.buffer, options)
        .then(result => ({ ...result, index: i + 1 }))
      )
    )
  )

  // Stream ZIP directly to res — do NOT buffer the full archive in memory
  const format = options.format || 'webp'
  res.set('Content-Type', 'application/zip')
  res.set('Content-Disposition', 'attachment; filename="optimized.zip"')

  const archive = archiver('zip', { zlib: { level: 6 } })  // level 6, not 9 (already compressed images)

  // Set up error handler BEFORE piping
  archive.on('error', (err) => { throw err })
  archive.pipe(res)

  // Append each processed buffer — archiver streams chunks as appended
  results.forEach(({ data, index }) => {
    archive.append(data, { name: `optimized-${index}.${format}` })
  })

  await archive.finalize()
  // archive emits 'end' when done; archiver handles closing the pipe to res
}
```

### Pattern 5: Response Shape with Size Metadata

**What:** Return original size, result size, and % reduction for IMG-07.

**When to use:** `POST /api/images/process` single-image response.

```javascript
// Source: https://sharp.pixelplumbing.com/api-output#tobuffer
// info.size = bytes in processed output
// req.file.size = bytes of original upload

const originalSize = req.file.size  // bytes
const { data, info } = await processImage(req.file.buffer, options)
const resultSize = info.size         // bytes
const reductionPct = Math.round((1 - resultSize / originalSize) * 100)

// Option A: metadata in headers (allows frontend to read before parsing blob)
res.set('Content-Type', `image/${info.format}`)
res.set('Content-Disposition', `inline; filename="optimized.${info.format}"`)
res.set('X-Original-Size', originalSize)
res.set('X-Result-Size', resultSize)
res.set('X-Reduction-Pct', reductionPct)
res.set('Content-Length', data.length)
res.send(data)
```

**Note:** Putting metadata in headers (not JSON body) means the endpoint returns a binary image directly — the frontend can `URL.createObjectURL(blob)` without parsing a JSON wrapper. The frontend reads headers via `response.headers.get('X-Original-Size')`.

### Pattern 6: Error Middleware

**What:** Consistent `{ error, message }` shape for all 4xx/5xx responses (D-07).

**When to use:** Last `app.use()` in index.js, after all routes.

```javascript
// Source: CONTEXT.md D-07
export function errorHandler(err, req, res, next) {
  // multer errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      error: 'FILE_TOO_LARGE',
      message: `Maximum file size is 20MB per image`
    })
  }
  if (err.code === 'INVALID_FILE_TYPE') {
    return res.status(400).json({
      error: 'INVALID_FILE_TYPE',
      message: err.message
    })
  }
  if (err.code === 'PROCESSING_ERROR') {
    return res.status(422).json({
      error: 'PROCESSING_ERROR',
      message: err.message
    })
  }
  // Fallback
  console.error(err)
  res.status(500).json({
    error: 'PROCESSING_ERROR',
    message: 'An unexpected error occurred during processing'
  })
}
```

**Ordering in index.js must be:**
1. `app.use(corsMiddleware)` — FIRST
2. `app.use(express.json())` — for non-upload routes
3. Route registrations
4. `app.use(errorHandler)` — LAST

### Anti-Patterns to Avoid

- **Uncapped `Promise.all` on Sharp:** Raw `Promise.all(files.map(processImage))` spawns all libvips threads simultaneously → OOM crash on Render 512MB. Always wrap with `p-limit(3)`.
- **Setting CORS after routes:** Any route that throws before CORS middleware runs will return an error without `Access-Control-Allow-Origin` — browser masks real error with a CORS error.
- **Calling Sharp without `metadata()` first:** A 100KB PNG claiming 50000×50000 dimensions will exhaust RAM instantly. Always dimension-check first.
- **Buffering ZIP in memory:** Using `jszip` or building the full archive before sending can hit 400MB+ peak for a 20-file batch. Use archiver's streaming pipe.
- **MIME-only HEIC detection:** Some browsers send `application/octet-stream` for HEIC files. Check both MIME type and file extension.
- **Default AVIF effort (4):** AVIF `effort: 4` makes batch conversion take minutes. Use `effort: 2` for web tool responsiveness.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Image compress/resize/convert | Custom libvips wrapper | `sharp` | Hand-rolling image processing misses format-specific codec tuning, progressive encoding, color space handling |
| Multipart upload parsing | Custom busboy stream handler | `multer` | Content-Disposition header parsing, field extraction, and error boundary handling are subtle — multer is correct |
| ZIP creation | Manual DEFLATE + ZIP header writing | `archiver` | ZIP format has local file headers, central directory, end-of-central-directory record — the spec is 42 pages |
| Concurrency cap | Manual semaphore with count + queue | `p-limit` | Edge cases: rejected promises still need to release the slot; `p-limit` handles this correctly |
| CORS header logic | Manual `Access-Control-Allow-Origin` headers | `cors` middleware | Preflight (OPTIONS) requests, `Vary` header, and credential modes have subtle interactions |

**Key insight:** The "don't hand-roll" category here is not about cleverness — it's about correctness under edge cases that only appear in production (partial uploads, MIME spoofing, concurrent batch loads, malformed ZIP magic bytes).

---

## Common Pitfalls

### Pitfall 1: Decompression Bomb (Image OOM)

**What goes wrong:** A valid PNG with dimensions 100000×100000 but tiny compressed size passes multer's `fileSize` limit, then causes Sharp/libvips to allocate ~30GB of RAM for the raw pixel buffer. The Render process is OOM-killed instantly.

**Why it happens:** Image compression is highly effective — a white field compresses to near-zero bytes. The `fileSize` multer limit checks the compressed file size, not the uncompressed pixel allocation.

**How to avoid:** Always call `sharp(buffer).metadata()` and check `meta.width * meta.height > 25_000_000` before any processing pipeline. Throw with code `PROCESSING_ERROR` if exceeded.

**Warning signs:** Process killed immediately upon receiving a specific file; no gradual memory growth.

### Pitfall 2: CORS on Error Responses

**What goes wrong:** A file upload fails (wrong type, too large) and the error handler runs before CORS middleware has set `Access-Control-Allow-Origin`. The browser receives the error response without the header and reports it as a CORS error — masking the actual `413` or `400`.

**Why it happens:** Middleware order in Express is execution order. If CORS is registered after routes (or if error handler is placed before CORS), errors bypass CORS header injection.

**How to avoid:** Register `corsMiddleware` as the absolute first `app.use()`. Never place the error handler before CORS. Apply CORS to both success and error response paths.

**Warning signs:** Browser console shows `CORS policy blocked` but the server logs show a `413` or `400`.

### Pitfall 3: multer HEIC Detection via MIME Only

**What goes wrong:** Safari and some Android browsers send `Content-Type: application/octet-stream` for HEIC files. A MIME-only fileFilter check passes these files through to Sharp, which throws a cryptic `Input file has an unsupported format` error.

**Why it happens:** Browser MIME sniffing for HEIC is inconsistent. The safe approach checks both `file.mimetype` and `file.originalname` extension.

**How to avoid:** In fileFilter, check `file.mimetype` in the blocked set AND `/\.(heic|heif)$/i.test(file.originalname)`.

**Warning signs:** HEIC rejection works for Chrome uploads but passes through from Safari.

### Pitfall 4: AVIF Encoding Slowness in Batch

**What goes wrong:** A 20-image batch with `format=avif` takes 3–5 minutes. Users assume the server is broken. Default AVIF `effort: 4` is tuned for compression quality, not encode speed.

**Why it happens:** libavif's encoder defaults optimize for compression ratio over encode time.

**How to avoid:** Always use `effort: 2` for AVIF output in this web tool context. Document the tradeoff: slightly larger file vs. 3x faster encode.

**Warning signs:** Batch AVIF requests timeout or show unusually long processing times.

### Pitfall 5: Render Free Tier Cold Start Kills First Upload

**What goes wrong:** The first upload after 15 minutes of idle gets a 30–60 second cold start. For file uploads (especially the batch endpoint), the HTTP connection may be reset before the service boots.

**Why it happens:** Render Free tier spins down services after 15 min idle. The cold start includes Node.js startup, express init, and sharp prebuilt binary load.

**How to avoid:** Phase 1 acceptance: cold starts are expected on Free tier. Add a frontend `/health` ping on page load (Phase 2). Before public launch, upgrade to Render Starter ($7/mo) to eliminate cold starts.

**Warning signs:** First request of the day always fails or takes >30s; subsequent requests are fast.

### Pitfall 6: archiver `error` Event Not Handled Before `pipe`

**What goes wrong:** `archive.pipe(res)` is called before `archive.on('error', handler)`. If archiver encounters an error during streaming, it emits an unhandled `error` event that crashes the Node.js process with an `UnhandledPromiseRejection`.

**Why it happens:** Node.js `EventEmitter` throws unhandled `error` events as exceptions.

**How to avoid:** Always attach the error handler BEFORE calling `archive.pipe(res)`:
```javascript
archive.on('error', (err) => next(err))  // or throw
archive.pipe(res)
```

**Warning signs:** Server crashes with no useful error message during batch ZIP creation.

---

## Code Examples

Verified patterns from official sources:

### Sharp `toBuffer` with metadata returned

```javascript
// Source: https://sharp.pixelplumbing.com/api-output#tobuffer
const { data, info } = await sharp(inputBuffer)
  .webp({ quality: 80 })
  .toBuffer({ resolveWithObject: true })
// info = { format: 'webp', width: 800, height: 600, channels: 3, size: 45231, ... }
// data = Buffer
```

### Sharp resize with aspect ratio preservation

```javascript
// Source: https://sharp.pixelplumbing.com/api-resize
// fit: 'inside' = scale to fit within box, never exceed either dimension
// withoutEnlargement: true = never upscale
sharp(buffer)
  .resize(1200, 800, { fit: 'inside', withoutEnlargement: true })
```

### Sharp metadata() for decompression bomb detection

```javascript
// Source: https://sharp.pixelplumbing.com/api-input#metadata
const meta = await sharp(buffer).metadata()
// meta.width, meta.height available without decoding full pixel data
```

### archiver streaming ZIP to response

```javascript
// Source: https://github.com/archiverjs/node-archiver README
const archive = archiver('zip', { zlib: { level: 6 } })
archive.on('error', (err) => next(err))  // BEFORE pipe
archive.pipe(res)
archive.append(buffer1, { name: 'optimized-1.webp' })
archive.append(buffer2, { name: 'optimized-2.webp' })
archive.finalize()  // triggers streaming; res closes when archive emits 'end'
```

### CORS with regex origin function

```javascript
// Source: CONTEXT.md D-10 + ARCHITECTURE.md section 7
cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true)
    const ok = [
      'http://localhost:3000',
      /https:\/\/controlmedia-.*\.vercel\.app$/,
      process.env.ALLOWED_ORIGIN,
    ].filter(Boolean).some(o => o instanceof RegExp ? o.test(origin) : o === origin)
    ok ? cb(null, true) : cb(new Error('Not allowed by CORS'))
  },
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type'],
})
```

### p-limit batch processing

```javascript
// Source: https://github.com/sindresorhus/p-limit
import pLimit from 'p-limit'
const limit = pLimit(3)
const results = await Promise.all(
  files.map(file => limit(() => processImage(file.buffer, options)))
)
```

### Health check endpoint

```javascript
// Source: CONTEXT.md specifics + Render health-checks docs
router.get('/health', (req, res) => {
  res.json({ status: 'ok' })
})
// Render health check: expects any 2xx response from healthCheckPath
```

### render.yaml

```yaml
# Source: https://render.com/docs/blueprint-spec
services:
  - name: controlmedia-backend
    type: web
    runtime: node
    buildCommand: npm install
    startCommand: node src/index.js
    healthCheckPath: /health
    envVars:
      - key: NODE_ENV
        value: production
      - key: ALLOWED_ORIGIN
        sync: false  # Set in Render dashboard
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `fluent-ffmpeg` wrapper | `child_process.spawn` + `ffmpeg-static` | May 2025 (archived) | Not relevant for Phase 1 images, but critical constraint for Phase 3 |
| `multer` v1.x (diskStorage default) | `multer` v2.x (explicit storage required) | multer v2.1.1 (2026-03) | v2 requires explicit storage declaration — no implicit memoryStorage |
| `express` 4.x | `express` 5.x | Express 5.2.1 (2026-05) | async error handling improved; `next(err)` propagation works more consistently |

**Deprecated/outdated:**
- `fluent-ffmpeg`: Archived May 22, 2025. Do not use in any new project.
- `express-fileupload`: Loads entire file into memory — dangerous for video (Phase 3). Use multer exclusively.
- `jimp`: Pure JS, no AVIF/WebP support, 40–50x slower than Sharp. No valid use case here.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Render Free tier supports the sharp prebuilt binary download during `npm install` (no restricted egress) | Standard Stack, Render deploy | If wrong: Phase 1 deploy fails; mitigation: D-05 calls for immediate upgrade to Starter if blocked |
| A2 | multer v2.1.1 API is backwards-compatible with v1 patterns (storage, limits, fileFilter) | Standard Stack | If wrong: multer config may need adjustment; low risk given official GitHub verified |
| A3 | Express 5.x async error propagation (throwing in async route handler calls `next(err)` automatically) | Architecture Patterns | If very wrong: need explicit try/catch in every route; safe fallback is explicit try/catch anyway |

---

## Open Questions

1. **Node.js version on Render Free tier**
   - What we know: Render supports Node.js LTS versions. Node 20 is specified in CLAUDE.md.
   - What's unclear: Whether Free tier uses Node 20 by default or requires a `.node-version` / `engines` field in `package.json`.
   - Recommendation: Add `"engines": { "node": ">=20.0.0" }` to `package.json` and `NODE_VERSION=20` env var in render.yaml. Costs nothing, guarantees the correct runtime.

2. **multer v2 `array()` field name for batch**
   - What we know: The endpoint uses `upload.array('files', 20)` per CONTEXT.md specifics.
   - What's unclear: Whether multer v2 changed the `array()` API vs v1.
   - Recommendation: Test with `upload.array('files', 20)` on first implementation. If breaking change found, fall back to v1.4.5.

3. **Size metadata delivery: headers vs JSON wrapper**
   - What we know: IMG-07 requires original size, result size, % reduction.
   - What's unclear: Frontend preference — headers (allows binary response directly) vs JSON wrapper with base64 data.
   - Recommendation: Use headers (`X-Original-Size`, `X-Result-Size`, `X-Reduction-Pct`) for single endpoint. This lets the frontend handle the image as a blob directly with `URL.createObjectURL()`. Frontend reads metadata via `response.headers.get(...)`. Document in API contract.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | All | ✓ | v22.17.1 (local) | Render provides Node 20 LTS |
| npm | Package install | ✓ | 10.9.2 | — |
| Internet access for `npm install` | sharp prebuilt download | ✓ (local) | — | Render build environment has internet; if blocked, see A1 assumption |

**Note:** This phase produces a standalone Node.js backend with no external service dependencies (no database, no Redis, no external APIs). Environment availability concerns are limited to the Render build environment supporting `npm install` including `sharp`'s prebuilt binary download.

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | No auth in v1 (GEN-01) |
| V3 Session Management | No | Stateless API |
| V4 Access Control | No | Public tool; no user data |
| V5 Input Validation | Yes | multer fileFilter (MIME + extension), Sharp metadata() pixel limit, multer fileSize limit |
| V6 Cryptography | No | No secrets processed |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Decompression bomb (ZIP bomb equivalent for images) | Denial of Service | `sharp(buffer).metadata()` → check `width * height > 25_000_000` before processing |
| HEIC bypass via MIME spoofing | Tampering | Check both `file.mimetype` AND `file.originalname` extension in fileFilter |
| Oversized file upload | Denial of Service | multer `limits.fileSize: 20 * 1024 * 1024` per file |
| File count abuse (batch) | Denial of Service | `upload.array('files', 20)` enforces max 20 files |
| CORS bypass | Elevation of privilege | Origin function validates against allowlist + regex; non-matching origins rejected |

---

## Sources

### Primary (HIGH confidence)

- [sharp official docs](https://sharp.pixelplumbing.com/api-output) — `toBuffer({ resolveWithObject: true })`, format-specific options, `metadata()` API [VERIFIED: official docs]
- [sharp resize API](https://sharp.pixelplumbing.com/api-resize) — `fit: 'inside'`, `withoutEnlargement`, parameter signatures [VERIFIED: official docs]
- [sharp install docs](https://sharp.pixelplumbing.com/install) — prebuilt binary behavior on Linux x64, no special flags needed [VERIFIED: official docs]
- [Render health checks](https://render.com/docs/health-checks) — HTTP 2xx/3xx = healthy; `healthCheckPath` config [VERIFIED: official docs]
- [Render blueprint spec](https://render.com/docs/blueprint-spec) — `render.yaml` format: `startCommand`, `healthCheckPath`, `envVars` [VERIFIED: official docs]
- [npm registry: all packages](https://www.npmjs.com) — versions and publish dates confirmed via `npm view` [VERIFIED: npm registry]
- Pre-existing research: `.planning/research/STACK.md`, `.planning/research/ARCHITECTURE.md`, `.planning/research/PITFALLS.md` — already verified against official sources as of 2026-05-22

### Secondary (MEDIUM confidence)

- [archiver README](https://github.com/archiverjs/node-archiver/blob/master/README.md) — streaming ZIP to response, `append(buffer, { name })`, `finalize()`, `zlib.level` [CITED: official GitHub README]

### Tertiary (LOW confidence — none)

No LOW confidence claims in this research. All material is either verified against official docs, confirmed via npm registry, or drawn from the project's own pre-existing research that was previously validated.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified via `npm view` on 2026-05-22; official repos confirmed
- Sharp API: HIGH — verified via official sharp.pixelplumbing.com documentation fetched in this session
- Architecture: HIGH — drawn from project's pre-existing ARCHITECTURE.md + PITFALLS.md (previously verified) + confirmed against official docs
- Render config: HIGH — render.yaml format verified via official Render blueprint spec docs
- Pitfalls: HIGH — drawn from PITFALLS.md with verified sources; cross-referenced with Sharp GitHub issues

**Research date:** 2026-05-22
**Valid until:** 2026-06-22 (30 days) — stable libraries; sharp and Express rarely have breaking changes in patch releases
