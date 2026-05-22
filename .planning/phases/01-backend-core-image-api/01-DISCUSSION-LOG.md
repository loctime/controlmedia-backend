# Phase 1: Backend Core + Image API - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-22
**Phase:** 01-backend-core-image-api
**Areas discussed:** Repo Structure, File Size Limits, Render Deployment, API Defaults

---

## Repo Structure

| Option | Description | Selected |
|--------|-------------|----------|
| Repos separados | backend/ y frontend/ como proyectos independientes. Cada uno tiene su package.json y deploy independiente en Render/Vercel. | ✓ |
| Monorepo | Un solo repo con backend/ y frontend/ como carpetas. Compartir tooling, un solo git history. | |
| Tú decides | El planner elige la estructura más adecuada. | |

**User's choice:** Repos separados (Recomendado)
**Notes:** Backend independiente en Render, frontend independiente en Vercel.

---

## File Size Limits

| Option | Description | Selected |
|--------|-------------|----------|
| 20MB por imagen | Conservador. Cubre fotos de celular (3-8MB) y DSLRs comprimidas (10-15MB). | ✓ |
| 50MB por imagen | Generoso. Cubre RAW exportados como TIFF o PNG sin comprimir de cámaras profesionales. | |
| Tú decides | El planner elige un límite razonable basado en el stack. | |

**User's choice:** 20MB por imagen
**Notes:** Video ya estaba definido en 500MB por REQUIREMENTS.md.

---

## Render Deployment

| Option | Description | Selected |
|--------|-------------|----------|
| Free tier primero | Gratis, pero duerme después de 15 min de inactividad (cold start ~30s). Ideal para desarrollar y testear. | ✓ |
| Starter ($7/mes) desde el día 1 | Sin cold start, siempre activo. Más realista para desarrollo porque simula producción. | |

**User's choice:** Free tier primero
**Notes:** Upgrade a Starter antes del lanzamiento público.

---

## API Defaults

| Option | Description | Selected |
|--------|-------------|----------|
| Defaults razonables: quality 80, formato WebP | El endpoint siempre procesa aunque el frontend no mande opciones. Útil para testing con curl/Postman. | ✓ |
| Error 400 si faltan params obligatorios | Requiere quality y format explícitos. Más estricto. | |
| Tú decides | El planner define la política de validación. | |

**User's choice:** Defaults razonables: quality 80, formato WebP
**Notes:** El campo `file` sigue siendo obligatorio. Solo los parámetros de procesamiento tienen defaults.

---

## Claude's Discretion

- Estructura interna de rutas del Express app
- Estrategia de testing manual (curl commands en README, Postman collection, etc.)
- Naming conventions internas
- Versión exacta de Node.js en el Render runtime

## Deferred Ideas

- Video processing (FFmpeg, SSE, async jobs) — Phase 3
- Frontend image UI — Phase 2
- Platform presets — Phase 5
- Rate limiting por IP — fuera de scope v1
