# Phase 2: Frontend Image Tool — Research

**Researched:** 2026-05-22
**Domain:** Next.js 16 App Router + React 19 + Tailwind v4 + react-dropzone + react-compare-slider + axios
**Confidence:** HIGH

---

## Summary

Phase 2 builds the browser-side image tool against the already-live Render backend (`https://controlmedia-backend.onrender.com`). The frontend is a single Next.js 16 app deployed to Vercel, where ALL file transfers go browser-to-Render directly — never through any Next.js API route. This constraint is non-negotiable: Vercel's 4.5 MB payload limit would silently kill every real-user upload.

The core data flow is straightforward: user drops files → react-dropzone captures them → axios POSTs FormData to Render with `onUploadProgress` → axios receives binary blob + custom headers → `URL.createObjectURL` makes previews and download links. For the before/after comparison, react-compare-slider receives two blob URLs (one from the original `File` object, one from the processed response). No server-side rendering or Next.js API routes are involved in image processing at all.

State management is `useState` + `useReducer` — no Zustand needed. The per-file state machine (idle → uploading → complete | error) fits neatly into a custom hook. Tailwind CSS v4 is the current standard for Next.js 16; it replaces the three `@tailwind` directives with a single `@import "tailwindcss"` and uses `@tailwindcss/postcss` instead of the old `tailwindcss` PostCSS plugin.

**Primary recommendation:** Scaffold with `npx create-next-app@latest` (TypeScript, App Router, Tailwind, no src dir), wire every upload directly to `NEXT_PUBLIC_BACKEND_URL`, and keep all binary data flows in client components marked `"use client"`.

---

<user_constraints>
## User Constraints (from CLAUDE.md — Phase 2 applicable)

### Locked Decisions (from CLAUDE.md)
- Frontend: Next.js 14+ (App Router) en Vercel
- UI antes/despues: `react-compare-slider@4.0.0`
- Uploads frontend: `axios` (necesario para `onUploadProgress`)
- **NUNCA enrutar uploads a traves de Next.js API routes** — todos los archivos van `browser -> Render` directamente (Vercel 4.5 MB body limit)
- Backend vivo en `https://controlmedia-backend.onrender.com`
- HEIC bloqueado en frontend con mensaje "Convertir a JPG primero"
- Backend responses: single image returns binary with headers `X-Original-Size`, `X-Result-Size`, `X-Reduction-Pct`
- Batch returns a ZIP file (`Content-Type: application/zip`)
- `Access-Control-Expose-Headers` set by backend for size metadata headers

### Claude's Discretion
- Estructura de carpetas interna (componentes, hooks, utils)
- Nombre del proyecto Next.js (sugerido: controlmedia-frontend)
- Estado management: useState/useReducer (sin Zustand — no es necesario para este scope)

### Deferred Ideas (OUT OF SCOPE para Phase 2)
- Live slider preview mientras se ajustan parametros (client-side procesamiento)
- Batch de video
- Cancelar job en progreso
- Strip EXIF/GPS metadata toggle
- Soporte de input HEIC (heic-convert)
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| IMG-01 | Usuario puede subir imagen (drag-and-drop o click) en JPG, PNG, WebP, AVIF, GIF | react-dropzone `useDropzone` con `accept` por MIME type; `getRootProps`/`getInputProps` |
| IMG-02 | Usuario puede comprimir con slider de calidad 1-100 y ver tamano resultante en tiempo real antes de descargar | Range input controlado; estimacion client-side basada en factor de compresion historico; resultado real del servidor en headers |
| IMG-03 | Usuario ve comparacion antes/despues con slider superpuesto | `ReactCompareSlider` con dos blob URLs: `URL.createObjectURL(file)` (original) y `URL.createObjectURL(blob)` (procesado) |
| IMG-04 | Usuario puede redimensionar definiendo ancho y/o alto en pixels, con opcion de mantener aspect ratio | Inputs numericos controlados; `width`/`height` como campos FormData; logica de aspect ratio en el cliente |
| IMG-05 | Usuario puede convertir formato de salida (JPG, PNG, WebP, AVIF) | Select controlado; valor `format` enviado como campo en FormData |
| IMG-06 | Usuario puede descargar imagen procesada con un click | Patron `<a href={blobUrl} download="optimized.webp">` con `URL.revokeObjectURL` post-click |
| IMG-07 | UI muestra tamano original, tamano resultado, y % de reduccion | Leer `X-Original-Size`, `X-Result-Size`, `X-Reduction-Pct` desde `response.headers` de axios |
| BATCH-01 | Usuario puede subir hasta 20 imagenes a la vez con las mismas opciones | `useDropzone` con `maxFiles: 20`; FormData con `.append('files', file)` multiple; `POST /api/images/batch` |
| BATCH-02 | Usuario puede descargar todas como ZIP unico | `axios` con `responseType: 'blob'`; `<a download="optimized.zip">` |
| BATCH-03 | UI muestra progreso del batch ("12 / 20 completadas") | El endpoint batch devuelve un ZIP unico — el progreso es de subida (`onUploadProgress`), no por archivo; mostrar "Subiendo..." con % y luego "Procesando..." |
| GEN-03 | HEIC/HEIF bloqueado en frontend con mensaje explicativo | `validator` prop en `useDropzone` + check `file.type === 'image/heic'` y `/.heic$/i` en `file.name` |
</phase_requirements>

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Drag-and-drop upload | Browser / Client | — | react-dropzone opera en el cliente; sin servidor involucrado |
| HEIC gate | Browser / Client | — | Bloqueo antes de subir; evita ronda de red innecesaria |
| Upload progress (%) | Browser / Client | — | axios `onUploadProgress` via XHR — solo disponible en el cliente |
| Image processing (compress/resize/convert) | API / Backend (Render) | — | Sharp pipeline vive en el backend; no hay procesamiento de imagen en Vercel |
| Before/after comparison | Browser / Client | — | react-compare-slider, dos blob URLs locales |
| Size readout (original/result/%) | Browser / Client | API / Backend | Headers calculados por el backend, leidos por el cliente |
| Batch ZIP download | Browser / Client | API / Backend | Backend genera el ZIP; cliente recibe blob y dispara descarga |
| Vercel deploy / CDN | CDN / Static | Frontend Server (SSR) | Static assets + Next.js SSR para el shell de la app |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `next` | 16.2.6 | Framework React + App Router + deploy a Vercel | Framework oficial del proyecto; v16 es latest stable mayo 2026 |
| `react` | 19.2.6 | UI rendering | Peer dep de Next.js 16 |
| `react-dom` | 19.2.6 | DOM bindings | Peer dep de Next.js 16 |
| `react-dropzone` | 15.0.0 | Drag-and-drop upload zone | Libreria estandar del ecosistema React para dropzones; 10+ anos activa |
| `react-compare-slider` | 4.0.0 | Slider antes/despues | Especificada en CLAUDE.md; activamente mantenida, cero dependencias externas |
| `axios` | 1.16.1 | HTTP con `onUploadProgress` | Especificada en CLAUDE.md; unica manera de trackear progreso de subida (Fetch API no expone upload progress) |
| `tailwindcss` | 4.3.0 | Estilos utilitarios | Incluido por defecto en `create-next-app`; v4 es actual en mayo 2026 |
| `@tailwindcss/postcss` | (peer de tailwindcss v4) | Plugin PostCSS para Tailwind v4 | Reemplaza el antiguo plugin `tailwindcss` en postcss.config.mjs |

[VERIFIED: npm registry] — todos verificados via `npm view` en mayo 2026 y confirmados OK por slopcheck.

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| TypeScript | (incluido en create-next-app) | Type safety | Por defecto en el scaffold; usar en todo el proyecto |
| `postcss` | (peer de tailwindcss) | Procesador CSS | Requerido por Tailwind v4 en Next.js |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `react-dropzone` | HTML5 `<input type="file" multiple>` nativo | Nativo es mas simple pero no tiene drag-and-drop, preview de rechazo, ni `accept` MIME robusto |
| `axios` | `fetch` con `XMLHttpRequest` manual | fetch no expone `onUploadProgress`; XHR manual es mas codigo y error-prone |
| Tailwind CSS | CSS Modules o styled-components | Tailwind esta preconfigurado en create-next-app; sin beneficio en cambiar para este scope |
| `useState` / `useReducer` | Zustand | Zustand es overhead innecesario para state de una sola pagina sin comunicacion entre ramas distantes |

**Installation:**
```bash
npx create-next-app@latest controlmedia-frontend --typescript --eslint --app --tailwind --no-src-dir --import-alias "@/*"
cd controlmedia-frontend
npm install react-dropzone react-compare-slider axios
```

**Version verification:** Todos los packages verificados via `npm view <pkg> version` el 2026-05-22:
- `next`: 16.2.6 (publicado 2026-05-07)
- `react-dropzone`: 15.0.0 (publicado 2026-02-10)
- `react-compare-slider`: 4.0.0 (publicado 2026-03-20)
- `axios`: 1.16.1 (publicado 2026-05-13)
- `tailwindcss`: 4.3.0 (publicado 2026-05-08)

---

## Package Legitimacy Audit

> Todos los packages verificados con slopcheck 2026-05-22. Resultado: 7/7 OK.

| Package | Registry | Age | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-------------|-----------|-------------|
| `next` | npm | ~15 anos (2011) | github.com/vercel/next.js | [OK] | Approved |
| `react` | npm | ~13 anos (2013) | github.com/facebook/react | [OK] | Approved |
| `react-dom` | npm | ~13 anos (2013) | github.com/facebook/react | [OK] | Approved |
| `react-dropzone` | npm | ~12 anos (2014) | github.com/react-dropzone/react-dropzone | [OK] | Approved |
| `react-compare-slider` | npm | ~7 anos (2019) | github.com/nerdyman/react-compare-slider | [OK] | Approved |
| `axios` | npm | ~11 anos (2014) | github.com/axios/axios | [OK] | Approved |
| `tailwindcss` | npm | ~9 anos (2017) | github.com/tailwindlabs/tailwindcss | [OK] | Approved |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

---

## Architecture Patterns

### System Architecture Diagram

```
Browser (Next.js 16 en Vercel)
  |
  |  "use client" components
  |
  +-- DropZone (react-dropzone)
  |     |  File objects + blob URLs para preview original
  |     v
  +-- ImageOptionsPanel (sliders, inputs, selects)
  |     |  quality, format, width, height como estado React
  |     v
  +-- [Submit] axios.post() con FormData
  |     |  onUploadProgress -> progreso barra subida
  |     |  responseType: 'blob' (imagen unica) o 'blob' (ZIP)
  |     |
  |     | HTTP POST directo al backend Render
  |     | (NUNCA a traves de /api/ routes de Next.js)
  |     v
  +--  Render Express (https://controlmedia-backend.onrender.com)
  |     POST /api/images/process  -> binario + headers X-*
  |     POST /api/images/batch    -> application/zip
  |     |
  |     v
  +-- axios response
  |     blob -> URL.createObjectURL -> <img src> (processed preview)
  |     headers['x-original-size'], headers['x-result-size'], headers['x-reduction-pct']
  |
  +-- BeforeAfterSlider (react-compare-slider)
  |     itemOne: URL.createObjectURL(originalFile)   <- sin subir
  |     itemTwo: URL.createObjectURL(responseBlob)   <- del servidor
  |
  +-- SizeReadout
  |     originalSize | resultSize | reductionPct
  |
  +-- DownloadButton
        <a href={blobUrl} download="optimized.webp">Descargar</a>
        -> URL.revokeObjectURL(blobUrl) en cleanup
```

### Recommended Project Structure

```
controlmedia-frontend/
├── app/
│   ├── layout.tsx          # Root layout con metadata
│   ├── page.tsx            # Landing page / tool selector
│   ├── globals.css         # @import "tailwindcss"
│   └── image-tool/
│       └── page.tsx        # Pagina herramienta de imagenes
├── components/
│   ├── DropZone.tsx        # react-dropzone wrapper, HEIC gate
│   ├── ImageOptionsPanel.tsx  # quality slider, resize inputs, format select
│   ├── BeforeAfterSlider.tsx  # react-compare-slider wrapper
│   ├── SizeReadout.tsx     # muestra X-Original-Size, X-Result-Size, %
│   ├── DownloadButton.tsx  # trigger descarga blob
│   ├── BatchFileList.tsx   # lista batch + contador "12 / 20"
│   └── ProgressBar.tsx     # barra de progreso upload/procesamiento
├── hooks/
│   ├── useImageProcessor.ts   # logica upload single image
│   └── useBatchProcessor.ts   # logica upload batch -> ZIP
├── lib/
│   └── api.ts              # axios instance con NEXT_PUBLIC_BACKEND_URL
├── types/
│   └── image.ts            # FileJob, ProcessOptions, ProcessResult types
├── public/
├── next.config.ts
├── postcss.config.mjs      # { "@tailwindcss/postcss": {} }
├── tailwind.config.ts      # solo si se necesitan customizations (v4 lo necesita minimo)
├── tsconfig.json
└── .env.local              # NEXT_PUBLIC_BACKEND_URL=https://controlmedia-backend.onrender.com
```

### Pattern 1: useDropzone con HEIC gate y accept MIME

**What:** react-dropzone `useDropzone` hook con `accept` por MIME type y `validator` custom para rechazar HEIC.
**When to use:** Siempre que haya upload de archivos de imagen — reemplaza `<input type="file">` nativo.

```typescript
// Source: react-dropzone official examples (github.com/react-dropzone/react-dropzone)
"use client";
import { useDropzone, FileRejection } from 'react-dropzone';

const ACCEPTED_TYPES = {
  'image/jpeg':  ['.jpg', '.jpeg'],
  'image/png':   ['.png'],
  'image/webp':  ['.webp'],
  'image/avif':  ['.avif'],
  'image/gif':   ['.gif'],
};

// HEIC validator separado — NO incluirlo en accept para que llegue al validator
function heicValidator(file: File) {
  const isHeic =
    file.type === 'image/heic' ||
    file.type === 'image/heif' ||
    /\.(heic|heif)$/i.test(file.name);
  if (isHeic) {
    return {
      code: 'heic-not-supported',
      message: 'Formato HEIC no soportado. Convertir a JPG primero.',
    };
  }
  return null;
}

const { getRootProps, getInputProps, isDragActive, fileRejections } = useDropzone({
  accept: ACCEPTED_TYPES,
  maxFiles: 20,          // para batch; usar 1 para single-image mode
  validator: heicValidator,
  onDropAccepted: (files) => handleFiles(files),
  onDropRejected: (rejections: FileRejection[]) => {
    // rejections[i].errors[j].message tiene el mensaje del validator
  },
});
```

**Pitfall:** El `accept` prop en react-dropzone no bloquea HEIC si el browser reporta `type: ''` para .heic — por eso se necesita el `validator` custom que tambien chequea `file.name`. Usar AMBAS protecciones (accept + validator).

### Pattern 2: axios upload directo a Render con progreso

**What:** `axios.post()` con `FormData`, `onUploadProgress`, y `responseType: 'blob'`. NUNCA a traves de Next.js API routes.
**When to use:** Toda subida de imagen — single y batch.

```typescript
// Source: axios official docs (axios-http.com) — [CITED]
"use client";
import axios from 'axios';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

async function uploadImage(
  file: File,
  options: { quality: number; format: string; width?: number; height?: number },
  onProgress: (pct: number) => void
) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('quality', String(options.quality));
  formData.append('format', options.format);
  if (options.width)  formData.append('width',  String(options.width));
  if (options.height) formData.append('height', String(options.height));

  const response = await axios.post(
    `${BACKEND_URL}/api/images/process`,
    formData,
    {
      responseType: 'blob',  // la respuesta es binario, no JSON
      onUploadProgress: ({ loaded, total, progress }) => {
        // `progress` es 0-1; `loaded` y `total` son bytes
        onProgress(Math.round((progress ?? loaded / total!) * 100));
      },
    }
  );

  return {
    blob:         response.data as Blob,
    originalSize: Number(response.headers['x-original-size']),
    resultSize:   Number(response.headers['x-result-size']),
    reductionPct: Number(response.headers['x-reduction-pct']),
  };
}
```

**Pitfall clave:** `responseType: 'blob'` es correcto para imagenes. Si se usa `'arraybuffer'`, hay que convertir a Blob manualmente antes de `createObjectURL`. Usar `'blob'` directamente.

### Pattern 3: Leer headers custom cross-origin

**What:** El backend expone `Access-Control-Expose-Headers: X-Original-Size, X-Result-Size, X-Reduction-Pct`. El cliente los lee con `response.headers['x-original-size']` (lowercase siempre).
**When to use:** Despues de cada request exitoso a `/api/images/process`.

```typescript
// [ASSUMED] — patron estandar HTTP; funciona porque el backend ya setea Access-Control-Expose-Headers
const originalSize = Number(response.headers['x-original-size']);
const resultSize   = Number(response.headers['x-result-size']);
const reductionPct = Number(response.headers['x-reduction-pct']);
```

**Pitfall:** Los nombres de headers HTTP son case-insensitive en el protocolo, pero axios los normaliza a **lowercase** en `response.headers`. Siempre usar lowercase al leer. Si el valor llega `NaN`, el backend no expuso el header — verificar `Access-Control-Expose-Headers`.

### Pattern 4: URL.createObjectURL para preview y descarga

**What:** Crear blob URLs temporales para mostrar imagenes y disparar descargas. Revocar siempre en cleanup.
**When to use:** Preview original (del `File` object), preview procesado (del blob de respuesta), boton de descarga.

```typescript
// Source: MDN Web Docs — URL.createObjectURL() — [CITED: developer.mozilla.org]

// Preview del archivo original (sin subir):
const originalUrl = URL.createObjectURL(file);
// <img src={originalUrl} /> o pasar a ReactCompareSlider

// Preview del resultado (despues de la respuesta del servidor):
const processedBlob: Blob = response.data;
const processedUrl = URL.createObjectURL(processedBlob);

// Disparar descarga:
function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);  // liberar memoria inmediatamente
}

// Cleanup en useEffect:
useEffect(() => {
  return () => {
    if (originalUrl) URL.revokeObjectURL(originalUrl);
    if (processedUrl) URL.revokeObjectURL(processedUrl);
  };
}, [originalUrl, processedUrl]);
```

### Pattern 5: react-compare-slider con blob URLs

**What:** Pasar dos blob URLs como `src` a `ReactCompareSliderImage`.
**When to use:** Cuando el usuario ya tiene resultado procesado — no mostrar antes.

```typescript
// Source: react-compare-slider README (github.com/nerdyman/react-compare-slider) — [CITED]
import { ReactCompareSlider, ReactCompareSliderImage } from 'react-compare-slider';

<ReactCompareSlider
  itemOne={
    <ReactCompareSliderImage
      src={originalUrl}   // URL.createObjectURL(file)
      alt="Original"
      style={{ objectFit: 'contain' }}  // evitar distorsion si aspect ratios difieren
    />
  }
  itemTwo={
    <ReactCompareSliderImage
      src={processedUrl}  // URL.createObjectURL(responseBlob)
      alt="Procesado"
      style={{ objectFit: 'contain' }}
    />
  }
  defaultPosition={50}
/>
```

### Pattern 6: Batch upload a /api/images/batch

**What:** FormData con multiples archivos bajo la misma key `'files'`, descarga blob ZIP.

```typescript
// [ASSUMED] — basado en API del backend definida en Phase 1
async function uploadBatch(
  files: File[],
  options: ProcessOptions,
  onProgress: (pct: number) => void
) {
  const formData = new FormData();
  files.forEach(f => formData.append('files', f));  // key 'files' — igual que multer upload.array('files', 20)
  formData.append('quality', String(options.quality));
  formData.append('format', options.format);

  const response = await axios.post(
    `${BACKEND_URL}/api/images/batch`,
    formData,
    {
      responseType: 'blob',
      onUploadProgress: ({ progress }) => {
        // Durante batch, onUploadProgress refleja la subida de los 20 archivos
        // El procesamiento server-side no se reporta — mostrar "Procesando..." post-subida
        onProgress(Math.round((progress ?? 0) * 100));
      },
    }
  );

  return response.data as Blob;  // ZIP blob
}
```

**Nota sobre progreso batch (BATCH-03):** El endpoint batch es sincrono desde el punto de vista del frontend — el servidor recibe todos los archivos, los procesa, y devuelve el ZIP en una sola respuesta. No hay contador "12 / 20 completadas" real a menos que haya SSE. Para v1, la UX debe ser:
- Upload: progreso real via `onUploadProgress`
- Procesamiento: spinner / "Procesando N imagenes..."
- Completado: boton "Descargar ZIP"

Si el planner quiere un contador "12 / 20" real, requiere cambiar el endpoint backend para devolver progreso parcial (SSE o polling) — esto esta fuera del scope de Phase 2.

### Pattern 7: Tailwind CSS v4 en Next.js 16

**What:** v4 reemplaza las tres directivas `@tailwind` con un solo `@import "tailwindcss"` y usa `@tailwindcss/postcss` en lugar del plugin antiguo.

```css
/* app/globals.css — [VERIFIED: tailwindcss.com/docs/guides/nextjs] */
@import "tailwindcss";
```

```javascript
// postcss.config.mjs — [VERIFIED: tailwindcss.com/docs/guides/nextjs]
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};
export default config;
```

`create-next-app` con `--tailwind` genera esto automaticamente. No se necesita `tailwind.config.ts` para Tailwind v4 a menos que se quieran customizaciones del tema (fuentes custom, colores de marca, etc.).

### Pattern 8: Variables de entorno Next.js para BACKEND_URL

**What:** Variables `NEXT_PUBLIC_*` se incrustan en el bundle del cliente durante el build.

```bash
# .env.local (NO se commitea, solo para dev local)
NEXT_PUBLIC_BACKEND_URL=http://localhost:3001

# .env.production o en Vercel dashboard
NEXT_PUBLIC_BACKEND_URL=https://controlmedia-backend.onrender.com
```

```typescript
// uso en componentes cliente
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL!;
```

**Pitfall:** `NEXT_PUBLIC_BACKEND_URL` se incrusta en el build (static). Si se cambia en Vercel, hay que redeployar. El valor de desarrollo (localhost) NUNCA llega a produccion si se gestiona correctamente via Vercel dashboard.

### Anti-Patterns to Avoid

- **Upload a traves de Next.js API route:** Provoca 413 `FUNCTION_PAYLOAD_TOO_LARGE` en produccion para imagenes > 4.5 MB. Siempre `browser -> Render` directo.
- **fetch() para upload con progress:** `fetch` no expone `onUploadProgress`. Usar `axios`.
- **`responseType: 'arraybuffer'` cuando se necesita Blob:** Arraybuffer requiere conversion manual a Blob; usar `responseType: 'blob'` directamente.
- **No revocar Object URLs:** Leak de memoria en SPAs. Siempre `URL.revokeObjectURL()` en cleanup de `useEffect`.
- **Headers en UPPERCASE:** axios normaliza headers a lowercase. `response.headers['X-Original-Size']` sera `undefined`; usar `response.headers['x-original-size']`.
- **Mostrar BeforeAfterSlider antes de tener resultado:** El slider requiere dos URLs validas. Renderizar condicionalmente solo cuando `processedUrl !== null`.
- **Estado global (Zustand) para una sola pagina:** Sobrecarga innecesaria. `useState` + `useReducer` en un custom hook es suficiente.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Drag-and-drop file zone | Listeners `dragover`/`drop` manuales | `react-dropzone` `useDropzone` | Maneja todos los edge cases: mobile tap, directory drop, MIME type filter, `FileRejection` objects, accesibilidad |
| Before/after image slider | `<div>` con resize manual + JavaScript | `react-compare-slider` | Maneja touch/mouse events, keyboard accessibility, responsive, sin deps externas |
| Upload con progress tracking | XHR manual con `onprogress` | `axios` con `onUploadProgress` | API limpia, interceptors, cancelacion, timeout handling incluidos |
| Trigger descarga de blob | IFrame tricks, anchor con data URI | `URL.createObjectURL` + `<a download>` + `revokeObjectURL` | Patron estandar del browser; funciona para blobs de cualquier tamano |
| MIME type validation | Regex en extension | `react-dropzone` `accept` + `validator` custom | react-dropzone valida tanto MIME como extension; maneja discordancias iOS/Android |

**Key insight:** Los tres problemas mas tentadores de reimplementar (dropzone, slider, upload progress) tienen soluciones de libreria maduras que manejan docenas de edge cases de browser que un custom implementation ignoraria.

---

## Common Pitfalls

### Pitfall 1: Upload a traves de Vercel (4.5 MB limit)
**What goes wrong:** Crear un `app/api/upload/route.ts` y enrutar el FormData ahi antes de mandarlo a Render. En produccion, cualquier imagen real (> 4.5 MB) falla con `FUNCTION_PAYLOAD_TOO_LARGE`.
**Why it happens:** Los developers asumen que tienen que "esconder" la URL del backend detras de su propia API.
**How to avoid:** La URL de Render puede ser publica — CORS en el backend ya la protege. `NEXT_PUBLIC_BACKEND_URL` va directo al Render backend.
**Warning signs:** `413` solo en produccion, funciona localmente con imagenes de prueba pequenas.

### Pitfall 2: Headers custom no visibles cross-origin
**What goes wrong:** `response.headers['x-original-size']` devuelve `undefined` aunque el header existe en el servidor.
**Why it happens:** CORS requiere que el servidor incluya `Access-Control-Expose-Headers: X-Original-Size, X-Result-Size, X-Reduction-Pct`. Si ese header falta, el browser bloquea el acceso a los custom headers.
**How to avoid:** Verificado en Phase 1: el backend ya setea `Access-Control-Expose-Headers` en el route handler `/api/images/process`. Confirmar que tambien esta en `/api/images/batch` si se necesitan ahi.
**Warning signs:** `Number(response.headers['x-original-size'])` devuelve `NaN`.

### Pitfall 3: HEIC pasa por el accept pero es rechazado tarde
**What goes wrong:** `accept: { 'image/*': [...] }` en react-dropzone puede aceptar `.heic` en iOS porque el browser reporta MIME type como `''` o `'application/octet-stream'`.
**Why it happens:** iOS Safari no asigna MIME type correcto a archivos HEIC cuando se eligen desde Fotos.
**How to avoid:** Usar `validator` prop en `useDropzone` que chequea TANTO `file.type` como `file.name` con `/\.(heic|heif)$/i`. Ver Pattern 1.
**Warning signs:** Test en iOS — subir foto de camara, ver si pasa la validacion.

### Pitfall 4: Object URL leak en hot-reload / unmount
**What goes wrong:** Cada `URL.createObjectURL()` crea una referencia que el browser mantiene hasta que se llama `revokeObjectURL` o se cierra la tab. En una app con muchas imagenes procesadas, esto crece indefinidamente.
**How to avoid:** Siempre retornar un cleanup en `useEffect`:
```typescript
useEffect(() => () => {
  if (previewUrl) URL.revokeObjectURL(previewUrl);
}, [previewUrl]);
```
**Warning signs:** Uso de memoria del tab crece con cada imagen procesada en DevTools Memory tab.

### Pitfall 5: react-compare-slider con imagenes de distinto aspect ratio
**What goes wrong:** Si el usuario sube una imagen 4:3 y la convierte a 16:9 (via resize con solo ancho especificado), el slider se ve roto — una imagen aparece recortada o con letterbox.
**How to avoid:** Usar `style={{ objectFit: 'contain' }}` en ambos `ReactCompareSliderImage`. Esto garantiza que ambas imagenes se muestren completas dentro del contenedor.
**Warning signs:** El slider muestra una imagen cortada cuando hay cambio de dimensiones.

### Pitfall 6: Render free tier cold start durante la primera subida
**What goes wrong:** El backend tarda 30-60 segundos en despertar. El usuario hace click en "Procesar", no pasa nada durante un minuto, y abandona.
**How to avoid:** En `useEffect` de la pagina principal (o en `layout.tsx`), hacer un `fetch(${BACKEND_URL}/health)` silencioso al cargar la pagina para "calentar" el backend. Esto no bloquea nada — solo dispara el wake-up proactivamente.
```typescript
useEffect(() => {
  fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/health`).catch(() => {});
}, []);
```
**Warning signs:** Primera subida del dia tarda mucho; las siguientes son rapidas.

### Pitfall 7: Batch progress counter ("12 / 20") no es posible sin cambios de backend
**What goes wrong:** El planner puede planear un contador en tiempo real de cuantas imagenes del batch se procesaron, asumiendo que el frontend puede saberlo.
**Why it happens:** El endpoint `POST /api/images/batch` procesa todo en el servidor y devuelve el ZIP completo. No hay informacion parcial durante el procesamiento.
**How to avoid:** El "progreso" visible para el batch es solo el progreso de SUBIDA (via `onUploadProgress`). Una vez subido, mostrar "Procesando..." hasta que llegue el ZIP. Para un contador real "12 / 20", se necesitaria SSE en el backend — fuera de scope.

---

## Code Examples

### Estructura de estado para un FileJob

```typescript
// types/image.ts — [ASSUMED]
type FileJob = {
  id: string
  file: File
  originalUrl: string           // URL.createObjectURL(file) — para preview
  status: 'idle' | 'uploading' | 'processing' | 'complete' | 'error'
  uploadProgress: number        // 0-100
  processedUrl: string | null   // URL.createObjectURL(blob) — post-respuesta
  originalSize: number | null   // bytes — del archivo original
  resultSize: number | null     // bytes — del header X-Result-Size
  reductionPct: number | null   // % — del header X-Reduction-Pct
  error: string | null
}
```

### Scaffold de Next.js con variable de entorno del backend

```typescript
// lib/api.ts — [ASSUMED]
import axios from 'axios';

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_BACKEND_URL,
});
```

### Vercel deploy — no se necesita vercel.json para Next.js standard

Vercel auto-detecta Next.js. Solo configurar en el dashboard:
- `NEXT_PUBLIC_BACKEND_URL` = `https://controlmedia-backend.onrender.com`
- Build Command: `next build` (auto-detectado)
- Output Directory: `.next` (auto-detectado)

Un `vercel.json` es necesario SOLO si se requieren rewrites, redirects, o headers custom. Para esta app, no se necesita.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `@tailwind base; @tailwind components; @tailwind utilities;` | `@import "tailwindcss"` | Tailwind v4 (2025) | Cambiar `globals.css` al crear el proyecto |
| `tailwind.config.js` obligatorio | Auto-detection en v4, config opcional | Tailwind v4 (2025) | Menos archivos de config |
| `postcss.config.js` con plugin `tailwindcss` | `postcss.config.mjs` con `@tailwindcss/postcss` | Tailwind v4 (2025) | Cambiar el nombre del plugin |
| `next@14` con React 18 | `next@16` con React 19 | Mayo 2026 | Server Components mejorados, mejor Suspense — no afecta este proyecto directamente |
| `create-next-app` con pages router | App Router por defecto | Next.js 13+ | Este proyecto usa App Router |

**Deprecated/outdated:**
- `fluent-ffmpeg`: Archivado mayo 2025 — ya excluido en CLAUDE.md, irrelevante para Phase 2 (frontend only)
- Tailwind v3 config en postcss (`tailwindcss` plugin): Reemplazado por `@tailwindcss/postcss` en v4

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js >= 20 | Next.js 16 | Verificar al crear proyecto | — | Actualizar a Node 20 LTS |
| npm | Instalar deps | Asumido disponible | — | — |
| Vercel CLI o dashboard | Deploy | Via dashboard (sin CLI necesario) | — | — |
| `https://controlmedia-backend.onrender.com` | Todas las operaciones de imagen | Verificar con GET /health antes de deploy | — | Dev local apuntando a localhost:3001 |

**Missing dependencies with no fallback:** ninguna para el scaffolding inicial.

**Missing dependencies with fallback:**
- Backend Render puede estar en cold start — frontend hace warmup ping en page load (ver Pitfall 6).

---

## Validation Architecture

> `workflow.nyquist_validation` no encontrado en config — tratado como enabled.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | No existe config de tests en el frontend aun — Wave 0 debe agregar Jest + Testing Library o Vitest |
| Config file | Pendiente crear (`jest.config.ts` o `vitest.config.ts`) |
| Quick run command | `npm test -- --testPathPattern <file>` (Jest) o `npx vitest run <file>` (Vitest) |
| Full suite command | `npm test` o `npx vitest run` |

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| IMG-01 | Dropzone acepta JPG/PNG/WebP/AVIF/GIF | unit | `npx vitest run tests/DropZone.test.tsx` | Wave 0 |
| GEN-03 | HEIC rechazado con mensaje correcto | unit | `npx vitest run tests/DropZone.test.tsx` | Wave 0 |
| IMG-02 | Quality slider actualiza estado correctamente | unit | `npx vitest run tests/ImageOptionsPanel.test.tsx` | Wave 0 |
| IMG-07 | SizeReadout muestra valores de headers | unit | `npx vitest run tests/SizeReadout.test.tsx` | Wave 0 |
| BATCH-01 | maxFiles=20 rechaza archivo 21 | unit | `npx vitest run tests/DropZone.test.tsx` | Wave 0 |
| IMG-03 | BeforeAfterSlider renderiza con dos URLs | unit | `npx vitest run tests/BeforeAfterSlider.test.tsx` | Wave 0 |
| IMG-06 | triggerDownload crea y revoca object URL | unit | `npx vitest run tests/DownloadButton.test.tsx` | Wave 0 |
| Upload flow E2E | POST va a Render no a /api | manual-only | — | N/A — requiere red real |

**Justificacion manual-only para upload flow:** Requiere el backend Render en vivo o un mock server completo. Para Phase 2, smoke test manual con el backend real es suficiente.

### Sampling Rate
- **Per task commit:** `npx vitest run` (todos los unit tests existentes)
- **Per wave merge:** `npx vitest run` full suite
- **Phase gate:** Full suite green + smoke test manual contra backend Render antes de `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/DropZone.test.tsx` — cubre IMG-01, GEN-03, BATCH-01
- [ ] `tests/ImageOptionsPanel.test.tsx` — cubre IMG-02, IMG-04, IMG-05
- [ ] `tests/SizeReadout.test.tsx` — cubre IMG-07
- [ ] `tests/BeforeAfterSlider.test.tsx` — cubre IMG-03
- [ ] `tests/DownloadButton.test.tsx` — cubre IMG-06
- [ ] Framework install: `npm install -D vitest @testing-library/react @testing-library/user-event jsdom` + `vitest.config.ts`

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Sin auth — herramienta publica |
| V3 Session Management | no | Sin sesiones |
| V4 Access Control | no | Sin recursos protegidos |
| V5 Input Validation | yes | react-dropzone `accept` + `validator`; limites de tamano en dropzone (`maxSize`) |
| V6 Cryptography | no | Sin datos sensibles en transito que requieran cifrado adicional (HTTPS ya lo cubre) |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Upload de archivo malicioso (content spoofing) | Tampering | Backend ya valida MIME en multer; frontend bloquea extension `.heic` — defensa en profundidad |
| XSS via nombre de archivo en preview | Tampering | Nunca insertar `file.name` como `innerHTML`; usar `textContent` o React (auto-escapa) |
| Object URL leak memory exhaustion | Denial of Service (self) | `URL.revokeObjectURL` en cada cleanup de `useEffect` |
| CORS bypass tentativa | Tampering | Backend con regex CORS ya maneja esto; frontend no tiene control adicional necesario |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | El progreso batch (`onUploadProgress`) refleja solo la subida, no el procesamiento server-side | Pattern 6, Pitfall 7 | Si el planner planea un contador "12/20" en tiempo real, necesita SSE en backend |
| A2 | `Access-Control-Expose-Headers` esta seteado correctamente en `/api/images/batch` tambien (no solo en `/api/images/process`) | Pattern 3 | Si no, `x-original-size` seria `undefined` en batch (aunque batch devuelve ZIP, no headers de tamano de imagen individual) |
| A3 | El plan de Vercel sin `vercel.json` es suficiente (auto-detect) | Code Examples secccion | Si Next.js 16 requiere config especifica, agregar `vercel.json` |

**Nota:** A2 es de bajo riesgo porque el endpoint batch devuelve ZIP, no los headers de tamano individuales — esos solo aplican a `/api/images/process`.

---

## Open Questions

1. **Contador "12 / 20 completadas" en batch (BATCH-03)**
   - What we know: El endpoint batch es sincrono desde la perspectiva del frontend — devuelve un ZIP cuando todos los archivos estan procesados.
   - What's unclear: Si BATCH-03 requiere un contador en tiempo real (no de subida), se necesitaria SSE en el backend para este endpoint — lo que no esta en scope de Phase 2.
   - Recommendation: Implementar BATCH-03 como progreso de subida (0-100% de la subida) + "Procesando N imagenes..." post-subida. Documentar en el plan que el conteo real "12/20" requiere cambio de backend.

2. **Warmup ping del backend — donde colocarlo**
   - What we know: El backend Render en free tier tarda 30-60s en despertar.
   - What's unclear: Si el layout.tsx de Next.js (server component) puede hacer el ping, o si debe ser un `useEffect` en un client component.
   - Recommendation: Usar un pequeño `<BackendWarmup />` client component en `layout.tsx` que hace el fetch en `useEffect` del lado del cliente — sin bloquear el render.

---

## Sources

### Primary (HIGH confidence)
- [react-dropzone official examples](https://github.com/react-dropzone/react-dropzone/blob/master/examples/accept/README.md) — accept prop format, validator, fileRejections API
- [react-compare-slider README](https://github.com/nerdyman/react-compare-slider/blob/main/README.md) — ReactCompareSlider props, ReactCompareSliderImage
- [Tailwind CSS v4 + Next.js guide](https://tailwindcss.com/docs/guides/nextjs) — postcss.config.mjs, globals.css `@import "tailwindcss"`
- [MDN: URL.createObjectURL](https://developer.mozilla.org/en-US/docs/Web/API/URL/createObjectURL_static) — blob URL pattern, revokeObjectURL
- npm registry (via `npm view`) — versiones verificadas 2026-05-22: next@16.2.6, react-dropzone@15.0.0, react-compare-slider@4.0.0, axios@1.16.1, tailwindcss@4.3.0
- slopcheck audit — 7/7 packages OK

### Secondary (MEDIUM confidence)
- [axios request config](https://axios.rest/pages/advanced/request-config) — `responseType`, `onUploadProgress` con `progress` 0-1
- [Next.js App Router docs](https://nextjs.org/docs/app/getting-started/installation) — estructura de proyecto, `NEXT_PUBLIC_` env vars

### Tertiary (LOW confidence)
- WebSearch results sobre Next.js + Tailwind v4 setup 2026 — corroborado con docs oficiales

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — todos los packages verificados via npm registry + slopcheck
- Architecture patterns: HIGH — basado en CLAUDE.md constraints + research oficial de Phase 1 + docs oficiales de librerias
- Pitfalls: HIGH — la mayoria documentados en Phase 1 research (PITFALLS.md) mas nuevos especificos del frontend
- BATCH-03 real-time counter: LOW — requiere confirmacion del planner sobre expectativas de UX

**Research date:** 2026-05-22
**Valid until:** 2026-06-22 (30 dias — stack estable; tailwindcss y next se actualizan frecuente pero sin breaking changes menores)
