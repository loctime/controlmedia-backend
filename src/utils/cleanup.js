// Job store — in-memory map of job IDs to metadata (used by Phase 3 video jobs)
// Phase 1: empty — no video jobs yet. Exported so Phase 3 can import and populate it.
export const jobStore = new Map()

const SWEEP_INTERVAL_MS = 30 * 60 * 1000 // 30 minutes (D-12)
const JOB_TTL_MS = 30 * 60 * 1000        // Entries older than 30 minutes are stale

/**
 * startCleanupSweep — start the background interval that purges stale job entries.
 *
 * Phase 1: logs a no-op message since jobStore is always empty (no video jobs yet).
 * Phase 3: will import jobStore into video routes, populate it with job metadata,
 * and this sweep will delete entries + their /tmp/jobs/<uuid>/ directories.
 *
 * CLAUDE.md Constraint 7: cleanup always in finally + setInterval sweep.
 */
export function startCleanupSweep() {
  setInterval(() => {
    const now = Date.now()
    let swept = 0

    for (const [jobId, job] of jobStore.entries()) {
      if (now - job.createdAt > JOB_TTL_MS) {
        jobStore.delete(jobId)
        swept++
      }
    }

    if (swept > 0) {
      console.log(`Cleanup sweep: removed ${swept} stale job(s)`)
    } else {
      console.log('Cleanup sweep: no video jobs to clean')
    }
  }, SWEEP_INTERVAL_MS)
}
