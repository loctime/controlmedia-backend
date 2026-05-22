---
phase: 01-backend-core-image-api
plan: "03"
subsystem: api
tags: [express, archiver, p-limit, cleanup, zip, batch, node]

requires:
  - phase: 01-01
    provides: imageUploadArray export from upload.js, cleanup.js jobStore stub, errorHandler
  - phase: 01-02
    provides: processImage(buffer, options) service from imageProcessor.js

provides:
  - POST /api/images/batch streaming ZIP response with p-limit(3) concurrency
  - Real cleanup sweep replacing stub — fs.readdir scan of /tmp/jobs/ with 30-min threshold
  - Full Phase 1 backend complete — all 5 success criteria satisfied

affects:
  - Phase 2 frontend (POST /api/images/batch endpoint ready to receive up to 20 files)
  - Phase 3 video (cleanup.js already sweeps /tmp/jobs/ — video diskStorage dirs will be auto-cleaned)

tech-stack:
  added: []
  patterns:
    - archiver v8 ZipArchive class API (named export, replaces v7 factory function)
    - archive.on('error') before archive.pipe(res) — Pitfall 6 compliance
    - p-limit(3) wrapping processImage calls — no uncapped Promise.all for batch
    - fs.access ENOENT guard before readdir — cleanup sweep safe when /tmp/jobs/ doesn't exist
    - Per-entry try/catch in sweep loop — one bad entry doesn't abort the full sweep

key-files:
  created: []
  modified:
    - src/routes/images.js
    - src/utils/cleanup.js

key-decisions:
  - "archiver v8 uses named export ZipArchive class (not archiver('zip', opts) factory from v7 docs) — discovered at runtime, fixed inline"
  - "Cleanup sweep uses fs.access ENOENT guard before readdir — ENOENT is normal in Phase 1 (no video jobs), handled silently without error log"
  - "Per-entry try/catch inside cleanup loop — prevents one failed stat/rm from aborting cleanup of remaining entries"

patterns-established:
  - "Batch route: pLimit(3) → Promise.all → ZipArchive → archive.on('error') → archive.pipe(res) → archive.append → archive.finalize()"
  - "Cleanup sweep: fs.access guard → readdir → per-entry stat+mtime check → fs.rm recursive — all in outer try/catch"

requirements-completed:
  - BATCH-01
  - BATCH-02
  - BATCH-03
  - GEN-04

duration: 8min
completed: 2026-05-22
---

# Phase 1 Plan 03: Batch Endpoint + ZIP + Cleanup Summary

**POST /api/images/batch streaming ZIP with p-limit(3) concurrency via archiver ZipArchive, plus real /tmp/jobs/ cleanup sweep replacing the Phase 1 stub — completing the full Phase 1 backend**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-05-22T19:24:35Z
- **Completed:** 2026-05-22T19:32:15Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- POST /api/images/batch processes up to 20 images with pLimit(3) concurrency cap, streams ZIP directly to response — never buffered in memory; files named optimized-1.{format} through optimized-N.{format}
- Cleanup sweep replaces Phase 1 stub with real fs.readdir scan of /tmp/jobs/, deletes directories older than 30 minutes via fs.rm({ recursive: true, force: true }), sweeps in-memory jobStore Map entries; ENOENT handled silently (expected in Phase 1); all errors caught and logged, never propagated
- Full Phase 1 backend deployable on Render: all 5 success criteria satisfied

## Task Commits

1. **Task 1: POST /api/images/batch with p-limit and archiver ZIP streaming** - `131249f` (feat)
2. **Task 2: Real cleanup sweep replacing the Phase 1 stub** - `3c6f35f` (feat)

**Plan metadata:** (committed with SUMMARY + STATE updates)

## Files Created/Modified

- `src/routes/images.js` — Added POST /batch route with pLimit(3), ZipArchive streaming, error-before-pipe ordering; updated imports to include pLimit, ZipArchive, imageUploadArray
- `src/utils/cleanup.js` — Replaced stub with real fs.readdir sweep; fs.access ENOENT guard; per-entry stat+mtime threshold; fs.rm recursive; in-memory jobStore sweep; outer try/catch; startup log message

## Decisions Made

- `archiver` v8 changed from factory function `archiver('zip', opts)` to named class export `ZipArchive` — discovered when ESM default import failed; fixed inline (Rule 1 auto-fix)
- Cleanup sweep uses `fs.access` ENOENT guard before `readdir` — Phase 1 never creates `/tmp/jobs/` (image processing uses memoryStorage), so ENOENT is normal, not an error; handled with silent early return
- Per-entry `try/catch` inside the sweep loop so one failed `stat` or `rm` doesn't abort cleanup of remaining entries

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] archiver v8 ESM import uses ZipArchive class, not default factory**
- **Found during:** Task 1 (loading images.js module after adding `import archiver from 'archiver'`)
- **Issue:** `SyntaxError: The requested module 'archiver' does not provide an export named 'default'` — archiver v8 switched from a CommonJS default export factory to ESM named class exports (`ZipArchive`, `TarArchive`, `JsonArchive`)
- **Fix:** Changed `import archiver from 'archiver'` to `import { ZipArchive } from 'archiver'` and replaced `archiver('zip', { zlib: { level: 6 } })` with `new ZipArchive({ zlib: { level: 6 } })`
- **Files modified:** `src/routes/images.js`
- **Verification:** `node --input-type=module --eval "import './src/routes/images.js'; console.log('OK')"` — loads without error
- **Committed in:** `131249f` (part of Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — archiver v8 API change)
**Impact on plan:** Necessary fix for module loading. The ZipArchive class API is functionally equivalent to the v7 factory — same `.on('error')`, `.pipe()`, `.append()`, `.finalize()` interface. No scope creep.

## Issues Encountered

- archiver v8.0.0 README and research docs referenced the `archiver('zip', opts)` factory pattern from v7 — this pattern no longer works in v8 which uses ESM named class exports. Discovered at runtime and fixed inline (1 minute).

## Known Stubs

None — all functionality is fully wired:
- POST /batch calls real pLimit → real processImage → real ZipArchive streaming
- Cleanup sweep scans real fs paths; ENOENT early return is correct behavior, not a stub

## Threat Flags

None — all threats in the plan's threat model were mitigated:
- T-03-01 (batch file count DoS): imageUploadArray = upload.array('files', 20) — multer rejects > 20 files
- T-03-02 (uncapped batch concurrency): pLimit(3) wraps all processImage calls
- T-03-03 (archiver memory): archive.pipe(res) before any .append() calls; zlib.level:6
- T-03-04 (path traversal in cleanup): sweep confined to /tmp/jobs/ via path.join
- T-03-05 (cleanup sweep crash): all fs operations wrapped in try/catch

## User Setup Required

None — no external service configuration required for this plan.

## Next Phase Readiness

- Phase 1 backend is complete and deployable on Render
- All 5 Phase 1 success criteria are satisfied:
  1. POST /api/images/process returns binary + X-* headers — 01-02
  2. POST /api/images/batch returns streaming ZIP — this plan
  3. X-Original-Size, X-Result-Size, X-Reduction-Pct in response headers — 01-02
  4. HEIC rejected at multer layer before Sharp — 01-01 + enforced in both routes
  5. Cleanup sweep removes /tmp/jobs/ dirs older than 30 min — this plan
- Phase 2 (frontend) can immediately connect to POST /api/images/process and POST /api/images/batch
- No blockers for Phase 2

---
*Phase: 01-backend-core-image-api*
*Completed: 2026-05-22*
