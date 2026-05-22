# Project Research Summary

**Project:** ControlMedia
**Domain:** Browser-based image and video optimization / conversion web app
**Researched:** 2026-05-22
**Confidence:** HIGH

---

## Executive Summary

ControlMedia es una herramienta de procesamiento de media stateless: los usuarios suben archivos, el servidor los procesa, y el resultado se devuelve inmediatamente para descarga sin persistir nada. La arquitectura es un split-deployment: frontend Next.js en Vercel maneja la UI, y un backend Express en Render maneja todo el procesamiento binario. Este split es no-negociable — Vercel tiene un límite de 4.5 MB en el body de serverless functions que hace imposible enrutar uploads de archivos a través de él. Los archivos van directamente del browser a Render. Sharp maneja imágenes sincrónicamente (suficientemente rápido para un único HTTP request), mientras FFmpeg maneja video de forma asíncrona con un job queue y Server-Sent Events para streaming de progreso.

El stack recomendado es maduro e inequívoco: `sharp@0.34.5` para imágenes, `ffmpeg-static` + `child_process.spawn` para video (fluent-ffmpeg fue archivado en mayo 2025 y no debe usarse), `multer` para uploads, y `react-compare-slider` para UI de comparación antes/después. El mayor constraint operacional es la RAM de Render: los videos deben escribirse a `/tmp` (nunca en memoria), la concurrencia de Sharp debe limitarse con `p-limit`, y el filesystem `/tmp` tiene un cap duro de 2 GB que requiere disciplina estricta de cleanup.

La posición competitiva es clara: ninguna herramienta gratuita hace bien tanto procesamiento de imágenes como video en una sola interfaz limpia, sin marcas de agua y sin login.

---

## Recommended Stack

**Core technologies:**
- `Next.js 14+` (App Router): frontend en Vercel — solo UI, cero enrutamiento de datos binarios
- `Express 4.x` en Node.js 20 LTS: backend en Render Standard ($25/mo recomendado para producción)
- `sharp@0.34.5`: procesamiento de imágenes — resize, compress, convert
- `ffmpeg-static@5.x` + `child_process.spawn`: procesamiento de video (fluent-ffmpeg archivado mayo 2025)
- `multer@1.4.5`: uploads multipart — memoryStorage para imágenes, diskStorage para video
- `react-compare-slider@4.0.0`: UI antes/después — zero deps, mantenido activamente
- `axios`: upload en frontend con progreso via `onUploadProgress`
- `EventSource` nativo: consumo de SSE en frontend
- `archiver`: ZIP streaming para batch downloads
- `p-limit`: cap de concurrencia para batch de Sharp
- `ffprobe-static`: metadata/duración de video para % de progreso

**NO usar:** fluent-ffmpeg (archivado), @ffmpeg/ffmpeg WASM server-side (5-15x más lento), express-fileupload (carga todo en memoria), Next.js API routes para uploads de archivos (límite 4.5 MB).

---

## Table Stakes Features (v1 must-have)

**Imágenes:**
- Drag-and-drop upload, quality slider, comparación antes/después (estilo Squoosh)
- Conversión de formato: JPG, PNG, WebP, AVIF output
- Resize por dimensiones con aspect ratio lock
- Readout de tamaño de archivo antes/después con % de reducción
- Batch processing con ZIP download (hasta 20 archivos)
- Sin login, sin marca de agua

**Video:**
- Upload MP4, MOV, WebM, AVI
- Comprimir con control de calidad (H.264 CRF)
- Presets de resolución (4K, 1080p, 720p, 480p)
- Indicador de progreso via SSE (esencial — el procesamiento tarda 30-120s)
- Readout de tamaño antes/después

**Diferenciadores (should-have):**
- Platform presets con specs reales: WhatsApp, Discord, Twitter/X, Instagram Feed/Reel, Web Optimized
- Output AVIF (raro en herramientas gratuitas, 50% más pequeño que JPEG)
- Video trim (inicio/fin)
- Toggle para strip de metadata (privacidad EXIF/GPS)

**Diferir a v2+:** Preview de slider en vivo, batch de video, cancelar job en progreso, controles de audio, output HEVC, tiempo estimado restante.

**Nunca construir:** Filtros de video, color grading, almacenamiento en nube, cuentas de usuario, AI upscaling, input por URL/YouTube, eliminación de fondo, creación de GIF, manejo de PDF.

**HEIC:** Bloquear en frontend con mensaje claro. Los prebuilts de Sharp excluyen libheif (problema de patentes). Usar `heic-convert` en v2.

---

## Architecture Pattern

Dos paths de procesamiento independientes:

**Path imagen (síncrono):** Buffer in → Sharp pipeline → Buffer out → HTTP response. Sin disco, sin jobs.

**Path video (asíncrono):** archivo → `/tmp/<uuid>/` → 202 + jobId → FFmpeg spawn → SSE progress stream → GET download + cleanup.

**Componentes:**
1. **Next.js frontend (Vercel):** Solo UI. Todas las transferencias de archivos van browser → Render via `fetch()` directo.
2. **Express image router** (`/api/images/*`): multer memoryStorage → p-limit(3) Sharp pipeline → Buffer response / archiver ZIP stream.
3. **Express video router** (`/api/videos/*`): multer diskStorage → 202 + jobId → FFmpeg child_process → SSE stream → GET download stream + cleanup.
4. **JobStore (in-memory Map):** Estado de jobs de video. Single-instance — Redis solo si se necesita escalar a múltiples instancias.
5. **Cleanup subsystem:** bloques `finally` + handler `req.on('close')` + sweep `setInterval` cada 10 min para jobs mayores a 30 min.

**CORS:** Regex-based origin matching requerido (`/https:\/\/controlmedia-.*\.vercel\.app$/`) para cubrir Vercel preview URLs.

---

## Top 5 Pitfalls

1. **Vercel 4.5 MB body limit** — Nunca enrutar bytes de archivo a través de una API route de Next.js. Uploads directos browser → Render solamente. Límite de plataforma, sin workaround, decisión arquitectónica del día uno.

2. **FFmpeg zombie processes** — Cada `spawn()` debe tener: timeout con SIGKILL, handler `req.on('close')`, y cleanup en bloque `finally`. Los huérfanos se acumulan y OOM-matan el servicio.

3. **Sharp batch memory spikes** — Nunca usar `Promise.all()` crudo en batches. Usar `p-limit(3)` + `sharp.concurrency(1)` + `sharp.cache(false)`.

4. **Render `/tmp` 2 GB hard cap** — Escribir archivos temporales de video a `/tmp/jobs/<uuid>/`, borrar incondicionalmente en `finally`. Empezar con límite de input de 200 MB.

5. **HEIC uploads fallan silenciosamente** — Los prebuilts de Sharp excluyen libheif. Bloquear HEIC por extensión/magic bytes en el frontend antes de que el upload llegue al servidor.

**Adicionales críticos:** AVIF usar `effort: 2`; VP9 usar `-deadline realtime -cpu-used 4`; jobs de video concurrentes necesitan `PQueue({ concurrency: 1 })`; check de decompression bomb `width * height > 25_000_000`; Fetch API necesita axios/XHR para upload progress.

---

## Build Order

| Fase | Qué | Por qué este orden |
|------|-----|-------------------|
| 1 | Backend Core + Image Processing | Prueba el ciclo upload-process-download sincrónicamente; establece todos los patrones arquitectónicos |
| 2 | Frontend Image Tool | Construir contra API funcionando; react-compare-slider + axios upload progress |
| 3 | Backend Video Processing | Pattern de job async + SSE + gestión de zombies FFmpeg |
| 4 | Frontend Video Tool | UX de progreso en dos fases (uploading% luego processing%) |
| 5 | Platform Presets + Polish | Componer operaciones existentes en selector de presets con specs reales |
| 6 | Video Trim | UI deferida sobre base de video estable |

---

## Key Constraints

| Constraint | Decisión no-negociable |
|------------|------------------------|
| Vercel 4.5 MB body limit | Uploads: browser → Render directamente |
| Render /tmp 2 GB hard cap | UUID job dirs + cleanup uncondicional en finally |
| Render 512 MB RAM | p-limit(3), sharp.concurrency(1), diskStorage para video |
| fluent-ffmpeg archivado mayo 2025 | child_process.spawn con ffmpeg-static |
| Sharp prebuilts excluyen HEIC | Bloquear HEIC en frontend desde Fase 1 |
| Fetch API sin upload progress | Usar axios para requests de upload |
| Single Render instance | In-memory JobStore aceptable para v1 |

---

*Research completado: 2026-05-22 — Listo para roadmap: sí*
