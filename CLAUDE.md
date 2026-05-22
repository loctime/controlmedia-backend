# ControlMedia

Web app pública para optimizar y convertir imágenes y videos — como HandBrake pero también para imágenes. Frontend Next.js en Vercel, backend Express en Render.

## Stack

- **Frontend:** Next.js 14+ (App Router) en Vercel
- **Backend:** Node.js 20 + Express en Render
- **Imágenes:** `sharp@0.34.5`
- **Videos:** `ffmpeg-static` + `child_process.spawn` (NO fluent-ffmpeg — archivado mayo 2025)
- **Uploads:** `multer` — memoryStorage para imágenes, diskStorage para video
- **UI antes/después:** `react-compare-slider@4.0.0`
- **Uploads frontend:** `axios` (necesario para `onUploadProgress`)
- **Progreso video:** `EventSource` nativo (SSE)
- **Batch ZIP:** `archiver`

## Constraints críticos

1. **Vercel 4.5 MB body limit** — NUNCA enrutar uploads a través de Next.js API routes. Todos los archivos van `browser → Render` directamente.
2. **fluent-ffmpeg está archivado** — usar `child_process.spawn` con `ffmpeg-static`.
3. **Video → diskStorage obligatorio** — multer memoryStorage para video = OOM en Render.
4. **HEIC bloqueado en frontend** — Sharp prebuilts no tienen libheif.
5. **CORS con regex** — `/https:\/\/controlmedia-.*\.vercel\.app$/` para cubrir preview URLs de Vercel.
6. **Sharp batch:** `p-limit(3)` + `sharp.concurrency(1)` + `sharp.cache(false)`.
7. **Cleanup siempre en `finally`** — `/tmp/jobs/<uuid>/` borrado incondicional post-proceso.

## GSD Workflow

Este proyecto usa GSD. Siempre seguir el flujo:

```
/gsd:discuss-phase N → /gsd:plan-phase N → /gsd:execute-phase N
```

Ver `.planning/ROADMAP.md` para el estado actual de las fases.

## Archivos de planificación

- `.planning/PROJECT.md` — contexto y decisiones del proyecto
- `.planning/REQUIREMENTS.md` — requisitos v1 con REQ-IDs
- `.planning/ROADMAP.md` — 5 fases, criterios de éxito, progreso
- `.planning/research/` — stack, features, arquitectura, pitfalls
