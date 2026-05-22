# Technology Stack — ControlMedia

**Project:** ControlMedia (image/video optimization web app)
**Researched:** 2026-05-22
**Overall confidence:** HIGH (confirmed via official docs + multiple sources)

---

## 1. Image Processing — Sharp

**Recommendation: `sharp` v0.34.5 (latest stable) | CONFIDENCE: HIGH**

Sharp is the unambiguous leader for server-side image processing in Node.js. No realistic alternatives in the production server context.

### Why Sharp

- Built on **libvips**, a battle-tested C library. Resizing is 4–5x faster than ImageMagick and 40–50x faster than pure-JS alternatives like Jimp.
- Native support for all required formats: JPEG, PNG, **WebP**, **AVIF**, GIF, TIFF, SVG input.
- Output formats: JPEG, PNG, WebP, AVIF, GIF, TIFF.
- Operations needed for ControlMedia are all first-class: resize (with fit modes), compress (quality 0–100), format convert, crop/extract, rotate.
- Pre-built binaries via Node-API v9 — zero compilation on Render. Just `npm install`.
- Actively maintained; v0.35.0-rc.5 was published April 2026.

### Node.js requirement

Node.js `^18.17.0` or `>= 20.3.0`. Use Node 20 LTS.

### Key API options

```javascript
// Compress + convert to WebP
sharp(inputBuffer)
  .resize(800, null, { withoutEnlargement: true })
  .webp({ quality: 80 })
  .toBuffer()

// Convert to AVIF (better compression than WebP but slower encoding)
sharp(inputBuffer)
  .avif({ quality: 50, effort: 4 }) // effort 0-9, higher = slower + smaller
  .toBuffer()

// JPEG with mozjpeg-style quality
sharp(inputBuffer)
  .jpeg({ quality: 80, mozjpeg: true })
  .toBuffer()
```

**AVIF note:** Default quality is 50. Encoding is slower than WebP but produces ~50% smaller files vs JPEG at comparable visual quality. Fine for ControlMedia since this is server-side.

### Alternatives considered and rejected

| Library | Verdict |
|---------|---------|
| **Jimp** | Pure JS, no AVIF/WebP support, 40–50x slower. Only valid for edge/Workers. Reject. |
| **ImageMagick (gm)** | Requires system binary, slower, complex deploy. No benefit over Sharp. Reject. |
| **canvas** | Canvas API, not image processing. Wrong tool. Reject. |
| **Cloudflare Images API** | Paid external service, adds latency and cost. Reject for v1. |

### Installation

```bash
npm install sharp
```

Sharp downloads a pre-built native binary during install — no extra system packages needed on Render (libvips is bundled).

---

## 2. Video Processing — FFmpeg via child_process + ffmpeg-static

**Recommendation: `child_process.spawn` with `ffmpeg-static` v5.x | CONFIDENCE: HIGH**

### The fluent-ffmpeg situation (critical)

`fluent-ffmpeg` (the historically dominant Node.js FFmpeg wrapper) was **archived by its maintainer on May 22, 2025** and is explicitly "no longer supported." Last npm publish was 2+ years ago (v2.1.3). Still has ~2M weekly downloads from legacy projects, but:
- No longer compatible with recent FFmpeg versions
- No security fixes
- Architecture deprecated by its own creator

**Do not use fluent-ffmpeg for a new project in 2025.**

### Recommended approach: direct child_process + ffmpeg-static

Since there is no well-maintained high-level FFmpeg wrapper for Node.js as of 2025, the correct approach is to call FFmpeg directly via `child_process.spawn` and parse its stderr for progress. This is:
- Explicit and readable — FFmpeg's CLI is well-documented
- No wrapper layer that can break with FFmpeg version changes
- Gives full control over codec flags, bitrate, codec presets

`ffmpeg-static` bundles a pre-compiled FFmpeg binary into the npm package, so you don't depend on Render's system FFmpeg version. This is more reproducible.

```javascript
import { spawn } from 'child_process'
import ffmpegPath from 'ffmpeg-static'

function compressVideo(inputPath, outputPath, options, onProgress) {
  return new Promise((resolve, reject) => {
    const args = [
      '-i', inputPath,
      '-c:v', 'libx264',
      '-crf', String(options.crf ?? 28),   // 18-28, lower = better quality
      '-preset', options.preset ?? 'fast',  // ultrafast, fast, medium, slow
      '-c:a', 'aac',
      '-b:a', '128k',
      '-movflags', '+faststart',            // web-optimized MP4
      '-progress', 'pipe:1',               // machine-readable progress to stdout
      '-y', outputPath
    ]

    const proc = spawn(ffmpegPath, args)
    
    proc.stdout.on('data', (data) => {
      // Parse "out_time_ms=1234000" lines for progress
      const match = data.toString().match(/out_time_ms=(\d+)/)
      if (match) onProgress?.(parseInt(match[1]))
    })

    proc.on('close', (code) => {
      if (code === 0) resolve(outputPath)
      else reject(new Error(`FFmpeg exited with code ${code}`))
    })
  })
}
```

**Key FFmpeg flag: `-progress pipe:1`** — outputs machine-readable key=value pairs to stdout every second. Parse `out_time_ms` and divide by total duration (obtained with `ffprobe`) to get a reliable percentage. This is more reliable than fluent-ffmpeg's `percent` estimate which was notoriously inaccurate anyway.

### Why not @ffmpeg/ffmpeg WASM

`@ffmpeg/ffmpeg` (WASM) runs FFmpeg compiled to WebAssembly. Options:
- **Browser-side (client-side):** Possible but 5–15x slower than native. Heavy download (~30MB WASM). No progress reporting without complex threading. Eliminates server cost but user experience is poor for video.
- **Node.js server-side:** Not the right tool. Use native binary.

**Verdict:** WASM is useful only for small client-side image operations or if you have zero server access (e.g., fully static). For ControlMedia with a Node.js backend, use the native binary. Reject @ffmpeg/ffmpeg for server-side.

### Supporting packages

```bash
npm install ffmpeg-static          # pre-built FFmpeg binary for current platform
npm install ffprobe-static         # ffprobe binary for duration/metadata extraction
# OR
npm install ffmpeg-ffprobe-static  # both in one package
```

**Note:** `ffmpeg-static` bundles FFmpeg 6.1.1. This is fine — you don't need cutting-edge FFmpeg features, just H.264/H.265 encoding, MP4/WebM/MOV output, and trim.

### Alternatives considered

| Approach | Verdict |
|----------|---------|
| **fluent-ffmpeg** | Archived May 2025, no longer supported. Reject. |
| **@ffmpeg/ffmpeg WASM** | 5–15x slower, complex threading, ~30MB download. Only for browser-only scenarios. Reject for server-side. |
| **System FFmpeg on Render** | FFmpeg IS pre-installed on Render. Viable but `ffmpeg-static` is more reproducible across environments (local dev, CI, Render). Use ffmpeg-static. |

---

## 3. File Upload Handling

**Recommendation: `multer` v1.4.5 (backend) + `axios` (frontend) | CONFIDENCE: HIGH**

### Backend: multer with memoryStorage

Multer is the standard Express file upload middleware, built on busboy (a streaming multipart parser). For ControlMedia, since files are processed immediately and deleted, `memoryStorage` is appropriate for images. For videos, use `diskStorage` to `/tmp` to avoid memory exhaustion.

```javascript
import multer from 'multer'
import path from 'path'
import { randomUUID } from 'crypto'

// Images: memory (fast, no disk I/O)
const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']
    cb(null, allowed.includes(file.mimetype))
  }
})

// Videos: disk to /tmp (avoid OOM on Render's 512MB instances)
const videoUpload = multer({
  storage: multer.diskStorage({
    destination: '/tmp',
    filename: (req, file, cb) => cb(null, `${randomUUID()}${path.extname(file.originalname)}`)
  }),
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB
  fileFilter: (req, file, cb) => {
    const allowed = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo']
    cb(null, allowed.includes(file.mimetype))
  }
})
```

**Critical:** Video MUST go to disk (`/tmp`), not memory. A 200MB video in memory on a 512MB Render instance will OOM immediately.

### Frontend: Axios for upload progress tracking

The native Fetch API cannot track upload progress (it can only track download progress). Use **Axios**, which exposes `onUploadProgress` via XMLHttpRequest under the hood:

```javascript
import axios from 'axios'

async function uploadVideo(file, options, onUploadProgress) {
  const formData = new FormData()
  formData.append('video', file)
  formData.append('options', JSON.stringify(options))

  return axios.post('/api/process-video', formData, {
    onUploadProgress: (evt) => {
      const percent = Math.round((evt.loaded * 100) / evt.total)
      onUploadProgress(percent)
    }
  })
}
```

### Next.js frontend note

The Next.js frontend in this architecture sends files directly to the **Express backend on Render**, not through Next.js API routes. This is the correct architecture — Next.js API routes add latency and have their own body size limits (default 4MB). Files go: Browser → Render Express API directly.

If you do need to proxy through a Next.js API route (e.g., for auth), disable bodyParser and stream through busboy. But for ControlMedia (no auth), skip the proxy.

### Alternatives considered

| Library | Verdict |
|---------|---------|
| **busboy** | Lower-level, what multer is built on. More control but more code. Use if multer limits become a problem. Not needed for v1. |
| **formidable** | Good for Next.js API routes specifically. Not needed since uploads go direct to Express. |
| **express-fileupload** | Simpler API but loads entire file into memory always. Dangerous for video. Reject. |

---

## 4. Progress Reporting for Video Operations

**Recommendation: Server-Sent Events (SSE) | CONFIDENCE: HIGH**

### Why SSE, not WebSockets

Video processing is a one-way push scenario: server sends progress updates to the client, client never sends data back during processing. SSE is designed exactly for this:

- Works over standard HTTP — no protocol upgrade, no proxy issues
- Native browser `EventSource` API with **automatic reconnection**
- Simpler server code: just `res.write('data: ...\n\n')`
- Works on Render without special configuration
- No extra libraries needed

WebSockets are correct for bidirectional real-time apps (chat, games). For a progress bar, WebSockets are overengineered and harder to scale.

**Polling** is a fallback if SSE is problematic, but SSE is strictly better here — less latency, no wasted requests.

### Architecture

The frontend sends two separate HTTP requests:
1. `POST /api/process` — uploads file + options, gets back a `jobId`
2. `GET /api/progress/:jobId` — opens SSE stream, receives progress events

```javascript
// Express: SSE progress endpoint
app.get('/api/progress/:jobId', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')

  const interval = setInterval(() => {
    const progress = jobStore.get(req.params.jobId)
    if (!progress) return
    res.write(`data: ${JSON.stringify(progress)}\n\n`)
    if (progress.status === 'done' || progress.status === 'error') {
      clearInterval(interval)
      res.end()
    }
  }, 500)

  req.on('close', () => clearInterval(interval))
})
```

```javascript
// React: consuming SSE
useEffect(() => {
  const es = new EventSource(`/api/progress/${jobId}`)
  es.onmessage = (e) => {
    const { percent, status } = JSON.parse(e.data)
    setProgress(percent)
    if (status === 'done' || status === 'error') es.close()
  }
  return () => es.close()
}, [jobId])
```

### Progress data from FFmpeg

Use `-progress pipe:1` flag on the FFmpeg spawn call. Parse `out_time_ms` from stdout. Divide by total duration (obtained via `ffprobe` before processing) to get a reliable percentage. Store in a simple in-memory Map keyed by jobId.

**Note:** Since Render instances are single-process (no horizontal scaling in v1), an in-memory Map for job state is fine. If you scale to multiple instances later, replace with Redis.

---

## 5. Before/After Preview

**Recommendation: `react-compare-slider` v4.0.0 | CONFIDENCE: HIGH**

- Latest version 4.0.0 published ~1 month ago (as of May 2026). Actively maintained.
- Zero dependencies, tree-shakeable, TypeScript-native.
- Supports React components as items — works with `<img>`, `<video>`, `<canvas>`, anything.
- Draggable slider, keyboard accessible, responsive.

```bash
npm install react-compare-slider
```

```jsx
import { ReactCompareSlider, ReactCompareSliderImage } from 'react-compare-slider'

<ReactCompareSlider
  itemOne={<ReactCompareSliderImage src={originalUrl} alt="Original" />}
  itemTwo={<ReactCompareSliderImage src={processedUrl} alt="Processed" />}
/>
```

**Image preview before processing:** Use `URL.createObjectURL(file)` — no upload needed, instant client-side blob URL. Show this as the "before" preview as soon as user selects a file.

**Processed preview after download:** The backend returns the processed file. Create a second object URL from the response blob. No storage needed.

---

## 6. Render.com — FFmpeg Specifics and Constraints

**CONFIDENCE: HIGH (confirmed via official docs + community)**

### FFmpeg availability

FFmpeg is **pre-installed on all Render native runtimes**, listed in both build and deploy environments. No additional setup required when using system FFmpeg.

However, `ffmpeg-static` (recommended above) bundles its own binary, so you're independent of Render's version.

### Memory constraints — THE critical issue

This is the single most important operational constraint for ControlMedia:

| Plan | RAM | Price | Video processing verdict |
|------|-----|-------|--------------------------|
| **Free** | 512 MB (but spins down after 15 min idle) | $0 | Development only. Will OOM on large videos. |
| **Starter** | 512 MB | $7/mo | Risky for 4K+ videos. OK for 1080p and below if using disk storage. |
| **Standard** | 2 GB | $25/mo | **Recommended for production.** Handles 1080p/4K comfortably. |
| **Pro** | 4 GB | $85/mo | Heavy workloads. |

**Action required:** Configure multer to write videos to `/tmp` (disk), not memory. FFmpeg itself processes file-to-file via disk, so peak RAM is mostly codec buffers + metadata — manageable within 512MB for 1080p if you're not loading entire files into memory.

### Request timeout

Render Web Services support **up to 100-minute HTTP request timeout** — sufficient for video processing. Heroku's 30-second limit would be a showstopper; Render's is not.

**However:** The upload POST request (file upload + processing) must complete within the timeout. For a 500MB video on a slow connection, upload alone can take minutes. Architecture recommendation: accept upload quickly (respond with `jobId` immediately), process async, stream results via SSE. This avoids timeout issues entirely.

### Free tier spin-down

Free tier spins down after **15 minutes of inactivity**, with ~1 minute cold start. For a public tool this means the first user after idle gets a bad experience. Use **Starter ($7/mo) minimum** for production to eliminate spin-down.

### Ephemeral filesystem

`/tmp` is available but **cleared on every redeploy or restart**. Never assume `/tmp` files persist between requests. The ControlMedia design (process → return → delete) is correct and works within this constraint.

### Docker alternative

If system package needs arise (e.g., specific codec libraries), deploy with Docker instead of native runtime. This is the escape hatch if any binary dependency issues surface.

---

## 7. What NOT to Use (Anti-Stack)

| Technology | Why NOT |
|------------|---------|
| **fluent-ffmpeg** | Archived May 22, 2025. No longer maintained. No support for recent FFmpeg. Do not add to new projects. |
| **@ffmpeg/ffmpeg WASM (server-side)** | 5–15x slower than native. Wrong tool for server-side processing. Use native binary. |
| **Jimp** | Pure JS, 40–50x slower than Sharp, no AVIF/WebP support. No valid use case here. |
| **ImageMagick (gm/imagemagick npm)** | Requires system binary, slower than Sharp, less control. Sharp covers everything needed. |
| **express-fileupload** | Loads entire file into memory. Will OOM on 500MB video uploads. |
| **Next.js API routes for file uploads** | Default 4MB body limit, adds latency. Uploads go direct to Express backend. |
| **WebSockets for progress** | Bidirectional overhead for a one-way progress stream. SSE is simpler and sufficient. |
| **Polling for progress** | Wasteful requests, higher latency than SSE. No advantage over SSE in this context. |
| **File storage (S3, Cloudflare R2)** | Out of scope per PROJECT.md. Process-and-delete model is correct for privacy and simplicity. |
| **Vercel Functions for video processing** | Hard 300s limit (hobby) / 60s (pro by default), no persistent `/tmp` between invocations, 4.5MB payload limit. Wrong platform for video. |
| **Client-side WASM video processing** | Poor UX (slow, browser tab must stay open), no progress reporting without SharedArrayBuffer + COOP headers, 30MB+ download. |

---

## 8. Final Stack Summary

```
Frontend (Vercel)
├── Next.js 14+ (App Router)
├── react-compare-slider 4.0.0    — before/after comparison UI
├── axios                          — file upload with progress tracking
└── native EventSource API         — SSE progress consumption (no lib needed)

Backend (Render — Standard $25/mo in production)
├── Node.js 20 LTS
├── Express 4.x
├── multer 1.4.5                   — multipart upload (diskStorage for video)
├── sharp 0.34.5                   — image processing (resize, compress, convert)
├── ffmpeg-static 5.x              — bundled FFmpeg binary
├── ffprobe-static                 — FFprobe for duration/metadata
└── child_process (Node built-in)  — FFmpeg invocation + progress parsing

Processing model
├── Images: in-memory Buffer (multer memoryStorage → sharp → Buffer → res.send)
├── Videos: /tmp files (multer diskStorage → ffmpeg spawn → res.download → fs.unlink)
└── Progress: in-memory Map (jobId → state), SSE push every 500ms
```

---

## Sources

- [sharp official docs](https://sharp.pixelplumbing.com/) — confirmed format support, API, version 0.34.5 (HIGH)
- [fluent-ffmpeg GitHub (archived)](https://github.com/fluent-ffmpeg/node-fluent-ffmpeg) — archived May 22, 2025 (HIGH)
- [Render native runtimes docs](https://render.com/docs/native-runtimes) — FFmpeg pre-installed confirmed (HIGH)
- [Render community — FFmpeg memory issue](https://render.discourse.group/t/ffmpeg-in-node-js-environment-runtime-limit/23216) — 512MB RAM limit is the bottleneck (HIGH)
- [react-compare-slider npm](https://www.npmjs.com/package/react-compare-slider) — v4.0.0, actively maintained (HIGH)
- [npm-compare: fluent-ffmpeg vs ffmpeg-static](https://npm-compare.com/@ffmpeg-installer/ffmpeg,@ffmpeg/ffmpeg,ffmpeg-static,fluent-ffmpeg) — download stats, relationship (MEDIUM)
- [SSE vs WebSockets — Ably](https://ably.com/blog/websockets-vs-sse) — protocol comparison (HIGH)
- [ffmpeg-static npm](https://www.npmjs.com/package/ffmpeg-static) — FFmpeg 6.1.1 bundled (HIGH)
- [Render pricing](https://render.com/pricing) — instance types and RAM (HIGH)
- [Sharp vs Jimp comparison](https://reintech.io/blog/nodejs-image-processing-sharp-jimp-imagemagick) — performance benchmarks (MEDIUM)
- [pkgpulse FFmpeg comparison 2026](https://www.pkgpulse.com/blog/fluent-ffmpeg-vs-ffmpeg-wasm-vs-node-video-lib-video-processing-nodejs-2026) — ecosystem overview (MEDIUM)
