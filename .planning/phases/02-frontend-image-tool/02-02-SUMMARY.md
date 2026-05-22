---
phase: 2
plan: "02"
subsystem: frontend
tags: [nextjs, react, tailwind, vitest, image-options, size-readout, reprocess, aspect-ratio, format-selector]
dependency_graph:
  requires: [02-01-SUMMARY]
  provides: [ImageOptionsPanel, SizeReadout, formatBytes, reprocess()]
  affects: [02-03-PLAN]
tech_stack:
  added: []
  patterns:
    - Fully controlled options panel (lifted state, no internal option state)
    - NaN-safe header parsing via Number.isFinite guard in hook
    - Image() dimension probing in parallel with upload
    - reprocess() reuses originalFile reference from hook state (no re-pick)
    - setJob callback pattern for safe async state update in reprocess
key_files:
  created:
    - controlmedia-frontend/components/ImageOptionsPanel.tsx
    - controlmedia-frontend/components/SizeReadout.tsx
    - controlmedia-frontend/tests/ImageOptionsPanel.test.tsx
    - controlmedia-frontend/tests/SizeReadout.test.tsx
    - controlmedia-frontend/tests/useImageProcessor.test.tsx
  modified:
    - controlmedia-frontend/lib/format.ts
    - controlmedia-frontend/hooks/useImageProcessor.ts
    - controlmedia-frontend/components/SingleImageTool.tsx
    - controlmedia-frontend/types/image.ts
decisions:
  - "Re-procesar button disabled by not rendering (inside status==='complete' guard) rather than disabled prop — TypeScript narrowing made disabled={job.status==='uploading'} a type error inside the complete block"
  - "reprocess() uses setJob callback twice: first to reset state and revoke old URL, second to trigger the async upload via runUpload() — avoids stale closure on job.originalFile"
  - "formatBytes omits decimal for sub-KB values (e.g. '500 B' not '500.0 B') to match the spec; toFixed(1) only used for KB and MB"
metrics:
  duration: "8 min"
  completed_date: "2026-05-22"
  tasks_completed: 2
  files_created: 5
  tests_passing: 25
---

# Phase 2 Plan 02: Image options panel + size readout Summary

**One-liner:** Quality slider, width/height with aspect-ratio lock, format selector (JPG→jpeg), NaN-safe size readout, and reprocess() without re-selecting — all wired into SingleImageTool with 25 passing Vitest tests and a clean build.

## What Was Built

Full options panel + size readout layer on top of the 02-01 vertical slice:

- **ImageOptionsPanel:** Controlled React component with quality slider (1-100, clamp guard), width/height number inputs with aspect-ratio lock (`Mantener proporción`, checked by default), and a format selector mapping UI labels (JPG/PNG/WebP/AVIF) to backend values (jpeg/png/webp/avif). Fully controlled — no internal options state.
- **SizeReadout:** Renders `Tamaño original`, `Tamaño resultado`, `% reducción` from server-returned sizes using `formatBytes`. Returns null if any value is null or NaN — defense in depth with the hook's own NaN→null coercion.
- **formatBytes:** Added to `lib/format.ts` alongside `extensionFromContentType`. B/KB/MB with 1-decimal formatting (sub-KB has no decimal, per spec).
- **useImageProcessor.reprocess():** Re-POSTs using the stored `job.originalFile` + new options without re-selecting from disk. Revokes old processedUrl before starting. Probes `Image().naturalWidth/naturalHeight` in parallel with upload to populate `originalDimensions`.
- **SingleImageTool wiring:** Options state (`{ quality: 80, format: 'webp' }`) lifted to component. ImageOptionsPanel, SizeReadout, Re-procesar button and DownloadButton all wired. ContentType from `job.contentType` so downloaded filename extension matches actual response format.

## Tasks Completed

| Task | Name | Commits | Key Files |
|------|------|---------|-----------|
| 1 (RED) | Failing tests for ImageOptionsPanel and SizeReadout | 76acff1 | tests/ImageOptionsPanel.test.tsx, tests/SizeReadout.test.tsx |
| 1 (GREEN) | Implement ImageOptionsPanel, SizeReadout, formatBytes | 346fe47 | components/ImageOptionsPanel.tsx, components/SizeReadout.tsx, lib/format.ts |
| 2 (RED) | Failing tests for useImageProcessor reprocess() | 826a966 | tests/useImageProcessor.test.tsx |
| 2 (GREEN) | Extend hook + types + SingleImageTool wiring | 659c0f9 | hooks/useImageProcessor.ts, types/image.ts, components/SingleImageTool.tsx |

## Verification Results

- `npx vitest run` — 25/25 tests pass across 5 test files (DropZone, DownloadButton, ImageOptionsPanel, SizeReadout, useImageProcessor)
- `npm run build` — exits 0, compiled successfully, 3 routes (/, /_not-found, /image-tool)
- Zero TypeScript errors
- Zero Next.js API routes (`app/api/` does not exist)
- All uploads via axios `api` instance direct to Render backend

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] TypeScript type error on disabled prop in Re-procesar button**
- **Found during:** Task 2 (npm run build TypeScript check)
- **Issue:** The `Re-procesar` button was inside `{job.status === 'complete' && (…)}`, so TypeScript narrowed `job.status` to `'complete'`. The `disabled={job.status === 'uploading'}` comparison was flagged: "This comparison appears to be unintentional because the types 'complete' and 'uploading' have no overlap."
- **Fix:** Removed the `disabled` prop. The button is only rendered when `status === 'complete'`, so it's implicitly hidden (not disabled) during uploading — equivalent UX.
- **Files modified:** `controlmedia-frontend/components/SingleImageTool.tsx`
- **Commit:** 659c0f9

## Threat Mitigations Applied

Per the plan's threat model — all mitigations implemented:

| Threat | Mitigation Applied |
|--------|--------------------|
| T-02-02-01: quality/width/height clamping | clamp() in ImageOptionsPanel; Math.max(1, ...) for width/height; coerced to Number() before FormData append |
| T-02-02-02: format whitelist | Select options hard-coded to jpeg/png/webp/avif; no free-text input |
| T-02-02-03: NaN leaking into DOM | parseNum() in hook returns null on non-finite; SizeReadout also checks Number.isNaN() before render |
| T-02-02-04: Object URL accumulation | reprocess() revokes old processedUrl before creating new one; reset() revokes both; useEffect cleanup on unmount |
| T-02-02-05: Large original File in memory | Accepted per threat model — file reference stored, not copied |
| T-02-02-06: Cross-origin header read failure | Accepted — SizeReadout renders null on any null/NaN; no false numbers shown |
| T-02-02-SC: No new npm packages | Confirmed — zero new dependencies added |

## Known Stubs

None — all features fully wired. Options panel sends real FormData fields, SizeReadout reads real backend headers, reprocess() uses the actual original File object.

## Threat Flags

None — no new network surfaces beyond what was in the plan's threat model.

## Self-Check: PASSED

All created files confirmed present:
- controlmedia-frontend/components/ImageOptionsPanel.tsx: FOUND
- controlmedia-frontend/components/SizeReadout.tsx: FOUND
- controlmedia-frontend/lib/format.ts (modified): FOUND
- controlmedia-frontend/hooks/useImageProcessor.ts (modified): FOUND
- controlmedia-frontend/components/SingleImageTool.tsx (modified): FOUND
- controlmedia-frontend/types/image.ts (modified): FOUND
- controlmedia-frontend/tests/ImageOptionsPanel.test.tsx: FOUND
- controlmedia-frontend/tests/SizeReadout.test.tsx: FOUND
- controlmedia-frontend/tests/useImageProcessor.test.tsx: FOUND

All commits present:
- 76acff1: test(02-02): add failing tests for ImageOptionsPanel and SizeReadout
- 346fe47: feat(02-02): implement ImageOptionsPanel, SizeReadout, and formatBytes
- 826a966: test(02-02): add failing tests for useImageProcessor reprocess() and header parsing
- 659c0f9: feat(02-02): extend useImageProcessor with reprocess() + wire SingleImageTool
