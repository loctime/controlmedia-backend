/**
 * cleanup.js — Background cleanup sweep for orphaned job directories
 *
 * Phase 1 (image-only): Uses memoryStorage — no /tmp/jobs/ directories are written.
 *   startCleanupSweep() starts the interval but the sweep returns early (ENOENT).
 *   This is normal and expected — no error is logged.
 *
 * Phase 3 (video): Video routes write to /tmp/jobs/<uuid>/ via diskStorage.
 *   The sweep finds dirs older than 30 min and removes them via fs.rm.
 *   jobStore entries older than 30 min are also deleted (in-memory cleanup).
 *
 * CLAUDE.md Constraint 7: cleanup always in finally + setInterval sweep (D-12).
 * Security: sweep only operates on /tmp/jobs/ prefix — path.join confines deletion
 *   to that directory tree (T-03-04: path traversal mitigation).
 */

import fs from 'fs/promises'
import path from 'path'

// Job store — in-memory map of job IDs to metadata (used by Phase 3 video jobs)
// Phase 1: empty — no video jobs yet. Exported so Phase 3 can import and populate it.
export const jobStore = new Map()

const SWEEP_INTERVAL_MS = 30 * 60 * 1000  // 30 minutes (D-12)
const JOB_TTL_MS = 30 * 60 * 1000         // Entries/dirs older than 30 minutes are stale
const JOBS_DIR = '/tmp/jobs'               // Phase 3 diskStorage writes here (D-03)

/**
 * startCleanupSweep — start the background interval that purges stale job artifacts.
 *
 * Sets up a setInterval that every 30 minutes:
 *   1. Scans /tmp/jobs/ for directories older than 30 min → removes via fs.rm({ recursive: true })
 *   2. Sweeps in-memory jobStore for entries older than 30 min → deletes map entries
 *
 * All fs operations are wrapped in try/catch — sweep errors are logged but never crash
 * the server process (T-03-05).
 *
 * ENOENT on /tmp/jobs/ is normal in Phase 1 (no video jobs have run yet) — handled
 * silently with an early return, no error log.
 */
export function startCleanupSweep() {
  console.log('Cleanup sweep started — interval: 30 minutes')

  setInterval(async () => {
    try {
      const threshold = Date.now() - JOB_TTL_MS

      // ── Filesystem sweep: /tmp/jobs/ directories ──────────────────────────────
      try {
        // fs.access throws ENOENT if JOBS_DIR doesn't exist — expected in Phase 1
        await fs.access(JOBS_DIR)
      } catch {
        // JOBS_DIR doesn't exist — normal in Phase 1, no video jobs have run yet
        // Return early without any error log (ENOENT is expected, not an error)
        return
      }

      const entries = await fs.readdir(JOBS_DIR)

      for (const entry of entries) {
        try {
          const entryPath = path.join(JOBS_DIR, entry)
          const stat = await fs.stat(entryPath)

          if (stat.mtimeMs < threshold) {
            // Remove orphaned job directory recursively (T-03-04: confined to JOBS_DIR prefix)
            await fs.rm(entryPath, { recursive: true, force: true })
            console.log(`Cleanup: removed orphaned job ${entry}`)
          }
        } catch (entryErr) {
          // Log per-entry errors but continue sweeping remaining entries
          console.error(`Cleanup sweep error on entry ${entry}:`, entryErr)
        }
      }

      // ── In-memory sweep: jobStore Map entries (Phase 3 compatibility) ────────
      for (const [jobId, job] of jobStore.entries()) {
        if (job.createdAt < threshold) {
          jobStore.delete(jobId)
        }
      }
    } catch (err) {
      // Catch-all: sweep errors must never propagate to crash the process (T-03-05)
      console.error('Cleanup sweep error:', err)
    }
  }, SWEEP_INTERVAL_MS)
}
