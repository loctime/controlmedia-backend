# Domain Pitfalls — ControlMedia

**Domain:** Image/video optimization web app (Next.js + Express + Sharp + FFmpeg)
**Researched:** 2026-05-22
**Overall confidence:** HIGH (most pitfalls verified via official docs, GitHub issues, and multiple sources)

---

## Critical Pitfalls

Mistakes that cause server crashes, rewrites, or unrecoverable prod incidents.

---

### Pitfall 1: Vercel 4.5 MB Body Limit Kills the Entire Upload Strategy

**What goes wrong:**
If the frontend sends files through a Next.js API route (e.g., as a proxy), Vercel hard-limits the request body to 4.5 MB. Any image or video larger than that returns `413 FUNCTION_PAYLOAD_TOO_LARGE`. This is a platform-level limit that cannot be raised. Files get rejected silently or with a confusing error.

**Why it happens:**
Developers default to building a Next.js API route as the upload endpoint because it feels convenient. They test locally — no limit there — and only hit the wall in production.

**Consequences:**
- Images above 4.5 MB (common for DSLR shots, RAW files) fail completely
- All video uploads fail (even a short 720p clip is 20–100 MB)
- The entire backend integration breaks and requires architectural rethink

**Prevention:**
Upload files directly from the browser to the Render backend via `fetch`/`XHR` against `https://api.yourdomain.com/upload`. Never route file bytes through a Next.js API route. The frontend is only responsible for the UI — the file transfer goes browser → Render backend, bypassing Vercel entirely.

**Detection warning signs:**
- `413` errors in browser console only in production, not locally
- Works for small test images, fails for real user files
- The error message mentions `FUNCTION_PAYLOAD_TOO_LARGE`

**Phase that must address this:** Phase 1 (core upload/processing foundation). Must be the architecture decision from day one, not a retrofit.

**Source:** [Vercel FUNCTION_PAYLOAD_TOO_LARGE docs](https://vercel.com/docs/errors/FUNCTION_PAYLOAD_TOO_LARGE), [Vercel Limits](https://vercel.com/docs/limits)

---

### Pitfall 2: FFmpeg Zombie Processes on Crash or Timeout

**What goes wrong:**
When a video processing request times out, the client disconnects, or Node.js crashes, the spawned FFmpeg child process keeps running as an orphan. On a shared Render instance this silently consumes CPU and RAM. Enough zombies and the service gets OOM-killed.

**Why it happens:**
`child.kill()` on Linux sends SIGTERM but the process is not reaped from memory until the parent calls `wait()`. If the parent process has already exited or the error path doesn't call kill, the child keeps running.

**Consequences:**
- CPU/RAM spiral until the service restarts
- Render free tier gets killed under load
- `/tmp` fills up with partial output files

**Prevention:**
```js
// Every ffmpeg spawn must be wrapped
const ffmpegProc = spawn('ffmpeg', args);
const timeout = setTimeout(() => {
  ffmpegProc.kill('SIGKILL');
  reject(new Error('FFmpeg timeout'));
}, MAX_DURATION_MS);

ffmpegProc.on('close', (code) => {
  clearTimeout(timeout);
  // cleanup /tmp files here
});

req.on('close', () => {           // client disconnected
  ffmpegProc.kill('SIGKILL');
});
```
Keep a global `Set` of active PIDs. On `process.exit` / `SIGTERM`, iterate and kill all. Use `fluent-ffmpeg` which handles most of this, but still add client-disconnect cleanup.

**Detection warning signs:**
- `ps aux | grep ffmpeg` on the server shows many processes
- Memory grows monotonically between restarts
- `/tmp` fills up

**Phase that must address this:** Phase 1 (video processing MVP). Do not leave for later — zombies compound.

**Source:** [Node.js orphaned process cleanup — Medium](https://medium.com/@arunangshudas/5-tips-for-cleaning-orphaned-node-js-processes-196ceaa6d85e), [nodejs/help #1389](https://github.com/nodejs/help/issues/1389)

---

### Pitfall 3: Sharp Concurrent Processing Memory Spikes Crash the Process

**What goes wrong:**
Using `Promise.all()` to process a batch of images in parallel causes libvips (Sharp's C++ backend) to allocate memory for all images simultaneously. On a batch of 20 × 5 MB images, peak RSS can spike 10–20x the individual cost. Node.js gets OOM-killed. The problem looks like a memory leak but is actually memory fragmentation from multithreaded allocations that the OS cannot reclaim.

**Why it happens:**
Sharp is highly multi-threaded via libvips. Parallel `Promise.all()` launches all threads simultaneously, fragmenting the allocator. The default glibc malloc on Linux is not designed for this pattern.

**Consequences:**
- OOM crash under batch load with no useful error message
- Works fine in dev (fewer cores, smaller test files)
- Crashes silently; users get hung requests

**Prevention:**
Process batches with a concurrency cap — never raw `Promise.all()`:
```js
import pLimit from 'p-limit';
const limit = pLimit(3); // max 3 concurrent sharp ops
const results = await Promise.all(files.map(f => limit(() => processImage(f))));
```
For production stability, consider using jemalloc (`LD_PRELOAD=/usr/lib/x86_64-linux-gnu/libjemalloc.so`) as the allocator — the Sharp maintainers explicitly recommend it for multi-image workloads.

**Detection warning signs:**
- Memory grows per batch but doesn't drop between requests
- Crashes under batch load, not single-file requests
- `sharp.concurrency()` logs show > available cores

**Phase that must address this:** Phase 1 (batch image feature). Set concurrency limit from the first batch implementation.

**Source:** [context.dev Sharp memory guide](https://www.context.dev/blog/preventing-memory-issues-in-node-js-sharp-a-journey), [sharp #1041](https://github.com/lovell/sharp/issues/1041), [sharp #138](https://github.com/lovell/sharp/issues/138)

---

### Pitfall 4: Render /tmp Hard Cap at 2 GB Kills Large Video Jobs

**What goes wrong:**
Render's ephemeral `/tmp` filesystem is capped at 2 GB across all plans (including paid). FFmpeg writes intermediate files during transcoding — for a 500 MB source video being transcoded to WebM, the intermediate + output can exceed this cap. The service is killed with `Evicted. Size of temporary storage volume /tmp exceeded the limit of 2GB`.

**Why it happens:**
FFmpeg's two-pass encoding and some codec pipelines create multiple intermediate files. If a previous job's cleanup failed (due to a crash — see Pitfall 2), residual files accumulate and the next job finds no space.

**Consequences:**
- Service eviction mid-request
- All in-flight requests fail
- No persistent disk on free tier means no alternative

**Prevention:**
- Set input file size limit to 200–300 MB for video (not 500 MB as originally planned) until tested on paid plan
- Write all temp files to a job-specific subdirectory: `/tmp/jobs/<uuid>/`
- Always clean up in `finally` blocks, not just on success:
  ```js
  const jobDir = `/tmp/jobs/${uuid}`;
  try {
    await fs.mkdir(jobDir, { recursive: true });
    // ... processing ...
  } finally {
    await fs.rm(jobDir, { recursive: true, force: true });
  }
  ```
- Implement a startup sweep: delete any `/tmp/jobs/*` older than 10 minutes on process start

**Detection warning signs:**
- `ENOSPC: no space left on device` errors in logs
- Service restarts under concurrent video load
- `/tmp` size grows monotonically in metrics

**Phase that must address this:** Phase 1 (video feature). Define cleanup contract before writing any FFmpeg code.

**Source:** [Render community /tmp limit](https://community.render.com/t/increase-2gb-tmp-limit/22587), [Render maximum temporary storage](https://community.render.com/t/maximum-temporary-storage-for-service/4015)

---

### Pitfall 5: HEIC Files Fail Silently on Render — Sharp Prebuilts Have No HEIC Decoder

**What goes wrong:**
iPhone and modern Android cameras default to HEIC format. Users upload `.heic` files expecting conversion to JPEG/WebP. Sharp's prebuilt npm binary does NOT include libheif (omitted due to patent licensing on HEVC). The file either fails with a cryptic error or Sharp tries to process it as a generic buffer and produces garbage.

**Why it happens:**
HEIC relies on HEVC/H.265 compression, which is patent-encumbered. The Sharp maintainers deliberately exclude it from prebuilt binaries. Support requires compiling libvips from source with libheif + libde265 + x265 — which is not available in Render's stock Node.js environment.

**Consequences:**
- iPhone users (a majority of mobile users) cannot upload their photos
- Error messages are unhelpful (`Input file has an unsupported format`)
- The fix requires Docker/custom build environment, not a simple npm install

**Prevention:**
Option A (recommended for v1): Detect HEIC on the frontend by checking magic bytes or extension, show a clear message: "HEIC not yet supported — please convert in Photos app first." Block the upload before it reaches the server.

Option B (v2): Use `heic-convert` npm package as a pre-processing step before handing to Sharp. It uses a pure-JS/WASM decoder and does not require system libraries.

**Detection warning signs:**
- `Input file contains unsupported image format` errors for `.heic` files
- Works for JPG/PNG/WebP, fails specifically for iPhone photos

**Phase that must address this:** Phase 1 (image processing). Explicit format allow-list must be in the upload validator from day one.

**Source:** [Sharp HEIC on AWS Lambda](https://obviy.us/blog/sharp-heic-on-aws-lambda/), [sharp #3816](https://github.com/lovell/sharp/issues/3816), [sharp #4132](https://github.com/lovell/sharp/issues/4132)

---

## Moderate Pitfalls

Mistakes that cause bad UX or rework, but not full crashes.

---

### Pitfall 6: Render Free Tier Cold Starts — 30–60 Second Wait on First Request

**What goes wrong:**
Render free tier services spin down after 15 minutes of inactivity. The first request after inactivity waits 30–60 seconds for the service to boot. For a tool where the user expects to upload and process in seconds, this is catastrophic first-impression UX. The browser may even time out the upload request.

**Prevention:**
- Implement a `/health` ping from the frontend: on page load, silently hit `GET /health` on the backend. This warms the service before the user hits Upload. Show a subtle "Connecting..." indicator.
- Use an external uptime monitor (UptimeRobot free tier, cron-job.org) to ping `/health` every 10–14 minutes, preventing sleep entirely.
- Document in phase planning that the Render Starter ($7/mo) eliminates cold starts — budget this when the tool gets real traffic.

**Detection warning signs:**
- First upload of the day takes 1+ minute
- Subsequent requests are fast

**Phase that must address this:** Phase 1 (deployment). Add the keepalive ping before first public launch.

**Source:** [Render cold start guide](https://blog.samkiel.dev/your-render-free-tier-is-not-broken-its-just-cold), [Understanding Render latency — Medium](https://medium.com/@python-javascript-php-html-css/understanding-latency-in-free-backend-hosting-on-render-com-d1ce9c2571de)

---

### Pitfall 7: CORS Breaks in Production Because Preview URLs Are Not Whitelisted

**What goes wrong:**
Vercel generates multiple preview deployment URLs (e.g., `controlmedia-abc123-loctime.vercel.app`). The Express backend's CORS `origin` is hardcoded to `https://controlmedia.vercel.app`. Preview deploys hit the backend and get `403 CORS policy blocked`. Development also breaks unless `localhost:3000` is explicitly listed.

**Prevention:**
Configure CORS with an origin function, not a static string:
```js
const ALLOWED_ORIGINS = [
  'https://controlmedia.vercel.app',
  /https:\/\/controlmedia-.*\.vercel\.app$/,  // preview URLs
  'http://localhost:3000',
];

cors({
  origin: (origin, cb) => {
    if (!origin || ALLOWED_ORIGINS.some(o =>
      o instanceof RegExp ? o.test(origin) : o === origin
    )) {
      cb(null, true);
    } else {
      cb(new Error('Not allowed by CORS'));
    }
  }
})
```
Also: CORS headers MUST be sent on error responses (4xx/5xx), not just successes. A middleware error that returns 500 before the CORS header is set will confuse the browser into reporting a CORS error instead of the actual error.

**Detection warning signs:**
- "Access-Control-Allow-Origin" errors in preview deploy console
- Works on production URL, fails on `vercel.app` preview links
- Error responses from backend show as CORS errors in browser

**Phase that must address this:** Phase 1 (backend setup). Configure regex-based CORS origin from the start.

**Source:** [CORS issues Vercel/EC2 community](https://community.webshinetech.com/t/cors-issues-when-connecting-next-js-frontend-hosted-on-vercel-to-express-backend-on-aws-ec2/3822)

---

### Pitfall 8: VP9/WebM Encoding Is 12–16x Slower Than H.264 — Users Will Think It's Broken

**What goes wrong:**
A user requests MP4 → WebM conversion. VP9 encoding at default settings takes 12–16x longer than equivalent H.264. A 60-second 1080p clip that encodes in 30s with H.264 takes 6–8 minutes with VP9. The user sees a frozen progress bar and abandons the page.

**Why it happens:**
VP9 default speed setting (`-deadline good -cpu-used 0`) optimizes for quality over speed. libvpx-vp9 is also poorly multi-threaded by default (uses ~4 cores regardless of availability).

**Prevention:**
For a web tool, always use fast VP9 settings:
```
-c:v libvpx-vp9 -deadline realtime -cpu-used 4 -row-mt 1
```
Set quality/speed presets that favor speed over compression efficiency. Document this tradeoff to users: "WebM (fast, good quality)" not "WebM (best compression)".
For H.264 (MP4 output): use `-preset fast` or `-preset veryfast` — still excellent quality, 3-5x faster encode.

**Detection warning signs:**
- WebM conversions take minutes even for short clips
- Progress feedback stalls

**Phase that must address this:** Phase 2 (video processing). Hardcode sensible speed presets before exposing to users.

**Source:** [VP9 encoding speed FFmpeg — Streaming Learning Center](https://streaminglearningcenter.com/blogs/encoding-vp9-in-ffmpeg-an-update.html), [VP9 5x slower — Blender T95743](https://developer.blender.org/T95743)

---

### Pitfall 9: File Upload Size Limits Exist at Multiple Independent Layers

**What goes wrong:**
You configure `multer({ limits: { fileSize: 500 * 1024 * 1024 } })` in Express. User uploads a 300 MB video and gets a `413`. Why? Because Express's default JSON body parser, nginx (if present), or the platform proxy also imposes its own limit. Each layer is independent and each has a different default.

**The layers (each can block independently):**
| Layer | Default Limit | How to Change |
|-------|---------------|---------------|
| Browser `fetch` | None | N/A |
| Vercel (if used as proxy) | 4.5 MB | Cannot raise — bypass entirely |
| Render reverse proxy | 100 MB (nginx default) | Platform-managed |
| Express `body-parser` | 100 KB for JSON | `bodyParser.json({ limit: '1mb' })` |
| Multer | No default limit (unsafe!) | `limits: { fileSize: X }` |
| Node.js HTTP server | No hard limit | N/A |

**Prevention:**
- Upload direct to Render (bypasses Vercel limit)
- Set explicit multer `fileSize` limit (not default)
- Set explicit `body-parser` limit for JSON routes
- Test with a file just under and just over each limit
- Return clear error messages with the limit value: "File too large. Maximum video size is 200 MB."

**Detection warning signs:**
- `413 Request Entity Too Large` with no explanation
- Limit feels inconsistent (works for some file sizes, not others)
- Different error messages depending on which layer rejects

**Phase that must address this:** Phase 1. Document all layer limits in a config file before writing upload routes.

**Source:** [Better Stack: Fix Request Entity Too Large](https://betterstack.com/community/questions/fix-request-entity-too-large/), [multer #562](https://github.com/expressjs/multer/issues/562)

---

### Pitfall 10: Decompression Bomb — 1 MB PNG That Decodes to 4 GB

**What goes wrong:**
A valid `.png` or `.tiff` file with tiny compressed size can declare enormous dimensions (e.g., 100000 × 100000 pixels). Sharp/libvips will attempt to allocate memory for the full uncompressed bitmap. A single such file can exhaust all available RAM on the instance and kill the process.

**Why it happens:**
Image compression is highly effective — a white 50000×50000 image can compress to under 100 KB. The file passes MIME type checks. Sharp begins decoding and allocates ~7.5 GB for the raw pixels.

**Prevention:**
Use Sharp's built-in pixel limit — check dimensions before processing:
```js
const meta = await sharp(inputBuffer).metadata();
if (meta.width * meta.height > 25_000_000) {  // 25 megapixels max
  throw new Error('Image dimensions too large');
}
```
Also limit input buffer size before even passing to Sharp (multer fileSize limit helps here, but is not sufficient alone since a compressed file can be small).

**Detection warning signs:**
- Process OOM-killed immediately after receiving a specific file
- Memory spike is instantaneous, not gradual

**Phase that must address this:** Phase 1 (image processing). Add dimension check as the first operation in the image processing pipeline.

**Source:** [image-upload-exploits repo](https://github.com/barrracud4/image-upload-exploits), [OWASP File Upload Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html)

---

### Pitfall 11: Concurrent Video Jobs Without a Queue Brings Down the Server

**What goes wrong:**
On the free/starter Render plan, the server has 1 vCPU and 512 MB–1 GB RAM. FFmpeg uses all available threads by default (`-threads 0`). Two concurrent users each uploading a 100 MB video will spawn two FFmpeg processes, each claiming all CPU. The server thrashes, response times spike to minutes, and the OOM killer terminates one or both processes.

**Prevention:**
Implement a simple in-process job queue with a concurrency limit of 1–2 for video:
```js
import PQueue from 'p-queue';
const videoQueue = new PQueue({ concurrency: 1 });
// Enqueue every ffmpeg job through this queue
```
Limit FFmpeg threads: `-threads 2` (leave headroom for Express itself).
Return `429 Too Many Requests` when queue depth exceeds a threshold (e.g., 5 pending jobs) rather than queuing indefinitely.

**Detection warning signs:**
- Response times for video increase under concurrent load
- Server memory grows during simultaneous uploads
- CPU sits at 100% and doesn't drop

**Phase that must address this:** Phase 2 (video feature). Before any public exposure, implement the queue.

**Source:** [Quora: CPU/RAM requirements for FFmpeg](https://www.quora.com/What-are-the-CPU-and-RAM-requirements-to-run-FFmpeg), [jellyfin #12740](https://github.com/jellyfin/jellyfin/issues/12740)

---

## Minor Pitfalls

Irritants that degrade UX but have straightforward fixes.

---

### Pitfall 12: Fetch API Cannot Show Upload Progress — XHR Required

**What goes wrong:**
The `fetch` API does not expose upload progress events as of 2025. Developers use `fetch` for uploads, then realize there is no way to show a progress bar during the upload phase. This matters most for mobile users uploading large videos on slow connections.

**Prevention:**
Use `XMLHttpRequest` for upload requests where a progress bar is needed:
```js
const xhr = new XMLHttpRequest();
xhr.upload.addEventListener('progress', (e) => {
  if (e.lengthComputable) setProgress(e.loaded / e.total * 100);
});
xhr.open('POST', '/process');
xhr.send(formData);
```
The `fetch` API can still be used for non-upload requests (presets, health checks, etc.).

**Phase that must address this:** Phase 1 (upload UI). Decide upload transport mechanism before building the progress component.

**Source:** [JavaScript file upload patterns — Readability](https://www.readability.com/javascript-file-upload-patterns-pitfalls)

---

### Pitfall 13: Before/After Preview with Different Aspect Ratios Looks Broken

**What goes wrong:**
The original image is 4:3 and the processed output is 16:9 (after a crop or resize). The before/after slider component assumes both images have identical dimensions. One image shows letterboxed or with whitespace, making the comparison look like a bug rather than the intended result.

**Prevention:**
- Use `object-fit: contain` on both images with a fixed container size
- Show file size diff as the primary "before/after" metric for size-only operations (compress, format convert) — visual comparison only makes sense for resize/crop
- When dimensions change, clearly label both panels with their dimensions

**Phase that must address this:** Phase 1 (image preview UI). Define the comparison component contract before building it.

---

### Pitfall 14: Next.js bodyParser Corrupts Binary Data If Proxy Route Is Used

**What goes wrong:**
If a developer builds a Next.js API route that proxies the upload to Render (attempting to hide the backend URL), Next.js's default body parser pre-processes the multipart form data. By the time the data reaches the proxy logic, it's corrupted or already consumed. The backend receives an empty or malformed body.

**Prevention:**
If any Next.js API route touches file uploads, disable bodyParser:
```js
export const config = {
  api: { bodyParser: false, externalResolver: true }
};
```
Better: don't proxy at all. Upload directly browser → Render backend.

**Phase that must address this:** Phase 1. The correct architecture (direct upload to Render) sidesteps this entirely.

**Source:** [Next.js file upload proxy discussion #39957](https://github.com/vercel/next.js/discussions/39957), [Next.js #15727](https://github.com/vercel/next.js/discussions/15727)

---

### Pitfall 15: Mobile Video Upload UX — No Feedback During Long Operations

**What goes wrong:**
On mobile, uploading a 100 MB video over LTE takes 30–90 seconds. Without clear feedback, users tap Upload again, submit duplicates, or leave. Safari on iOS aggressively throttles background tabs — if the user switches apps mid-upload, the request may be killed.

**Prevention:**
- Show distinct phases: "Uploading (45%)..." → "Processing..." → "Ready to download"
- Disable the Upload button immediately on submit to prevent double-submission
- For very large videos, show an estimated time based on file size
- Warn users before they select files: "Large videos may take 1–2 minutes to process"
- Consider chunked uploads (tus protocol) for files > 50 MB as a v2 feature

**Phase that must address this:** Phase 2 (video feature). Mobile UX requirements should be part of the video feature spec.

**Source:** [Solving large file upload challenges — Medium](https://medium.com/@gokulofficial18602/key-considerations-a9a88eff81b1)

---

### Pitfall 16: AVIF Encoding in Sharp Is Extremely Slow Without libaom Tuning

**What goes wrong:**
Sharp supports AVIF output via libvips + libaom. Default AVIF encoding is extremely slow — comparable to VP9, but for still images. A 5 MB JPEG converted to AVIF at quality 80 can take 5–15 seconds per image. Batch AVIF conversion of 20 images becomes a 2–3 minute operation.

**Prevention:**
Use Sharp's AVIF effort parameter (0=fastest, 9=slowest; default is 4):
```js
sharp(input).avif({ quality: 70, effort: 2 }).toBuffer()
```
`effort: 2` is fast enough for a web tool and still produces good compression. Document this internally. For output format presets, default to WebP (fast, excellent quality/size) and only offer AVIF as an explicit "best compression" option with a speed warning.

**Phase that must address this:** Phase 1 (image formats). Set `effort: 2` in the AVIF config before any user testing.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|----------------|------------|
| Phase 1: Upload architecture | Vercel 4.5 MB body limit | Direct browser → Render uploads, never proxy through Vercel |
| Phase 1: Image processing setup | Sharp batch memory spikes | `p-limit(3)` concurrency cap from first batch implementation |
| Phase 1: Image processing setup | Decompression bomb | Dimension check before any Sharp operation |
| Phase 1: Image processing setup | HEIC upload from iPhone | Explicit format allowlist; block HEIC with clear user message |
| Phase 1: Image formats | AVIF encoding slowness | `effort: 2` in Sharp AVIF config |
| Phase 1: Backend CORS | Preview deploy URLs blocked | Regex-based CORS origin pattern |
| Phase 1: Upload UI | No fetch upload progress | Use XHR for upload transport |
| Phase 1: Deployment | Render cold start | Keepalive ping from frontend on page load |
| Phase 2: Video processing | FFmpeg zombie processes | Kill-on-timeout + kill-on-disconnect + cleanup in finally |
| Phase 2: Video processing | /tmp 2 GB cap | UUID job dirs + always-cleanup in finally block |
| Phase 2: Video processing | Concurrent FFmpeg OOM | PQueue concurrency 1 + `-threads 2` flag |
| Phase 2: Video processing | VP9 encoding speed | `-deadline realtime -cpu-used 4 -row-mt 1` preset |
| Phase 2: Video UX | Mobile progress feedback | XHR upload + phase-labeled progress (uploading/processing/done) |
| Any phase | File size limit confusion | Document all layers; multer limit + clear error messages |

---

## Sources

- [Vercel Functions Limitations](https://vercel.com/docs/functions/limitations)
- [Vercel FUNCTION_PAYLOAD_TOO_LARGE](https://vercel.com/docs/errors/FUNCTION_PAYLOAD_TOO_LARGE)
- [Sharp memory fragmentation — context.dev](https://www.context.dev/blog/preventing-memory-issues-in-node-js-sharp-a-journey)
- [Sharp GitHub Issues — memory (#1041, #138, #1803)](https://github.com/lovell/sharp/issues/1041)
- [Sharp HEIC prebuilt binary limitation (#3816)](https://github.com/lovell/sharp/issues/3816)
- [Sharp HEIC on AWS Lambda](https://obviy.us/blog/sharp-heic-on-aws-lambda/)
- [Node.js orphaned FFmpeg process cleanup](https://medium.com/@arunangshudas/5-tips-for-cleaning-orphaned-node-js-processes-196ceaa6d85e)
- [Render /tmp 2 GB limit — community thread](https://community.render.com/t/increase-2gb-tmp-limit/22587)
- [Render cold start explained](https://blog.samkiel.dev/your-render-free-tier-is-not-broken-its-just-cold)
- [VP9 encoding speed — Streaming Learning Center](https://streaminglearningcenter.com/blogs/encoding-vp9-in-ffmpeg-an-update.html)
- [OWASP File Upload Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html)
- [image-upload-exploits test vectors](https://github.com/barrracud4/image-upload-exploits)
- [Fetch API upload progress limitation](https://www.readability.com/javascript-file-upload-patterns-pitfalls)
- [Next.js API route bodyParser proxy issue](https://github.com/vercel/next.js/discussions/39957)
- [CORS mistakes with Express backends](https://community.webshinetech.com/t/cors-issues-when-connecting-next-js-frontend-hosted-on-vercel-to-express-backend-on-aws-ec2/3822)
