---
phase: 01-backend-core-image-api
plan: "01"
subsystem: api
tags: [express, cors, multer, sharp, cleanup, render, node]

requires: []

provides:
  - Express 5.x app with correct middleware order (CORS first, error handler last)
  - CORS middleware with regex origin function covering localhost:3000 + controlmedia-*.vercel.app
  - multer memoryStorage config with HEIC dual-check fileFilter, 20MB limit
  - imageUpload (single) and imageUploadArray (batch, up to 20 files) exports
  - GET /health returning 200 {status:ok} for Render health checks
  - cleanup sweep stub (jobStore Map + startCleanupSweep setInterval) ready for Phase 3
  - render.yaml deploy config with healthCheckPath:/health and NODE_VERSION:20
  - package.json ESM (type:module), engines node>=20, 7 pinned dependencies

affects:
  - 01-02-PLAN (image routes mount imageUpload/imageUploadArray from upload.js)
  - 01-03-PLAN (batch ZIP routes use same middleware stack)
  - Phase 3 (cleanup.js jobStore populated by video routes)

tech-stack:
  added:
    - express@5.2.1
    - sharp@0.34.5
    - multer@2.1.1
    - archiver@8.0.0
    - p-limit@7.3.0
    - cors@2.8.6
    - dotenv@^16.0.0
  patterns:
    - CORS-first middleware ordering (prevents CORS-masked error responses)
    - Dual HEIC detection (MIME type + file extension) in multer fileFilter
    - Consistent error shape {error: CODE, message: string} across all 4xx/5xx
    - sharp.concurrency(1) + sharp.cache(false) set at module load in upload.js
    - jobStore Map + setInterval cleanup sweep pattern for Phase 3 video jobs

key-files:
  created:
    - src/index.js
    - src/middleware/cors.js
    - src/middleware/upload.js
    - src/middleware/errorHandler.js
    - src/routes/health.js
    - src/utils/cleanup.js
    - render.yaml
    - package.json
    - .gitignore
    - .env.example
  modified: []

key-decisions:
  - "errorHandler extracted to src/middleware/errorHandler.js (not inline in index.js) for clarity and reuse in later plans"
  - "imageUploadArray defined as multer(config).array('files', 20) directly in upload.js export (not as middleware builder) for simplicity"
  - "sharp.concurrency(1) + sharp.cache(false) placed in upload.js at module load — runs once per process, not per request"

patterns-established:
  - "Middleware order: corsMiddleware → express.json() → routes → errorHandler"
  - "HEIC fileFilter: check BLOCKED_MIME_TYPES set AND /\\.(heic|heif)$/i on originalname"
  - "Error shape: { error: 'ERROR_CODE', message: 'human-readable string' }"
  - "Cleanup pattern: jobStore Map + startCleanupSweep() called at app boot"

requirements-completed:
  - GEN-01
  - GEN-02
  - GEN-04

duration: 15min
completed: 2026-05-22
---

# Phase 1 Plan 01: Express App Scaffold Summary

**Express 5.x backend scaffold with CORS regex middleware, multer HEIC-blocking upload config, health endpoint at GET /health, and Render deploy config — all middleware patterns established in correct order**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-05-22T00:00:00Z
- **Completed:** 2026-05-22
- **Tasks:** 2
- **Files created:** 10

## Accomplishments

- Express 5.x app initialized with ESM (type:module), Node >=20, all 7 dependencies at pinned versions
- CORS middleware with origin function accepting localhost:3000, regex for `controlmedia-*.vercel.app`, and optional ALLOWED_ORIGIN env var — rejecting all other origins
- multer memoryStorage with dual HEIC detection (MIME + extension), 20MB per-file limit, consistent error codes
- GET /health returns 200 `{"status":"ok"}` — verified against Render health check requirements
- Cleanup sweep stub (empty jobStore Map + setInterval) started at boot, ready for Phase 3 video job cleanup
- render.yaml with healthCheckPath:/health, startCommand, and NODE_VERSION:20

## Task Commits

1. **Task 1: Project init and package.json** - `413bb99` (chore)
2. **Task 2: CORS middleware, multer config, cleanup stub, health route, Express app** - `255ba52` (feat)

**Plan metadata:** (committed with SUMMARY + STATE updates)

## Files Created

- `package.json` - ESM, engines node>=20, 7 pinned deps, start/dev scripts
- `.gitignore` - node_modules, .env, logs, .DS_Store, /tmp
- `.env.example` - PORT, ALLOWED_ORIGIN, NODE_ENV
- `package-lock.json` - 132 packages, 0 vulnerabilities
- `src/index.js` - Express app with correct middleware order + port listen
- `src/middleware/cors.js` - CORS origin fn with regex for Vercel preview URLs
- `src/middleware/upload.js` - multer config; exports imageUpload + imageUploadArray
- `src/middleware/errorHandler.js` - 4-arg Express error handler, consistent {error,message} shape
- `src/routes/health.js` - GET / → 200 {status:ok}
- `src/utils/cleanup.js` - jobStore Map + startCleanupSweep setInterval stub
- `render.yaml` - Render web service config

## Decisions Made

- `errorHandler` extracted to its own file (`src/middleware/errorHandler.js`) rather than inline in index.js — cleaner for future plans that may import it directly
- `imageUploadArray` exported as `multer(config).array('files', 20)` directly (not as a factory) — simpler for the batch route to consume in Plan 02
- `sharp.concurrency(1)` and `sharp.cache(false)` placed in `upload.js` at module load time — ensures they run once per process startup regardless of which route imports upload.js first

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required for this scaffold plan. Render deploy will need `ALLOWED_ORIGIN` set in the dashboard (marked `sync: false` in render.yaml).

## Next Phase Readiness

- Plan 01-02 (single image process route) can immediately import `imageUpload` from `src/middleware/upload.js` and mount on the Express app
- Plan 01-03 (batch ZIP route) can import `imageUploadArray`
- Phase 3 (video) can import `jobStore` from `src/utils/cleanup.js` and populate it; the sweep is already running
- No blockers for Plan 01-02

---
*Phase: 01-backend-core-image-api*
*Completed: 2026-05-22*
