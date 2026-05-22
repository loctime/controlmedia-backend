---
phase: 01-backend-core-image-api
plan: "02"
subsystem: api
tags: [express, sharp, multer, image-processing, decompression-bomb, webp, avif]

requires:
  - phase: 01-01
    provides: Express app with CORS/multer/errorHandler scaffold; imageUpload export from upload.js

provides:
  - processImage(buffer, options) service with decompression bomb guard + Sharp pipeline
  - POST /api/images/process endpoint returning binary + X-Original-Size/X-Result-Size/X-Reduction-Pct headers
  - src/index.js updated to mount /api/images router before errorHandler
  - TDD test suite for processImage (8 tests, node:test runner)

affects:
  - 01-03-PLAN (batch route imports processImage from imageProcessor.js)
  - Phase 2 frontend (reads X-Original-Size, X-Result-Size, X-Reduction-Pct headers via response.headers.get)

tech-stack:
  added: []
  patterns:
    - TDD with node:test built-in runner (no extra framework)
    - decompression bomb guard via sharp(buffer).metadata() before pixel allocation
    - Format-specific Sharp options (mozjpeg:true for jpeg, effort:2 for avif, compressionLevel:6 for png)
    - Size metadata via response headers (not JSON wrapper) — enables binary blob response + header metadata simultaneously
    - Access-Control-Expose-Headers set alongside X-* custom headers for cross-origin frontend access

key-files:
  created:
    - src/services/imageProcessor.js
    - src/routes/images.js
    - tests/imageProcessor.test.js
  modified:
    - src/index.js

key-decisions:
  - "Metadata in response headers (X-Original-Size etc.) instead of JSON wrapper — allows frontend to URL.createObjectURL(blob) directly while still reading size stats"
  - "Access-Control-Expose-Headers set in route handler (not global CORS config) — specific to image endpoint needs"
  - "TDD with Node.js built-in test runner (node:test) — no new test framework dependency needed"

patterns-established:
  - "processImage pipeline: metadata() bomb guard → optional resize → format switch → toBuffer({ resolveWithObject: true })"
  - "Route error flow: !req.file → next(Object.assign(err, {code})) → errorHandler"
  - "Sharp AVIF always effort:2 — prevents multi-minute encodes per Pitfall 4/T-02-03"

requirements-completed:
  - IMG-01
  - IMG-02
  - IMG-04
  - IMG-05
  - IMG-06
  - IMG-07
  - GEN-02
  - GEN-03

duration: 20min
completed: 2026-05-22
---

# Phase 1 Plan 02: Image Processing Pipeline Summary

**POST /api/images/process delivering full Sharp pipeline — decompression bomb guard, resize, format conversion, quality control, and size metadata headers in a single vertical slice**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-05-22T18:00:00Z
- **Completed:** 2026-05-22T18:21:42Z
- **Tasks:** 2 (Task 1 TDD: 2 commits; Task 2: 1 commit)
- **Files created:** 3
- **Files modified:** 1

## Accomplishments

- `processImage(buffer, options)` service: decompression bomb guard (25MP limit), resize with `fit:inside`+`withoutEnlargement`, format-specific Sharp options (mozjpeg, avif effort:2), `toBuffer({ resolveWithObject: true })` returning `{ data, info, originalSize }`
- `POST /api/images/process` endpoint: multer single-file upload → processImage → binary response with `Content-Type`, `X-Original-Size`, `X-Result-Size`, `X-Reduction-Pct`, `Access-Control-Expose-Headers`
- All error cases handled: 400 MISSING_FILE, 400 INVALID_FILE_TYPE (HEIC), 413 FILE_TOO_LARGE, 422 PROCESSING_ERROR (decompression bomb), 500 unexpected
- TDD: 8 tests covering defaults, each output format, resize behavior, no-resize when omitted, bomb guard, and originalSize — all passing

## Task Commits

1. **Task 1 RED: failing tests for processImage** - `39e949a` (test)
2. **Task 1 GREEN: implement processImage service** - `552ea44` (feat)
3. **Task 2: POST /api/images/process route + index.js update** - `89c8d51` (feat)

**Plan metadata:** (committed with SUMMARY + STATE updates)

## Files Created/Modified

- `src/services/imageProcessor.js` — async processImage(buffer, options); decompression bomb guard + Sharp pipeline; exports processImage
- `src/routes/images.js` — Express Router; POST /process with imageUpload.single('file'); metadata headers; MISSING_FILE guard
- `tests/imageProcessor.test.js` — 8 node:test tests covering all processImage behaviors
- `src/index.js` — added imagesRouter import + app.use('/api/images', imagesRouter) before errorHandler

## Decisions Made

- Metadata in response headers (`X-Original-Size`, `X-Result-Size`, `X-Reduction-Pct`) rather than a JSON wrapper — allows the frontend to receive the processed image as a raw blob and call `URL.createObjectURL(blob)` directly, while still reading size reduction stats via `response.headers.get('X-Original-Size')`
- `Access-Control-Expose-Headers` set in the route handler, not the global CORS config — it's specific to image endpoints and makes the intent explicit
- Node.js built-in `node:test` runner for TDD — zero new dependencies, available in Node 18+

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## Known Stubs

None — all functionality is fully wired. processImage calls real Sharp; the route calls real processImage.

## Threat Flags

None — all threats in the plan's threat model were mitigated:
- T-02-01 (decompression bomb): metadata() check in processImage before pixel allocation
- T-02-02 (options tampering): Number() cast applied in processImage for quality/width/height
- T-02-03 (AVIF slowness DoS): effort:2 hard-coded in avif branch

## User Setup Required

None — no external service configuration required for this plan.

## Next Phase Readiness

- Plan 01-03 (batch ZIP endpoint) can immediately import `processImage` from `src/services/imageProcessor.js` and `imageUploadArray` from `src/middleware/upload.js`
- The single-image vertical slice is proven end-to-end: upload → Sharp pipeline → binary response
- No blockers for Plan 01-03

---
*Phase: 01-backend-core-image-api*
*Completed: 2026-05-22*
