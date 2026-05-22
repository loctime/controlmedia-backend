---
status: partial
phase: 02-frontend-image-tool
source: [02-VERIFICATION.md]
started: 2026-05-22
updated: 2026-05-22
---

## Current Test

[awaiting human testing]

## Tests

### 1. Slider visual before/after

expected: El handle de ReactCompareSlider arranca al 50% y se puede arrastrar izquierda/derecha sin distorsión visual, mostrando original vs. procesada correctamente superpuestas
result: [pending]

### 2. BackendWarmup en producción

expected: Con NEXT_PUBLIC_BACKEND_URL configurado en Vercel, al cargar la página aparece un GET /health en DevTools Network tab
result: [pending]

### 3. Progress bar en tiempo real durante upload

expected: Al subir un archivo real, la barra de progreso avanza de 0% a 100% con múltiples actualizaciones (no salta directo al 100%)
result: [pending]

### 4. Batch end-to-end contra backend real

expected: Subir 2-5 imágenes, ver barra de subida + "Procesando N imágenes…", descargar ZIP y verificar que contiene todas las imágenes procesadas
result: [pending]

### 5. Variable de entorno en Vercel

expected: .env.local está gitignoreado; NEXT_PUBLIC_BACKEND_URL existe en el panel de Vercel y apunta a https://controlmedia-backend.onrender.com
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps
