# ControlMedia

## What This Is

Web app para optimizar y transformar imágenes y videos directamente desde el browser — como HandBrake, pero también para imágenes. Cualquiera puede subir archivos, aplicar operaciones (comprimir, redimensionar, recortar, cambiar formato) y descargar el resultado sin instalar nada. Soporte para procesamiento individual con preview en vivo y batch de múltiples archivos.

## Core Value

Que el usuario pueda reducir el tamaño de sus imágenes y videos en segundos, con presets para los casos más comunes (web, WhatsApp, Discord) y sin fricción de instalación.

## Requirements

### Validated

(None yet — ship to validate)

### Active

**Imágenes:**
- [ ] Usuario puede subir una imagen y comprimirla con control de calidad
- [ ] Usuario puede redimensionar una imagen a medidas específicas o porcentaje
- [ ] Usuario puede convertir formato (JPG, PNG, WebP, AVIF)
- [ ] Usuario ve preview en vivo de la imagen resultante antes de descargar
- [ ] Usuario puede subir múltiples imágenes y procesarlas en batch (descarga ZIP)

**Videos:**
- [ ] Usuario puede subir un video y comprimirlo bajando bitrate/calidad
- [ ] Usuario puede cambiar la resolución del video (4K→1080p, 1080p→720p, etc.)
- [ ] Usuario puede recortar un fragmento del video (trim: inicio y fin)
- [ ] Usuario puede convertir formato de video (MP4, WebM, MOV)

**Presets:**
- [ ] Presets clásicos disponibles: Web optimized, WhatsApp, Discord, Twitter/X, Instagram
- [ ] Los presets pre-populan la configuración pero el usuario puede editarla

**General:**
- [ ] Herramienta pública, sin login requerido
- [ ] El procesamiento ocurre en el servidor (backend)
- [ ] UI muestra comparativa antes/después (tamaño original vs resultado)

### Out of Scope

- Edición avanzada (filtros, efectos, color grading) — fuera del foco de optimización
- Almacenamiento de archivos en la nube — los archivos no se guardan en el servidor
- Historial de conversiones — sin cuenta, sin historial
- Editor de video timeline complejo — solo trim básico en v1

## Context

- El usuario ya tiene controlPDF (herramienta de PDF 100% client-side en Next.js). ControlMedia es el equivalente pero para media y con backend.
- Existe un VPS Contabo (5.189.136.177) con PM2 corriendo. El backend irá en Render (más fácil de escalar y gestionar que el VPS propio).
- Frontend en Vercel (Next.js), backend en Render (Node.js).
- El procesamiento de imágenes se hace con Sharp en el backend. Videos con FFmpeg.
- Los archivos se procesan en memoria o en /tmp — no se almacenan permanentemente.

## Constraints

- **Privacy**: Los archivos subidos no deben persistir en el servidor — procesamiento en memoria o borrado inmediato post-proceso.
- **File size limits**: Video puede ser muy pesado; definir límites razonables (ej: 500MB para video, 50MB para imagen).
- **FFmpeg en Render**: Render soporta FFmpeg pero hay que verificar disponibilidad en el plan elegido.
- **Stack**: Next.js (frontend) + Node.js/Express (backend). Consistente con el ecosistema JS del usuario.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Backend en Render | Más fácil que gestionar VPS propio; FFmpeg disponible; free tier para empezar | — Pending |
| Sharp para imágenes | Librería Node.js líder, rápida, soporta WebP/AVIF, operaciones encadenables | — Pending |
| FFmpeg para videos | Standard de la industria, máxima compatibilidad, control total de codecs | — Pending |
| Sin autenticación v1 | Herramienta pública, sin fricción. Rate limiting por IP si hace falta | — Pending |
| No almacenamiento | Archivos en /tmp o memoria, borrado post-proceso. Simplifica arquitectura y privacidad | — Pending |

## Evolution

Este documento evoluciona en transiciones de fase y milestones.

**Después de cada fase:**
1. ¿Requisitos invalidados? → Mover a Out of Scope con razón
2. ¿Requisitos validados? → Mover a Validated con referencia de fase
3. ¿Nuevos requisitos emergieron? → Agregar a Active
4. ¿Decisiones nuevas? → Agregar a Key Decisions
5. ¿"What This Is" sigue siendo preciso? → Actualizar si se desvió

---
*Last updated: 2026-05-22 after initialization*
