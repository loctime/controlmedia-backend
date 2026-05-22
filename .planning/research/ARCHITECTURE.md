# Architecture Patterns: ControlMedia

**Domain:** Browser-based media processing web app (image + video)
**Researched:** 2026-05-22
**Confidence:** HIGH for image path, MEDIUM for video async path (Render timeout limits not fully documented)

---

## 1. System Overview

Five major components. Each has a clear boundary and a single direction of data flow.

```
Browser (Next.js on Vercel)
  |
  |  HTTP/FormData (direct, no Vercel proxy)
  v
Express Backend (Node.js on Render)
  |           |
  v           v
Sharp       FFmpeg (child process)
  |           |
  v           v
  Buffer/Stream output
  |
  v
HTTP Response (binary or ZIP stream) → Browser → User downloads
```

The most important architectural decision: **files go directly from the browser to Render**, never through Vercel. Vercel serverless functions have a hard 4.5 MB payload limit. Sending a 50 MB image or 500 MB video through Next.js API routes will fail unconditionally. The frontend only orchestrates UI state; all binary data moves over a direct `fetch()` call from the client to the Render backend.

---

## 2. Request/Response Flow: Image Processing

### Individual Image (with live preview)

```
Browser
  1. User selects file + configures options
  2. POST /api/images/process
     Content-Type: multipart/form-data
     Body: { file: <binary>, options: { quality, width, height, format, ... } }
     [direct to Render, not through Vercel]

Render/Express
  3. multer (memoryStorage) receives file as Buffer in req.file.buffer
  4. Build Sharp pipeline:
       sharp(buffer)
         .resize(width, height, { fit: 'inside'/'cover'/... })
         .toFormat(format, { quality })
  5. .toBuffer() → processed Buffer
  6. Delete original buffer (GC)

Response
  7. res.set('Content-Type', 'image/webp')  // or jpeg, png, avif
     res.set('Content-Disposition', 'inline; filename="optimized.webp"')
     res.set('Content-Length', processedBuffer.length)
     res.send(processedBuffer)

Browser
  8. Receive blob → URL.createObjectURL(blob) → set as <img src>
     Display before/after comparison (original from local file, result from blob URL)
```

Round-trip time: typically 200ms–2s for images under 10 MB. Synchronous pattern (single HTTP request) is correct here because Sharp is fast enough that async job overhead would be net slower for images.

**Key invariant:** Sharp processes from a Buffer and outputs to a Buffer. No disk I/O in the happy path. `sharp.cache(false)` and `sharp.concurrency(1)` should be set on Render's 512 MB instances to prevent libvips from spawning excessive threads.

---

## 3. Request/Response Flow: Video Processing

Video is fundamentally different: FFmpeg on a 100 MB file can take 30–120 seconds. A synchronous HTTP request will either time out on the client or at the network layer. The correct pattern is **async job with SSE progress stream**.

### Phase A — Job Submission

```
Browser
  POST /api/videos/upload
  Content-Type: multipart/form-data
  Body: { file: <binary>, options: { codec, resolution, trim_start, trim_end, bitrate, format } }

Render/Express
  multer writes file to /tmp/<uuid>/input.<ext>
  (disk storage, not memory — videos can be 500 MB; do NOT use memoryStorage for video)
  Creates job record in memory: { id, status: 'queued', inputPath, options, outputPath: null }
  Returns immediately:
    HTTP 202 Accepted
    { jobId: "abc-123", statusUrl: "/api/videos/status/abc-123" }
```

### Phase B — Progress Streaming (SSE)

```
Browser
  GET /api/videos/progress/abc-123
  Accept: text/event-stream

Render/Express
  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' })
  Starts FFmpeg child process (spawned, not exec — need to pipe stderr)

  FFmpeg stderr emits lines like:
    "frame=  240 fps= 28 q=28.0 size=    1024kB time=00:00:08.00 bitrate= 1048.6kbits/s"

  Parse duration from first stderr output (or from ffprobe pre-scan)
  Parse time= from each stderr line
  Compute percent = currentTime / totalDuration * 100

  res.write(`data: ${JSON.stringify({ status: 'processing', percent: 42 })}\n\n`)
  // repeat every stderr progress line

  On FFmpeg exit code 0:
    res.write(`data: ${JSON.stringify({ status: 'complete', downloadUrl: '/api/videos/download/abc-123' })}\n\n`)
    res.end()

  On FFmpeg error:
    res.write(`data: ${JSON.stringify({ status: 'error', message: '...' })}\n\n`)
    res.end()
    // cleanup input + output files
```

**ffmpeg-on-progress** npm package handles the stderr parsing and percent calculation robustly. Do not re-implement this from scratch.

### Phase C — Download

```
Browser
  GET /api/videos/download/abc-123
  (triggered only after SSE emits status: 'complete')

Render/Express
  Validate job exists + status == complete
  res.set('Content-Disposition', 'attachment; filename="output.mp4"')
  res.set('Content-Type', 'video/mp4')
  fs.createReadStream(job.outputPath).pipe(res)
  // Stream, not buffer — output file may be 200 MB+

  On res 'finish':
    Delete input + output files from /tmp
    Delete job from memory map
```

---

## 4. Long-Running FFmpeg Jobs: Sync vs Async Decision

| Approach | When to Use | Why |
|---|---|---|
| Synchronous (await FFmpeg, return result) | Never for video in production | Timeouts guaranteed at 30–120s for large files |
| Polling (202 + GET status endpoint) | Simple clients, mobile apps | Client drives cadence, simpler server |
| SSE (202 + event stream) | Web apps with progress UI | Server pushes, no polling overhead, natural for UI progress bars |
| WebSocket | Bidirectional real-time needs | Overkill here; SSE is sufficient |

**Decision: SSE.** The project needs a visible progress bar. SSE is one-directional (server to client) which is exactly what's needed. It works over standard HTTP/1.1 without a WebSocket upgrade. Express supports it natively with `res.write()`.

The job lifecycle lives entirely **in-memory on the Render process** (a plain JS Map). No Redis, no Bull, no database. This is correct for v1 because:
- There's only one Render instance
- Jobs are ephemeral (no history requirement)
- Adding a queue system adds a Redis dependency for minimal benefit at this scale

**If Render ever scales to multiple instances**, job state must move to Redis. Flag this as a known single-instance limitation.

---

## 5. Batch Processing Architecture (20 Images)

Batch images do not need async jobs. Sharp is fast enough that 20 images at 5 MB each completes in under 30 seconds — well within any reasonable timeout. The pattern:

```
Browser
  POST /api/images/batch
  Content-Type: multipart/form-data
  Body: { files: [file1, file2, ...file20], options: { ... } }
  (multer fields: upload.array('files', 20))

Render/Express
  Receive all files as req.files[] (array of Buffers via memoryStorage)

  // Process concurrently but with controlled concurrency
  const results = await Promise.all(
    req.files.map(file =>
      sharp(file.buffer)
        .resize(...)
        .toFormat(...)
        .toBuffer()
    )
  )
  // Sharp's internal concurrency is already managed by libvips worker threads
  // On 512 MB Render instances, keep sharp.concurrency(1) to prevent thread explosion

  // Stream ZIP directly to response — do NOT build full ZIP in memory first
  res.set('Content-Type', 'application/zip')
  res.set('Content-Disposition', 'attachment; filename="optimized.zip"')

  const archive = archiver('zip', { zlib: { level: 6 } })  // level 9 is overkill for images
  archive.pipe(res)

  results.forEach((buffer, i) => {
    archive.append(buffer, { name: `optimized-${i + 1}.${targetFormat}` })
  })

  archive.finalize()
  // archiver streams chunks to res as each append() is called
  // res completes when archive emits 'end'
```

**Key: stream the ZIP to the response while appending.** Do not buffer the entire ZIP in memory. The `archiver` library pipes to `res` incrementally. A 20-file batch of 1 MB outputs = 20 MB of data. Streaming keeps peak memory at one file at a time rather than 20 MB simultaneously.

**Concurrency limit for Sharp on Render 512 MB:** Set `sharp.concurrency(1)` globally. Sharp/libvips defaults to spawning one thread per CPU core. On Render's shared infrastructure, this causes memory fragmentation (documented issue with glibc's allocator). With `concurrency(1)` and `sharp.cache(false)`, processing 20 images sequentially via `Promise.all` over a thread pool of 1 is safe. Processing time: roughly 500ms per image × 20 = ~10 seconds. Acceptable.

---

## 6. File Lifecycle

### Image Files
```
Upload    → Buffer in req.file.buffer (RAM, multer memoryStorage)
Process   → Sharp reads Buffer, emits new Buffer
Output    → Send Buffer as HTTP response body
Cleanup   → Original Buffer is released to GC after res.send()
           → No disk I/O at any point
```

### Video Files
```
Upload    → /tmp/<jobId>/input.<ext>  (multer diskStorage, MUST be disk for large files)
Process   → FFmpeg reads from /tmp path, writes to /tmp/<jobId>/output.<ext>
Download  → fs.createReadStream(outputPath).pipe(res)
Cleanup   → Delete both files on:
              a) successful download complete (res 'finish' event)
              b) FFmpeg error
              c) Scheduled sweep (safety net, see below)
```

### Cleanup Safety Net (scheduled sweep)

The happy path cleanup handles most cases. But processes can crash, clients can disconnect before downloading, and SSE connections can drop. A scheduled sweep handles stragglers:

```javascript
// Run every 10 minutes
setInterval(() => {
  const threshold = Date.now() - 30 * 60 * 1000  // 30 minutes
  for (const [jobId, job] of jobStore.entries()) {
    if (job.createdAt < threshold) {
      if (job.inputPath) fs.unlink(job.inputPath, () => {})
      if (job.outputPath) fs.unlink(job.outputPath, () => {})
      jobStore.delete(jobId)
    }
  }
}, 10 * 60 * 1000)
```

**Render /tmp constraints:** Render's free/starter instances have an ephemeral filesystem. Files in /tmp persist only for the lifetime of the process — they are automatically cleared on deploy or restart. This is desirable for privacy but means cleanup on crash is handled by Render itself. The sweep is still needed for within-process accumulation.

---

## 7. API Design

REST. No GraphQL, no tRPC for v1. The operations map naturally to HTTP verbs and the client is a single Next.js app.

### Endpoints

```
POST   /api/images/process
  multipart/form-data: file (single), options (JSON string or individual fields)
  → 200 + binary image (Content-Type matches output format)
  → 400 if invalid file type / missing options
  → 413 if file exceeds limit
  → 500 if Sharp throws

POST   /api/images/batch
  multipart/form-data: files[] (up to 20), options
  → 200 + application/zip stream
  → 400 / 413 / 500

POST   /api/videos/upload
  multipart/form-data: file (single), options
  → 202 + { jobId, statusUrl }
  → 400 / 413

GET    /api/videos/progress/:jobId
  → 200 text/event-stream (SSE)
    events: { status: 'processing', percent: N }
             { status: 'complete', downloadUrl: '/api/videos/download/:jobId' }
             { status: 'error', message: '...' }
  → 404 if jobId not found

GET    /api/videos/download/:jobId
  → 200 + video/mp4 stream (or appropriate MIME)
  → 404 if job not found or not complete yet

GET    /health
  → 200 { status: 'ok' }  (Render health check)
```

### Request Shape for Options

Pass options as a flat JSON field alongside the file in the multipart body:

```
POST /api/images/process
Content-Type: multipart/form-data

file: <binary>
quality: 80
width: 1920
height: 1080
format: "webp"
fit: "inside"
```

Multer + express parses these as `req.body.quality`, `req.body.format`, etc. No need to JSON.stringify an options object — flat fields are cleaner for FormData.

### Error Shape

```json
{ "error": "FILE_TOO_LARGE", "message": "Maximum file size is 50MB for images" }
```

Consistent shape across all 4xx/5xx responses. Frontend checks `res.ok` before attempting to use the response as binary.

### CORS Configuration

```javascript
app.use(cors({
  origin: process.env.ALLOWED_ORIGIN,  // 'https://controlmedia.vercel.app'
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type']
}))
```

The `ALLOWED_ORIGIN` env var prevents other sites from using the backend. In development, `http://localhost:3000`.

---

## 8. Frontend State Management

No global state library needed for v1. React's `useState` + `useReducer` is sufficient. The processing state machine for each file is:

```
idle → uploading → processing → complete | error
```

### Individual File State

```typescript
type FileJob = {
  id: string
  file: File
  previewUrl: string          // URL.createObjectURL(file) for original preview
  status: 'idle' | 'uploading' | 'processing' | 'complete' | 'error'
  progress: number            // 0-100, only meaningful for video
  resultUrl: string | null    // URL.createObjectURL(resultBlob) for image preview
  resultSize: number | null
  error: string | null
}
```

### Image Processing Hook

```typescript
// useImageProcessor.ts
async function processImage(job: FileJob, options: ProcessOptions) {
  setStatus('uploading')
  const formData = new FormData()
  formData.append('file', job.file)
  Object.entries(options).forEach(([k, v]) => formData.append(k, String(v)))

  const res = await fetch(`${BACKEND_URL}/api/images/process`, {
    method: 'POST',
    body: formData
  })
  if (!res.ok) { setStatus('error'); return }

  const blob = await res.blob()
  setResultUrl(URL.createObjectURL(blob))
  setResultSize(blob.size)
  setStatus('complete')
}
```

No XMLHttpRequest needed — `fetch` is sufficient. Upload progress (0 to 100%) during the upload phase requires XHR's `onprogress` if desired, but for images this upload is fast enough that a spinner is acceptable.

### Video Processing Hook

```typescript
// useVideoProcessor.ts
async function processVideo(job: FileJob, options: VideoOptions) {
  // Phase 1: Upload
  setStatus('uploading')
  const formData = new FormData()
  formData.append('file', job.file)
  // ... append options

  const uploadRes = await fetch(`${BACKEND_URL}/api/videos/upload`, {
    method: 'POST', body: formData
  })
  const { jobId } = await uploadRes.json()

  // Phase 2: SSE progress
  setStatus('processing')
  const evtSource = new EventSource(`${BACKEND_URL}/api/videos/progress/${jobId}`)

  evtSource.onmessage = (e) => {
    const data = JSON.parse(e.data)
    if (data.status === 'processing') setProgress(data.percent)
    if (data.status === 'complete') {
      evtSource.close()
      setDownloadUrl(`${BACKEND_URL}${data.downloadUrl}`)
      setStatus('complete')
    }
    if (data.status === 'error') {
      evtSource.close()
      setError(data.message)
      setStatus('error')
    }
  }

  evtSource.onerror = () => {
    evtSource.close()
    setError('Connection lost')
    setStatus('error')
  }
}
```

`EventSource` is built into all modern browsers. No external library needed. Note: `EventSource` does not support custom headers, so if auth were ever added, the pattern would need to change to `fetch` with a ReadableStream reader. For the current public/no-auth design, `EventSource` is the correct tool.

### Batch Queue State

```typescript
// Each file in the batch is an independent FileJob
// Process them with controlled concurrency using a simple semaphore:

async function processBatch(files: File[], options: ProcessOptions) {
  const jobs = files.map(f => createJob(f))
  setJobs(jobs)

  // Send all at once as a single multipart request
  const formData = new FormData()
  files.forEach(f => formData.append('files', f))
  Object.entries(options).forEach(([k, v]) => formData.append(k, String(v)))

  const res = await fetch(`${BACKEND_URL}/api/images/batch`, { method: 'POST', body: formData })
  // Response is a ZIP stream
  const blob = await res.blob()
  triggerDownload(blob, 'optimized.zip')
}
```

The batch endpoint processes all files server-side in one request. The frontend does not need to manage per-file progress for batch — a single "processing..." state until the ZIP arrives is correct UX for v1. Per-file batch progress would require WebSockets or SSE, which adds complexity not justified for 20-image batches completing in ~10 seconds.

---

## 9. Component Boundaries

```
┌─────────────────────────────────────┐
│  Browser (Next.js)                  │
│                                     │
│  ┌───────────────┐ ┌─────────────┐  │
│  │ Image Tool    │ │ Video Tool  │  │
│  │ - Dropzone    │ │ - Dropzone  │  │
│  │ - Options UI  │ │ - Options   │  │
│  │ - Preview     │ │ - Progress  │  │
│  │ - Download    │ │ - Download  │  │
│  └───────┬───────┘ └──────┬──────┘  │
│          │                │         │
│  ┌───────▼────────────────▼──────┐  │
│  │  API Client (fetch + SSE)     │  │
│  │  BACKEND_URL env var          │  │
│  └───────────────────────────────┘  │
└──────────────┬──────────────────────┘
               │ HTTP (direct, CORS)
               ▼
┌─────────────────────────────────────┐
│  Express (Render)                   │
│                                     │
│  ┌───────────┐   ┌───────────────┐  │
│  │ /images/* │   │  /videos/*    │  │
│  │           │   │               │  │
│  │  multer   │   │  multer       │  │
│  │ (memory)  │   │ (disk /tmp)   │  │
│  │           │   │               │  │
│  │  sharp    │   │  ffmpeg       │  │
│  │ pipeline  │   │  child_proc   │  │
│  │           │   │  + SSE out    │  │
│  └───────────┘   └───────────────┘  │
│                                     │
│  ┌─────────────────────────────┐    │
│  │  JobStore (in-memory Map)   │    │
│  │  Cleanup sweep (setInterval)│    │
│  └─────────────────────────────┘    │
└─────────────────────────────────────┘
```

**No shared state between image and video routes.** Each router is independent. The JobStore is used only by the video router.

---

## 10. Build Order

Dependencies dictate the only sensible build sequence. Each step unblocks the next.

### Phase 1: Backend Core (images)
Build first because the frontend needs a real API to test against. Mocking file processing is misleading.

1. Express app scaffold + CORS + health check
2. multer configuration (memory storage for images)
3. `POST /api/images/process` — Sharp pipeline with options parsing
4. Error handling middleware (consistent JSON error shape)
5. Manual test with curl/Postman: confirm binary response, confirm options work

**Why images before video:** Sharp is synchronous and simple. No async job infrastructure needed. Proves the upload→process→download flow works end to end before introducing FFmpeg complexity.

### Phase 2: Frontend Image Tool
Build against the working backend.

1. Next.js project scaffold on Vercel (or local dev pointing to local backend)
2. File dropzone component
3. Options panel (quality, dimensions, format)
4. `fetch()` to backend — receive blob, `URL.createObjectURL`
5. Before/after preview component
6. Download button

**At this point the core product works for images.**

### Phase 3: Backend Video
Introduces the async job pattern. Build on a working foundation.

1. multer disk storage config for `/tmp`
2. `POST /api/videos/upload` — write to /tmp, create job, return 202
3. FFmpeg child process spawn with stderr parsing
4. `GET /api/videos/progress/:jobId` — SSE endpoint
5. `GET /api/videos/download/:jobId` — stream output file
6. Cleanup on download + sweep interval
7. Test with curl + a real video file

### Phase 4: Frontend Video Tool
1. Video dropzone
2. Options panel (resolution presets, codec, trim range)
3. Upload to backend → receive jobId
4. `EventSource` connection → progress bar
5. Download trigger on completion

### Phase 5: Batch
1. Backend `POST /api/images/batch` — Promise.all + archiver ZIP stream
2. Frontend batch dropzone (multiple file select)
3. ZIP download trigger

### Phase 6: Presets + Polish
1. Preset definitions as a shared constants file (Web, WhatsApp, Discord, Twitter/X, Instagram)
2. Preset selector populates options panel
3. Size comparison display (original bytes vs result bytes, % reduction)
4. File type validation on frontend (reject non-image/video before upload)

---

## 11. Critical Constraints

| Constraint | Impact | Mitigation |
|---|---|---|
| Vercel 4.5 MB API route limit | Cannot route files through Next.js API | Upload directly from browser to Render via fetch() |
| Render 512 MB RAM (free/starter) | Sharp thread explosion, FFmpeg OOM on large videos | sharp.concurrency(1), sharp.cache(false), file size limits |
| Render free tier sleeps after 15 min inactivity | First request after sleep is slow (cold start ~10-30s) | Acceptable for v1; upgrade to paid plan for production |
| FFmpeg memory constraint | 500 MB input + transcoded output can exceed 512 MB RAM | Set 200 MB video limit on starter, upgrade tier for larger files |
| Single Render instance | In-memory JobStore not distributed | Acceptable for v1; Redis needed only at multi-instance scale |
| EventSource no custom headers | Cannot add auth headers to SSE connection | Non-issue for public tool; if auth added later, switch to fetch ReadableStream |

---

## Sources

- [Transloadit: Stream video processing with Node.js and FFmpeg](https://transloadit.com/devtips/stream-video-processing-with-node-js-and-ffmpeg/)
- [DigitalOcean: Build a Media Processing API in Node.js With Express and FFmpeg.wasm](https://www.digitalocean.com/community/tutorials/how-to-build-a-media-processing-api-in-node-js-with-express-and-ffmpeg-wasm)
- [context.dev: Preventing Memory Issues in Node.js Sharp](https://www.context.dev/blog/preventing-memory-issues-in-node-js-sharp-a-journey)
- [tutorialpedia.org: Stream Dynamically Created Zip Files with Node.js and Express](https://www.tutorialpedia.org/blog/dynamically-create-and-stream-zip-to-client/)
- [Zuplo: Asynchronous Operations in REST APIs](https://zuplo.com/learning-center/asynchronous-operations-in-rest-apis-managing-long-running-tasks)
- [ffmpeg-on-progress npm package](https://www.npmjs.com/package/ffmpeg-on-progress)
- [archiver npm package](https://www.npmjs.com/package/archiver)
- [Render community: FFmpeg memory constraints](https://render.discourse.group/t/ffmpeg-in-node-js-environment-runtime-limit/23216)
- [Vercel: How to bypass the 4.5MB body size limit](https://vercel.com/kb/guide/how-to-bypass-vercel-body-size-limit-serverless-functions)
- [sharp performance docs](https://sharp.pixelplumbing.com/performance/)
