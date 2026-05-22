import 'dotenv/config'
import express from 'express'
import { corsMiddleware } from './middleware/cors.js'
import { errorHandler } from './middleware/errorHandler.js'
import healthRouter from './routes/health.js'
import { startCleanupSweep } from './utils/cleanup.js'

const app = express()

// ─── Middleware order is CRITICAL (RESEARCH.md Pattern 6 / Pitfall 2) ──────────
// 1. CORS must be FIRST — so error responses also carry CORS headers.
//    Without this, a 413 or 400 from multer appears as a CORS error in the browser.
app.use(corsMiddleware)

// 2. JSON body parser — for non-multipart routes
app.use(express.json())

// ─── Routes ─────────────────────────────────────────────────────────────────────
// 3. Health check — required for Render health checks (render.yaml healthCheckPath: /health)
app.use('/health', healthRouter)

// ─── Error handler ──────────────────────────────────────────────────────────────
// 4. Error handler MUST be last — after all routes (4-argument signature required by Express)
app.use(errorHandler)

// ─── Startup ────────────────────────────────────────────────────────────────────
const port = process.env.PORT || 3001

app.listen(port, () => {
  console.log(`ControlMedia backend listening on port ${port}`)
  // Start background cleanup sweep (D-12, CLAUDE.md Constraint 7)
  // Phase 1: logs "no video jobs to clean" every 30 min (stub — real cleanup in Phase 3)
  startCleanupSweep()
})

export default app
