# ControlMedia — Requirements

**Version:** v1
**Defined:** 2026-05-22
**Status:** Active

---

## v1 Requirements

### IMAGES — Core Operations

- [ ] **IMG-01**: Usuario puede subir una imagen (drag-and-drop o click) en formato JPG, PNG, WebP, AVIF, o GIF
- [ ] **IMG-02**: Usuario puede comprimir una imagen con control de calidad (slider 1-100) y ver el tamaño resultante en tiempo real antes de descargar
- [ ] **IMG-03**: Usuario ve comparación antes/después (slider superpuesto) de la imagen original vs. procesada
- [ ] **IMG-04**: Usuario puede redimensionar una imagen definiendo ancho y/o alto en píxeles, con opción de mantener aspect ratio
- [ ] **IMG-05**: Usuario puede convertir el formato de salida de la imagen (JPG, PNG, WebP, AVIF)
- [ ] **IMG-06**: Usuario puede descargar la imagen procesada con un click
- [ ] **IMG-07**: UI muestra tamaño original, tamaño resultado, y % de reducción

### IMAGES — Batch

- [ ] **BATCH-01**: Usuario puede subir hasta 20 imágenes a la vez y configurar las mismas opciones para todas
- [ ] **BATCH-02**: Usuario puede descargar todas las imágenes procesadas como un único archivo ZIP
- [ ] **BATCH-03**: UI muestra progreso del procesamiento batch (ej: "12 / 20 completadas")

### VIDEOS — Core Operations

- [ ] **VID-01**: Usuario puede subir un video (MP4, MOV, WebM, AVI) de hasta 500MB
- [ ] **VID-02**: Usuario puede comprimir un video con control de calidad (CRF) y ver el tamaño estimado resultante
- [ ] **VID-03**: Usuario puede cambiar la resolución del video con presets (4K, 1080p, 720p, 480p)
- [ ] **VID-04**: Usuario puede convertir el formato de salida del video (MP4, WebM, MOV)
- [ ] **VID-05**: Usuario puede recortar el video definiendo tiempo de inicio y fin (trim)
- [ ] **VID-06**: Usuario ve una barra de progreso en tiempo real durante el procesamiento del video (via SSE)
- [ ] **VID-07**: Usuario puede descargar el video procesado cuando el job termina
- [ ] **VID-08**: UI muestra tamaño original, tamaño resultado, y % de reducción

### PRESETS

- [ ] **PRE-01**: Preset "Web Optimizado" — output WebP/AVIF, calidad 80, max 1920px ancho (imágenes)
- [ ] **PRE-02**: Preset "WhatsApp" — imagen 1280px max, <16MB; video 720p H.264, <16MB
- [ ] **PRE-03**: Preset "Discord" — imagen <8MB; video 720p H.264, <10MB
- [ ] **PRE-04**: Preset "Instagram Feed" — imagen 1080x1080 JPG; video 1080x1080 30fps <100MB
- [ ] **PRE-05**: Preset "Instagram Reel" — video 1080x1920 (9:16) 30fps H.264
- [ ] **PRE-06**: Al seleccionar un preset, los controles se pre-populan con la configuración del preset (editable)

### GENERAL / UX

- [ ] **GEN-01**: Herramienta pública, sin login ni registro requerido
- [ ] **GEN-02**: Procesamiento ocurre en el servidor (backend en Render); archivos no se almacenan permanentemente
- [ ] **GEN-03**: HEIC/HEIF bloqueado en frontend con mensaje explicativo ("Convertir a JPG primero")
- [ ] **GEN-04**: Archivos borrados del servidor inmediatamente después de la descarga o tras 30 minutos de inactividad

---

## v2 Requirements (deferred)

- Preview de slider en vivo mientras se ajustan parámetros (requiere procesamiento client-side o API muy rápida)
- Batch de video (múltiples videos con configuración compartida)
- Cancelar job de video en progreso
- Strip de metadata EXIF/GPS (toggle de privacidad)
- Soporte de input HEIC (requiere heic-convert, no incluido en Sharp prebuilts)
- Crop de imágenes con selector visual
- Historial de sesión (últimos archivos procesados, sin persistencia de server)
- Tiempo estimado restante para video
- Resize de video custom (ancho/alto en px)
- Preset Twitter/X
- Preset YouTube

---

## Out of Scope

- Cuentas de usuario / auth — sin valor para una herramienta stateless
- Almacenamiento de archivos en la nube — los archivos no se guardan
- Filtros de video / color grading — fuera del foco de optimización/conversión
- Edición avanzada de imagen (capas, texto, efectos) — eso es Photoshop, no ControlMedia
- AI upscaling — complejidad y costo desproporcionados para v1
- Input por URL o YouTube — problemas de copyright y complejidad
- Creación de GIF — dominio diferente (EZGIF lo hace bien)
- Timeline editor — HandBrake es la referencia, no Premiere

---

## Traceability

| REQ-ID | Phase |
|--------|-------|
| IMG-01 → IMG-07 | Fase 1 (Backend) + Fase 2 (Frontend) |
| BATCH-01 → BATCH-03 | Fase 1 (Backend) + Fase 2 (Frontend) |
| VID-01 → VID-08 | Fase 3 (Backend) + Fase 4 (Frontend) |
| PRE-01 → PRE-06 | Fase 5 |
| GEN-01 → GEN-04 | Transversal — Fase 1 establece base |

---

*Last updated: 2026-05-22 after initialization*
