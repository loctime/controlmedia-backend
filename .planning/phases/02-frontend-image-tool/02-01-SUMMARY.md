---
phase: 2
plan: "01"
subsystem: frontend
tags: [nextjs, tailwind, react-dropzone, axios, vitest, upload, heic-gate]
dependency_graph:
  requires: [01-02-SUMMARY, 01-03-SUMMARY]
  provides: [controlmedia-frontend scaffold, upload vertical slice, HEIC gate, blob download]
  affects: [02-02-PLAN, 02-03-PLAN]
tech_stack:
  added:
    - next@16.2.6
    - react@19.2.4
    - react-dropzone@15.0.0
    - react-compare-slider@4.0.0
    - axios@1.16.1
    - tailwindcss@4 (@import "tailwindcss" pattern)
    - vitest@4 with jsdom + @testing-library/react
  patterns:
    - Direct browser→Render upload (no Next.js API proxy)
    - axios with onUploadProgress + responseType blob
    - URL.createObjectURL for preview and download with revokeObjectURL cleanup
    - BackendWarmup client component to wake Render free-tier on page load
    - react-dropzone validator prop for HEIC gate (name + MIME)
key_files:
  created:
    - controlmedia-frontend/package.json
    - controlmedia-frontend/lib/api.ts
    - controlmedia-frontend/lib/format.ts
    - controlmedia-frontend/types/image.ts
    - controlmedia-frontend/components/BackendWarmup.tsx
    - controlmedia-frontend/components/DropZone.tsx
    - controlmedia-frontend/components/ProgressBar.tsx
    - controlmedia-frontend/components/DownloadButton.tsx
    - controlmedia-frontend/components/SingleImageTool.tsx
    - controlmedia-frontend/hooks/useImageProcessor.ts
    - controlmedia-frontend/app/layout.tsx
    - controlmedia-frontend/app/page.tsx
    - controlmedia-frontend/app/image-tool/page.tsx
    - controlmedia-frontend/vitest.config.ts
    - controlmedia-frontend/vitest.setup.ts
    - controlmedia-frontend/tests/DropZone.test.tsx
    - controlmedia-frontend/tests/DownloadButton.test.tsx
    - controlmedia-frontend/.env.example
  modified: []
decisions:
  - "HEIC error prioritization: search all rejection errors for heic-not-supported code before falling back to first error; react-dropzone adds both a type-mismatch error AND the validator error simultaneously"
  - "vitest passWithNoTests: true added so Task 1 scaffold (no tests yet) passes npm test with exit 0"
  - "FileJob type extended with blob: Blob | null and contentType: string fields inline (not a separate ProcessResult reference) so DownloadButton receives the blob directly from hook state"
metrics:
  duration: "9 min"
  completed_date: "2026-05-22"
  tasks_completed: 2
  files_created: 17
  tests_passing: 10
---

# Phase 2 Plan 01: App layout + upload zone (single-image vertical slice) Summary

**One-liner:** Next.js 16 + Tailwind v4 frontend with direct browser→Render axios upload, HEIC gate by name+MIME, blob preview/download, BackendWarmup ping, and 10 passing Vitest tests.

## What Was Built

Full single-image vertical slice of the ControlMedia frontend:

- **Scaffold:** `controlmedia-frontend/` with Next.js 16.2.6 + React 19, Tailwind v4 (`@import "tailwindcss"`), `@tailwindcss/postcss` plugin, TypeScript, ESLint
- **Upload pipeline:** `DropZone` → `useImageProcessor` → `axios.post` direct to `${NEXT_PUBLIC_BACKEND_URL}/api/images/process` with `responseType: 'blob'` and `onUploadProgress`
- **HEIC gate:** `heicValidator` in react-dropzone rejects by `image/heic`/`image/heif` MIME and `.heic`/`.heif` extension (case-insensitive); error shown with exact Spanish message
- **Processed result:** Blob from Render stored in hook state → `URL.createObjectURL(blob)` for `<img>` preview → `DownloadButton` triggers `<a download>` + immediate `revokeObjectURL`
- **Backend warmup:** `BackendWarmup` client component fires `GET /health` silently on every page load to wake Render free-tier before first upload
- **Route:** `/image-tool` is a server component (no `"use client"`) that imports `SingleImageTool` as a client island
- **Zero API routes:** No files under `app/api/` — CLAUDE.md constraint #1 enforced

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Scaffold Next.js 16 + Tailwind v4, axios instance, env wiring, Vitest | ad9f8ec | package.json, lib/api.ts, types/image.ts, BackendWarmup.tsx, layout.tsx, vitest.config.ts |
| 2 | DropZone + useImageProcessor + SingleImageTool + DownloadButton + tests | 960b9ed | DropZone.tsx, useImageProcessor.ts, SingleImageTool.tsx, tests/ |

## Verification Results

- `npm run build` — exits 0, Compiled successfully, 3 routes (/, /_not-found, /image-tool)
- `npx vitest run` — 10/10 tests pass across tests/DropZone.test.tsx and tests/DownloadButton.test.tsx
- Zero TypeScript errors
- Zero app/api/ routes

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] HEIC error priority in DropZone**
- **Found during:** Task 2 (TDD RED phase — tests failing)
- **Issue:** react-dropzone adds both a `file-invalid-type` error AND the `validator` error to `fileRejections[0].errors` when a HEIC file with `image/heic` MIME is dropped. The `errors[0]` was the generic "File type must be one of..." message, not the Spanish HEIC message.
- **Fix:** Changed `firstError` computation to search all errors for `code === 'heic-not-supported'` first, falling back to `errors[0]` for non-HEIC rejections.
- **Files modified:** `controlmedia-frontend/components/DropZone.tsx`
- **Commit:** 960b9ed

**2. [Rule 2 - Config] Added vitest passWithNoTests**
- **Found during:** Task 1 verification (`npm test` exit code 1 with no test files)
- **Issue:** `vitest run` exits 1 when no test files found; Task 1's acceptance criteria say "0 tests is acceptable"
- **Fix:** Added `passWithNoTests: true` to vitest.config.ts
- **Files modified:** `controlmedia-frontend/vitest.config.ts`
- **Commit:** ad9f8ec

## Threat Mitigations Applied

Per the plan's threat model — all mitigations implemented:

| Threat | Mitigation Applied |
|--------|--------------------|
| T-02-01-01: HEIC tampering | `accept` map excludes HEIC + `heicValidator` covers both MIME and extension |
| T-02-01-02: XSS via file name in alert | React `{}` interpolation auto-escapes — no `dangerouslySetInnerHTML` |
| T-02-01-03: Object URL leak | `useImageProcessor` revokes in `reset()` and `useEffect` cleanup; `DownloadButton` revokes immediately post-click |
| T-02-01-04: Direct upload (accept) | Confirmed browser→Render direct; no Next.js API proxy |
| T-02-01-05: Render cold start | `BackendWarmup` fires GET /health on every page load |
| T-02-01-06: Content-Type in filename | `extensionFromContentType` whitelists 4 formats + falls back to `.bin` |

## Known Stubs

None — the plan's goal is a working vertical slice with default options (no UI for quality/format yet). The processed image preview and download are fully wired. Options panel deferred to 02-02 by plan design.

## Threat Flags

None — all new network surfaces (POST /api/images/process, GET /health) are in the plan's threat model.

## Self-Check: PASSED
