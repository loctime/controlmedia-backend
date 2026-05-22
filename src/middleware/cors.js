import cors from 'cors'

// Allowlist: localhost for dev + any Vercel preview URL for this project (D-10)
const CORS_ORIGINS = [
  'http://localhost:3000',
  /https:\/\/controlmedia-.*\.vercel\.app$/, // Vercel preview URLs (CLAUDE.md Constraint 5)
]

// If ALLOWED_ORIGIN env var is set (production URL), add it to the allowlist
if (process.env.ALLOWED_ORIGIN) {
  CORS_ORIGINS.push(process.env.ALLOWED_ORIGIN)
}

export const corsMiddleware = cors({
  origin: (origin, callback) => {
    // Allow requests with no Origin header (server-to-server, curl, Postman)
    if (!origin) return callback(null, true)

    const allowed = CORS_ORIGINS.some((o) =>
      o instanceof RegExp ? o.test(origin) : o === origin
    )

    if (allowed) return callback(null, true)
    callback(new Error('Not allowed by CORS'))
  },
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type'],
})
