import { Router } from 'express'

const router = Router()

// GET /health — required for Render health checks
// Returns 200 { status: 'ok' } — any 2xx is sufficient for Render
router.get('/', (req, res) => {
  res.json({ status: 'ok' })
})

export default router
