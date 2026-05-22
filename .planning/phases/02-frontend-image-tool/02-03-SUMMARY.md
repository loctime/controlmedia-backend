---
phase: 2
plan: "03"
subsystem: frontend
tags: [nextjs, react, tailwind, vitest, react-compare-slider, batch-upload, zip-download, before-after-slider, mode-toggle]
dependency_graph:
  requires: [02-01-SUMMARY, 02-02-SUMMARY]
  provides: [BeforeAfterSlider, BatchImageTool, BatchFileList, useBatchProcessor, ModeToggle]
  affects: []
tech_stack:
  added: []
  patterns:
    - react-compare-slider 4.x ReactCompareSlider with objectFit contain for aspect-ratio safe comparison
    - useBatchProcessor: setState callback pattern for async FormData POST with onUploadProgress
    - Dual-phase progress: upload % then 'Procesando N imágenes…' before ZIP arrives
    - Defense-in-depth file cap: react-dropzone maxFiles=20 + useBatchProcessor.addFiles cap + backend multer
    - extensionFromContentType extended to map application/zip -> 'zip' via startsWith guard
    - Mode toggle via useState<'single'|'batch'> in page component (client component, no metadata)
key_files:
  created:
    - controlmedia-frontend/components/BeforeAfterSlider.tsx
    - controlmedia-frontend/components/BatchFileList.tsx
    - controlmedia-frontend/components/BatchImageTool.tsx
    - controlmedia-frontend/hooks/useBatchProcessor.ts
    - controlmedia-frontend/tests/BeforeAfterSlider.test.tsx
    - controlmedia-frontend/tests/BatchFileList.test.tsx
    - controlmedia-frontend/tests/useBatchProcessor.test.tsx
  modified:
    - controlmedia-frontend/components/SingleImageTool.tsx
    - controlmedia-frontend/lib/format.ts
    - controlmedia-frontend/types/image.ts
    - controlmedia-frontend/app/image-tool/page.tsx
decisions:
  - "BeforeAfterSlider replaces side-by-side preview in SingleImageTool complete state; original img shown while uploading/processing to avoid empty screen"
  - "BatchImageTool shows 'Descargar ZIP' label alongside DownloadButton (which already renders 'Descargar') for visual clarity"
  - "page.tsx made 'use client' with no metadata export — Next.js client components cannot export metadata; layout.tsx already handles app-wide title"
  - "processAll uses nested setBatch callbacks to safely read current files before dispatching async POST"
metrics:
  duration: "18 min"
  completed_date: "2026-05-22"
  tasks_completed: 2
  files_created: 7
  tests_passing: 39
---

# Phase 2 Plan 03: Before/after slider + batch UI with ZIP download Summary

**One-liner:** react-compare-slider before/after overlay integrated into SingleImageTool, plus a full batch mode (DropZone + BatchFileList + ImageOptionsPanel + upload progress + ZIP download) behind a Mode toggle on /image-tool — completing Phase 2.

## What Was Built

Final vertical slice of Phase 2, delivering the last four requirements (IMG-03, BATCH-01, BATCH-02, BATCH-03):

- **BeforeAfterSlider:** `"use client"` wrapper around `ReactCompareSlider` from react-compare-slider 4.x. Props: `originalUrl | null` and `processedUrl | null`. Returns null if either is absent. Renders with `objectFit: 'contain'` on both images and `defaultPosition={50}` so the handle starts centered. Wrapped in a `max-h-[600px]` container to prevent layout overflow on mobile.

- **SingleImageTool update:** The side-by-side `<img>` layout from 02-02 is replaced with `<BeforeAfterSlider>` in the `status === 'complete'` branch. A heading "Comparación antes / después" appears above the slider. While uploading/processing, the original image is shown alone.

- **extensionFromContentType extension:** Added `.startsWith('application/zip')` guard before the switch, returning `'zip'`. This enables `DownloadButton` to save batch results as `optimized.zip`.

- **BatchJob type:** Added to `types/image.ts` — `{ files, status, uploadProgress, zipBlob, error }` with status union including `'processing'` phase.

- **useBatchProcessor:** Hook managing batch state. `addFiles` caps total at 20 using a `remaining = 20 - prev.files.length` slice; dropped extras surface `error = 'Máximo 20 archivos. Los archivos excedentes fueron ignorados.'`. `removeFile` filters first match by name. `processAll` builds `FormData` with `files.forEach(f => form.append('files', f))` plus conditional quality/format/width/height, POSTs to `/api/images/batch` with `responseType: 'blob'` and `onUploadProgress` tracking. Status transitions: `uploading` → `processing` when pct ≥ 100 → `complete`/`error` on response.

- **BatchFileList:** Renders file list with per-file Quitar button and summary paragraph "N archivos seleccionados — total size". Returns null when files is empty.

- **BatchImageTool:** Composes DropZone(mode='batch') + BatchFileList + ImageOptionsPanel (originalDimensions=null, aspect-ratio lock functionally inert) + "Procesar batch" button + upload progress bar + "Procesando N imágenes…" phase indicator + DownloadButton (application/zip) on completion.

- **image-tool/page.tsx:** Converted to `"use client"`. Mode toggle with Tailwind tab style renders `<SingleImageTool />` or `<BatchImageTool />`. Page heading updated to "Optimizar imágenes".

## Tasks Completed

| Task | Phase | Name | Commit | Key Files |
|------|-------|------|--------|-----------|
| 1 | RED | Failing tests for BeforeAfterSlider | 9d657e2 | tests/BeforeAfterSlider.test.tsx |
| 1 | GREEN | BeforeAfterSlider + SingleImageTool + format.ts | 23beb0a | components/BeforeAfterSlider.tsx, components/SingleImageTool.tsx, lib/format.ts |
| 2 | RED | Failing tests for BatchFileList + useBatchProcessor | ad0a533 | tests/BatchFileList.test.tsx, tests/useBatchProcessor.test.tsx |
| 2 | GREEN | Full batch mode + Mode toggle | adccd46 | hooks/useBatchProcessor.ts, components/BatchFileList.tsx, components/BatchImageTool.tsx, app/image-tool/page.tsx, types/image.ts |

## Verification Results

- `npx vitest run` — 39/39 tests pass across 8 test files (DropZone, DownloadButton, ImageOptionsPanel, SizeReadout, useImageProcessor, BeforeAfterSlider, BatchFileList, useBatchProcessor)
- `npm run build` — exits 0, 3 static routes (/, /_not-found, /image-tool)
- Zero TypeScript errors
- Zero Next.js API routes (`app/api/` does not exist)
- All uploads via axios `api` instance direct to Render backend — no raw `fetch()` to `/api/images/*`

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written.

## Threat Mitigations Applied

Per the plan's threat model — all mitigations implemented:

| Threat | Mitigation Applied |
|--------|-------------------|
| T-02-03-01: Unbounded file selection (DoS) | react-dropzone maxFiles=20 (DropZone mode='batch') + useBatchProcessor.addFiles cap at 20 + backend multer array limit |
| T-02-03-02: HEIC in batch (Tampering) | DropZone heicValidator rejects HEIC by type AND name for both modes; useBatchProcessor surfaces 400 response with HEIC hint in Spanish |
| T-02-03-03: ZIP filename from Content-Type (Info Disclosure) | extensionFromContentType whitelists 'application/zip' -> 'zip'; unknowns fall back to 'bin' |
| T-02-03-04: Object URL leak from zipBlob (DoS) | DownloadButton creates object URL at click time and revokes immediately after click |
| T-02-03-05: Progress >100% (Spoofing) | uploadProgress = Math.round(...* 100); status transitions to 'processing' once pct >= 100 |
| T-02-03-06: react-compare-slider event listener leak (DoS) | Accepted — library handles cleanup on unmount |
| T-02-03-SC: No new npm packages | Confirmed — zero new dependencies added |

## Phase 2 Completion Status

All 5 Phase 2 roadmap criteria are now satisfied:

1. **IMG-01 / GEN-03** — Drag-and-drop for JPG/PNG/WebP/AVIF/GIF; HEIC blocked in both single and batch modes (02-01 DropZone, extended to batch here)
2. **IMG-02 / IMG-07** — Quality slider + server size readout (02-02 ImageOptionsPanel + SizeReadout)
3. **IMG-03** — Before/after comparison slider with draggable handle at 50% (this plan, Task 1)
4. **IMG-07** — Original/result/% reduction shown in single mode (02-02 SizeReadout)
5. **BATCH-01 / BATCH-02 / BATCH-03** — Up to 20 images, upload-progress + processing phase indicator, ZIP download (this plan, Task 2)

## Known Stubs

None — all features fully wired. BatchImageTool POSTs real FormData to the live backend endpoint, receives a real ZIP blob, and DownloadButton triggers a real file download.

## Threat Flags

None — no new network surfaces beyond what was in the plan's threat model. The only new endpoint consumed is `/api/images/batch` which was already designed in Phase 1 (backend).

## Self-Check: PASSED

All created files confirmed present:
- controlmedia-frontend/components/BeforeAfterSlider.tsx: FOUND
- controlmedia-frontend/components/BatchFileList.tsx: FOUND
- controlmedia-frontend/components/BatchImageTool.tsx: FOUND
- controlmedia-frontend/hooks/useBatchProcessor.ts: FOUND
- controlmedia-frontend/tests/BeforeAfterSlider.test.tsx: FOUND
- controlmedia-frontend/tests/BatchFileList.test.tsx: FOUND
- controlmedia-frontend/tests/useBatchProcessor.test.tsx: FOUND

Modified files confirmed present:
- controlmedia-frontend/components/SingleImageTool.tsx: FOUND
- controlmedia-frontend/lib/format.ts: FOUND
- controlmedia-frontend/types/image.ts: FOUND
- controlmedia-frontend/app/image-tool/page.tsx: FOUND

All commits present:
- 9d657e2: test(02-03): add failing tests for BeforeAfterSlider
- 23beb0a: feat(02-03): BeforeAfterSlider + integrate into SingleImageTool + zip extension
- ad0a533: test(02-03): add failing tests for BatchFileList and useBatchProcessor
- adccd46: feat(02-03): batch mode — useBatchProcessor + BatchFileList + BatchImageTool + Mode toggle
