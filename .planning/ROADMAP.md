# Roadmap: ControlMedia

## Overview

ControlMedia is built in five vertical phases. Phase 1 establishes the Express backend with the full image processing API and all architectural patterns (upload routing, cleanup, CORS). Phase 2 delivers the complete frontend image tool against that working API. Phase 3 extends the backend with async video processing, FFmpeg, SSE progress streaming, and trim in one coherent delivery. Phase 4 delivers the frontend video tool with its two-phase progress UX. Phase 5 adds platform presets and final polish, completing v1.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Backend Core + Image API** - Express backend with full image processing: compress, resize, convert, batch ZIP, cleanup, CORS
- [ ] **Phase 2: Frontend Image Tool** - Next.js image UI with drag-drop, quality slider, before/after comparison, batch, HEIC gate
- [ ] **Phase 3: Backend Video Processing** - Async FFmpeg jobs: compress, resize, format convert, trim, SSE progress, cleanup
- [ ] **Phase 4: Frontend Video Tool** - Video upload UI with two-phase progress (uploading → processing), options panel, download
- [ ] **Phase 5: Platform Presets + Polish** - Preset selector (WhatsApp, Discord, Instagram, Web), pre-populated controls, final UX polish

## Phase Details

### Phase 1: Backend Core + Image API
**Mode:** mvp
**Goal**: The backend is deployed on Render and can receive image uploads, process them with Sharp, and return results — establishing all architectural patterns for both image and video paths
**Depends on**: Nothing (first phase)
**Requirements**: IMG-01, IMG-02, IMG-04, IMG-05, IMG-06, IMG-07, BATCH-01, BATCH-02, BATCH-03, GEN-01, GEN-02, GEN-03, GEN-04
**Success Criteria** (what must be TRUE):
  1. A browser can POST an image to the Render backend and receive a compressed/resized/converted image back as a binary response
  2. A browser can POST up to 20 images and receive a single ZIP file containing all processed results
  3. The backend responds with tamaño original, tamaño resultado, and % reducción in the response headers or body
  4. HEIC uploads are rejected at the multer layer with a clear error message before Sharp is called
  5. Uploaded files are never present on the server after the response is sent; a sweep removes any orphaned files older than 30 minutes
**Plans**: TBD

Plans:
- [x] 01-01: Express app scaffold — project init, multer, CORS regex, health endpoint, Render deploy config
- [x] 01-02: Image processing pipeline — Sharp compress/resize/convert with p-limit(3), decompression bomb guard, response with size metadata
- [x] 01-03: Batch endpoint + ZIP — archiver streaming ZIP, HEIC block, cleanup subsystem (finally blocks + setInterval sweep)

### Phase 2: Frontend Image Tool
**Mode:** mvp
**Goal**: Users can visit the site, upload images, configure processing options, see a before/after comparison, and download results — the full image workflow is usable end-to-end
**Depends on**: Phase 1
**Requirements**: IMG-01, IMG-02, IMG-03, IMG-04, IMG-05, IMG-06, IMG-07, BATCH-01, BATCH-02, BATCH-03, GEN-03
**Success Criteria** (what must be TRUE):
  1. User can drag-and-drop or click to upload one or more images (JPG, PNG, WebP, AVIF, GIF) and the app blocks HEIC with an explanatory message
  2. User can adjust quality slider and see the estimated output size update in real time before downloading
  3. User sees a before/after comparison slider overlaying the original and processed images
  4. UI displays original size, result size, and % reduction for each processed image
  5. User can upload up to 20 images and download all results as a single ZIP with one click
**Plans**: TBD
**UI hint**: yes

Plans:
- [ ] 02-01: App layout + upload zone — Next.js scaffold, Vercel deploy, drag-drop component, HEIC frontend gate, axios upload with progress
- [ ] 02-02: Image options panel + results — quality slider, resize inputs, format selector, size readout (original/result/%), download button
- [ ] 02-03: Before/after slider + batch UI — react-compare-slider integration, batch file list, batch progress counter ("12 / 20 completadas"), ZIP download

### Phase 3: Backend Video Processing
**Mode:** mvp
**Goal**: The backend can accept large video uploads, process them asynchronously with FFmpeg, stream real-time progress via SSE, and serve the result for download — trim included as a native FFmpeg flag
**Depends on**: Phase 1
**Requirements**: VID-01, VID-02, VID-03, VID-04, VID-05, VID-06, VID-07, VID-08
**Success Criteria** (what must be TRUE):
  1. User can upload a video up to 500 MB (MP4, MOV, WebM, AVI) and the backend accepts it via multer diskStorage to /tmp without loading it into memory
  2. The backend returns a jobId immediately (202) and begins async FFmpeg processing; the user can then subscribe to an SSE stream and see progress percentage update as frames are processed
  3. User can compress video (CRF control), change resolution (4K/1080p/720p/480p presets), convert format (MP4/WebM/MOV), and trim by start/end time — all in a single job
  4. When processing completes, the user can download the output file via a GET endpoint; the file is deleted from /tmp immediately after the download stream ends
  5. FFmpeg processes are killed cleanly (SIGKILL with timeout) if the client disconnects mid-job; no zombie processes accumulate
**Plans**: TBD

Plans:
- [ ] 03-01: Video upload + job system — multer diskStorage, /tmp UUID dirs, in-memory JobStore, 202 + jobId response
- [ ] 03-02: FFmpeg pipeline — child_process.spawn with ffmpeg-static, CRF compress, resolution presets, format convert, trim (-ss/-to flags), ffprobe duration for progress %
- [ ] 03-03: SSE progress + download + cleanup — SSE endpoint, progress parsing from FFmpeg stderr, GET download stream, cleanup on close/finally, zombie guard

### Phase 4: Frontend Video Tool
**Mode:** mvp
**Goal**: Users can upload a video, configure processing options, watch real-time progress through both upload and processing phases, and download the result
**Depends on**: Phase 3
**Requirements**: VID-01, VID-02, VID-03, VID-04, VID-05, VID-06, VID-07, VID-08
**Success Criteria** (what must be TRUE):
  1. User sees an upload progress bar (0–100%) while the video file is being sent to Render via axios
  2. After upload completes, the UI automatically transitions to a processing progress bar fed by SSE — user sees "Procesando… 47%" without any manual action
  3. User can configure CRF quality, output resolution preset, output format, and trim start/end time before submitting the job
  4. When processing completes, a download button appears and the user can save the output video; UI shows original size, result size, and % reduction
  5. If the user closes or navigates away mid-job, the frontend sends a cancel signal and the UI does not show stale progress state on return
**Plans**: TBD
**UI hint**: yes

Plans:
- [ ] 04-01: Video upload component — file picker (MP4/MOV/WebM/AVI, max 500 MB), axios upload with onUploadProgress, upload phase progress bar
- [ ] 04-02: Options panel — CRF slider, resolution preset selector, format selector, trim inputs (HH:MM:SS start/end)
- [ ] 04-03: Processing phase UX — EventSource SSE consumer, processing progress bar, phase transition (uploading → processing), download button + size readout on completion

### Phase 5: Platform Presets + Polish
**Mode:** mvp
**Goal**: Users can apply one-click presets for common platforms (WhatsApp, Discord, Instagram, Web) that pre-populate all controls, and the overall UX is polished and production-ready
**Depends on**: Phase 4
**Requirements**: PRE-01, PRE-02, PRE-03, PRE-04, PRE-05, PRE-06
**Success Criteria** (what must be TRUE):
  1. User can select a preset (Web Optimized, WhatsApp, Discord, Instagram Feed, Instagram Reel) and all relevant controls (format, quality, resolution, dimensions) are immediately pre-populated with the correct platform specs
  2. After selecting a preset, the user can freely edit any individual control without the preset resetting — presets are a starting point, not a lock
  3. Image presets and video presets are surfaced in their respective tools and map to correct backend parameters when the job is submitted
  4. The app is publicly accessible without login, loads within 3 seconds on a standard connection, and has no broken states or unhandled errors visible to the user
**Plans**: TBD
**UI hint**: yes

Plans:
- [ ] 05-01: Preset data layer — preset definitions object (all 6 presets with image + video params), preset selector UI component, control pre-population logic
- [ ] 05-02: Integration + polish — wire presets to both image and video tools, error boundaries, loading states, empty states, final UX review

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Backend Core + Image API | 3/3 | Complete | 2026-05-22 |
| 2. Frontend Image Tool | 0/3 | Not started | - |
| 3. Backend Video Processing | 0/3 | Not started | - |
| 4. Frontend Video Tool | 0/3 | Not started | - |
| 5. Platform Presets + Polish | 0/2 | Not started | - |
