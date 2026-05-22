# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-22)

**Core value:** Reducir el tamaño de imágenes y videos en segundos, con presets para los casos más comunes (web, WhatsApp, Discord) y sin fricción de instalación
**Current focus:** Phase 1 — Backend Core + Image API

## Current Position

Phase: 1 of 5 (Backend Core + Image API)
Plan: 0 of 3 in current phase
Status: Ready to plan
Last activity: 2026-05-22 — Roadmap created, requirements mapped, STATE initialized

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity:**
- Total plans completed: 0
- Average duration: —
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**
- Last 5 plans: —
- Trend: —

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
Stopped at: Phase 1 context gathered — ready to plan Phase 1
Resume file: .planning/phases/01-backend-core-image-api/01-CONTEXT.md
