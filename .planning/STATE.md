# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-22)

**Core value:** Reducir el tamaño de imágenes y videos en segundos, con presets para los casos más comunes (web, WhatsApp, Discord) y sin fricción de instalación
**Current focus:** Phase 1 — Backend Core + Image API

## Current Position

Phase: 1 of 5 (Backend Core + Image API)
Plan: 2 of 3 in current phase
Status: Executing
Last activity: 2026-05-22 — Plan 01-02 complete (Image processing pipeline)

Progress: [███░░░░░░░] 14% (2/14 plans across all phases)

## Performance Metrics

**Velocity:**
- Total plans completed: 2
- Average duration: 18 min
- Total execution time: 0.58 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| Phase 1 | 2 | 35 min | 18 min |

**Recent Trend:**
- Last 5 plans: 01-01 (15 min), 01-02 (20 min)
- Trend: stable

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Init: Backend on Render (not VPS) — FFmpeg available, free tier viable
- Init: child_process.spawn + ffmpeg-static (fluent-ffmpeg archived May 2025)
- Init: multer memoryStorage for images, diskStorage for video — RAM constraint
- Init: p-limit(3) + sharp.concurrency(1) for batch image processing
- Init: CORS via regex pattern to cover Vercel preview URLs
- Init: Video trim (VID-05) folded into Phase 3 backend — just -ss/-to FFmpeg flags, no separate phase needed
- 01-01: errorHandler extracted to src/middleware/errorHandler.js (not inline in index.js) for reuse
- 01-01: imageUploadArray exported directly as multer().array('files', 20) — simpler batch route consumption
- 01-01: sharp.concurrency(1) + sharp.cache(false) placed in upload.js at module load (not per-request)
- 01-02: Size metadata in response headers (X-Original-Size, X-Result-Size, X-Reduction-Pct) not JSON wrapper — allows binary blob response + header read simultaneously
- 01-02: Access-Control-Expose-Headers set in route handler for image endpoint specifically
- 01-02: TDD with Node.js built-in node:test runner — no new test framework dependency

### Pending Todos

None yet.

### Blockers/Concerns

- Render plan must support FFmpeg binary — verify on first deploy (Phase 1)
- /tmp 2 GB hard cap on Render — cleanup discipline critical from Phase 1
- Render free tier spins down after inactivity — consider Standard plan for video (30-120s jobs)

## Deferred Items

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| v2 | Live slider preview (client-side or fast API) | Deferred | Init |
| v2 | Video batch processing | Deferred | Init |
| v2 | Cancel job in progress | Deferred | Init |
| v2 | Strip EXIF/GPS metadata toggle | Deferred | Init |
| v2 | HEIC input (heic-convert) | Deferred | Init |

## Session Continuity

Last session: 2026-05-22
Stopped at: Plan 01-02 complete — processImage service + POST /api/images/process endpoint
Resume file: .planning/phases/01-backend-core-image-api/01-03-PLAN.md
