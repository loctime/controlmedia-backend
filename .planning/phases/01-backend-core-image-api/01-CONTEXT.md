# Phase 1: Backend Core + Image API - Context

**Gathered:** 2026-05-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 1 delivers the Express backend deployed on Render with the full image processing API: single image compress/resize/format-convert, batch ZIP (up to 20 images), HEIC rejection at multer layer, cleanup sweep, and CORS. This establishes all architectural patterns for both image and video paths — video processing itself is Phase 3.

No frontend code. No video processing. No presets. Backend only.

</domain>

<decisions>
## Implementation Decisions

### Repo Structure
- **D-01:** Backend es un proyecto independiente — repo separado del frontend Next.js. Tiene su propio `package.json` y se despliega en Render de forma autónoma. El frontend (Next.js) irá en un repo separado que se despliega en Vercel.

### File Size Limits
- **D-02:** Límite de imágenes: **20MB por archivo** (multer `fileSize` config). Cubre fotos de celular (3–8 MB) y DSLRs exportadas como JPEG comprimido. Batch: hasta 20 imágenes × 20MB cada una (multer `limits.fileSize` se aplica por archivo, no al total).
- **D-03:** Límite de video: 500MB (definido en REQUIREMENTS.md VID-01 — será implementado en Phase 3, pero la config de multer diskStorage puede dejarse preparada).

### Render Deployment
- **D-04:** Arrancar en **Free tier de Render** para desarrollo. El cold start (~10–30s tras inactividad) es aceptable para desarrollo. Upgradar a Starter ($7/mes) antes del lanzamiento público.
- **D-05:** Verificar disponibilidad de `ffmpeg-static` en el primer deploy (Free tier debe soportarlo — si no, upgrade inmediato).

### API Defaults
- **D-06:** Cuando el frontend no envía parámetros opcionales, el backend aplica defaults: `quality=80`, `format=webp`. El campo `file` (multipart) sigue siendo obligatorio — sin archivo se retorna 400.
- **D-07:** Shape de error consistente en todos los 4xx/5xx: `{ "error": "ERROR_CODE", "message": "..." }`. Códigos: `FILE_TOO_LARGE`, `INVALID_FILE_TYPE`, `MISSING_FILE`, `PROCESSING_ERROR`.

### Constraints técnicos (ya decididos — llevar al planner)
- **D-08:** multer memoryStorage para imágenes (no disk I/O en el happy path).
- **D-09:** HEIC/HEIF rechazado en multer `fileFilter` con error descriptivo antes de llamar a Sharp.
- **D-10:** CORS via regex: `/https:\/\/controlmedia-.*\.vercel\.app$/` para cubrir preview URLs de Vercel + `http://localhost:3000` para dev.
- **D-11:** Batch Sharp: `p-limit(3)` + `sharp.concurrency(1)` + `sharp.cache(false)`. No `Promise.all` sin límite.
- **D-12:** Cleanup siempre en bloque `finally` + `setInterval` sweep de 30 minutos para archivos huérfanos.

### Claude's Discretion
- Estructura interna de rutas del Express app (ej: `routes/images.js`, `routes/health.js` o todo en `app.js`)
- Estrategia de testing manual durante desarrollo (curl commands en README, Postman collection, etc.)
- Naming conventions internas (variables, funciones)
- Versión exacta de Node.js en el Render runtime (LTS más reciente)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` — Phase 1 requirements: IMG-01, IMG-02, IMG-04, IMG-05, IMG-06, IMG-07, BATCH-01, BATCH-02, BATCH-03, GEN-01, GEN-02, GEN-03, GEN-04

### Roadmap & Goal
- `.planning/ROADMAP.md` — Phase 1 goal, success criteria (5 items), plan list (01-01, 01-02, 01-03)

### Architecture & API Design
- `.planning/research/ARCHITECTURE.md` — API endpoints shape, request/response flows (image + batch + video async), file lifecycle, CORS config, batch ZIP streaming pattern, cleanup sweep implementation

### Stack Details
- `.planning/research/STACK.md` — Sharp, multer, archiver, p-limit, ffmpeg-static versiones y configuración específica

### Critical Constraints
- `CLAUDE.md` — 7 constraints críticos que NO pueden violarse (Vercel 4.5MB limit, fluent-ffmpeg ban, diskStorage para video, HEIC block, CORS regex, batch config, cleanup finally)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Ninguno — proyecto desde cero. No hay código existente.

### Established Patterns
- Sin patrones previos de código. Los patrones se establecen en esta fase y se reutilizan en fases siguientes.

### Integration Points
- El backend expone `POST /api/images/process`, `POST /api/images/batch`, y `GET /health` en Phase 1.
- El frontend (Phase 2) conecta a estos endpoints via `fetch()` directo (sin pasar por Vercel).
- BACKEND_URL se configura via variable de entorno en el frontend.

</code_context>

<specifics>
## Specific Ideas

- ZIP streaming: usar `archiver` con `zlib.level: 6` (no 9 — overkill para imágenes ya comprimidas), piped directamente a `res` — no bufferar el ZIP completo en memoria.
- Batch endpoint usa `upload.array('files', 20)` para multer.
- Nombres de archivos en el ZIP: `optimized-1.webp`, `optimized-2.webp`, ... (índice basado en 1).
- Health check endpoint `GET /health` retorna `{ "status": "ok" }` — necesario para Render health checks.
- Sharp pipeline: `sharp(buffer).resize(width, height, { fit: 'inside' }).toFormat(format, { quality }).toBuffer()`.
- Si `width` o `height` no se envían, no llamar `.resize()` — Sharp lo interpreta como "no cambiar dimensiones".

</specifics>

<deferred>
## Deferred Ideas

- Video processing (FFmpeg, SSE, async jobs) — Phase 3
- Frontend image UI (drag-drop, comparación, batch UI) — Phase 2
- Platform presets (WhatsApp, Discord, Instagram) — Phase 5
- Rate limiting por IP — fuera de scope v1, mencionado en PROJECT.md como "si hace falta"
- Redis / job queue distribuido — fuera de scope v1 (un solo instance en Render es suficiente)

</deferred>

---

*Phase: 01-backend-core-image-api*
*Context gathered: 2026-05-22*
