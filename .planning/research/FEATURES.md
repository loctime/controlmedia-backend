# Feature Landscape: ControlMedia

**Domain:** Browser-based image and video optimization / conversion tool
**Researched:** 2026-05-22
**Competitors studied:** Squoosh, HandBrake, EZGIF, iLoveIMG, iLoveVIDEO, CloudConvert, Convertio, Clideo, Kapwing, TinyPNG, Compressor.io

---

## IMAGE — Table Stakes

Features every image tool must have. Missing = users leave immediately.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Drag-and-drop upload | Universal pattern; Squoosh, TinyPNG, iLoveIMG all use it | Low | Include click-to-browse as fallback |
| Quality/compression slider | Core control knob — users need to see the tradeoff | Low | Range 1–100 or 0–10 buckets (low/med/high) |
| Before/after visual comparison | Squoosh made this the gold standard; users expect it | Medium | Drag-divider overlay is the expected UX pattern |
| File size readout (before vs after) | The #1 metric users care about — KB/MB and % reduction | Low | Show both numbers and delta percentage |
| Output format selection | JPG, PNG, WebP minimum; AVIF expected in 2025 | Low | Sharp supports all natively |
| Resize (pixel dimensions) | Second-most common operation after compression | Low | Width/height with aspect ratio lock |
| Download output | Obvious but the final step — must be instant and named clearly | Low | Filename: `original-name-compressed.ext` |
| Works without login | Any friction kills public tool conversion | None | Already in scope — no auth |
| Multiple format input | Users come with PNG, JPG, WebP, HEIC from phones | Low | Sharp handles HEIC input on backend |

---

## IMAGE — Differentiators

Features users don't expect but that create loyalty and word-of-mouth.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Live preview as slider moves | Quality updates in real-time without re-uploading | High | Requires debounce + fast API response; Squoosh does client-side |
| AVIF output | 50% smaller than JPEG; developers actively want this | Low | Sharp supports AVIF; just expose it |
| Preset targets (WhatsApp, Discord, etc.) | Removes guesswork — huge UX win for non-technical users | Medium | Pre-populate settings, still editable |
| Resize by percentage | "Make it 50% smaller" is intuitive for non-technical users | Low | Alternative to pixel dimensions |
| Metadata strip option | Privacy feature — remove GPS, camera data from photos | Low | Sharp: `.withMetadata(false)` vs `.keepExif()` |
| Estimated savings display | "You'd save 2.3MB across 14 files" before processing | Medium | Batch-level UX improvement |
| Batch processing with ZIP download | iLoveIMG offers it; standalone tools often don't | Medium | Core scope already; ZIP via archiver/jszip |
| Output quality preview score | Show estimated perceptual quality (SSIM or just quality %) | High | SSIM computation adds complexity — defer |

---

## VIDEO — Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Upload video file | Core action — any format users commonly have | Low | MP4, MOV, WebM, AVI minimum |
| Compress / reduce file size | #1 use case — "this is too big to send" | Medium | FFmpeg CRF control (H.264/H.265) |
| Change resolution | "4K → 1080p" or "1080p → 720p" is extremely common | Medium | FFmpeg -vf scale= |
| Format conversion | MP4 ↔ WebM ↔ MOV; users get stuck with wrong format | Medium | FFmpeg -c:v libx264 / libvpx-vp9 |
| Download output | Must be immediate after processing | Low | Stream from /tmp, then delete |
| Progress indicator | Videos take 5–120 seconds; blank screen = user leaves | Medium | SSE or polling endpoint for FFmpeg progress |
| File size readout (before vs after) | Same as images — the key metric | Low | FFprobe before + stat after |
| No watermark | Every watermarked competitor has 1-star reviews about it | None | Just don't add one |

---

## VIDEO — Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Video trim (start/end) | "I only want the first 30 seconds" — extremely common | Medium | FFmpeg -ss and -to flags; needs timeline UI |
| Platform presets (WhatsApp, Instagram, Discord) | Takes the guesswork out of bitrate/resolution for social | Medium | Pre-populate CRF, scale, audio bitrate |
| Audio control (keep/strip/adjust) | Power users want to mute video or boost audio | Medium | `-an` flag to strip; `-af volume=` to boost |
| Before/after file size estimate | "Estimated output: ~12MB" before starting long job | Medium | Rough estimate: duration × target_bitrate / 8 |
| Cancel in-progress job | Long video + bad settings = user wants to stop | Medium | Kill FFmpeg process by job ID |
| Batch video processing | Rare in free tools — major differentiator | High | Queue system needed; complex for v1 |
| WebM output with VP9 | Better quality/size for web embedding than H.264 | Medium | FFmpeg libvpx-vp9; slower to encode |
| Estimated encode time display | "~45 seconds" reduces abandonment during processing | Medium | Rough heuristic from file size + target |

---

## Anti-Features

Things to deliberately NOT build in v1. These add complexity without proportional user value at this stage.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Video filters / color grading | Scope creep; Kapwing's territory; adds weeks of complexity | Keep scope on optimization only |
| Audio track editing / mixing | Full DAW territory; not expected in an optimizer | Strip/keep toggle is enough |
| Video timeline editor | HandBrake alternative use case, not the core | Trim (start/end) is sufficient |
| Cloud storage (save files) | Adds privacy/security surface; complicates architecture | Process and discard immediately |
| User accounts / history | No-auth is a feature, not a bug, for this tool | Rate limiting by IP if abuse occurs |
| AI upscaling | Huge backend cost; GPU required; separate product | Out of scope entirely |
| Social sharing buttons | Not how developers and power users work | Just download |
| Screenshot/frame extraction | Useful but separate feature; EZGIF territory | Phase 2 if demand exists |
| YouTube / URL input | Scraping complexity + legal gray area | File upload only |
| Background removal | Separate AI model; unrelated to optimization | iLoveIMG's territory, not ours |
| GIF creation from video | EZGIF owns this niche; not optimization | Out of scope |
| PDF to image | controlPDF already exists in the ecosystem | Out of scope |

---

## Standard Presets: Exact Specs

These are the presets users expect. Pre-populate settings but allow editing.

### Image Presets

| Preset | Format | Max Dimension | Quality | Max Size | Notes |
|--------|--------|---------------|---------|----------|-------|
| Web Optimized | WebP | 1920px wide | 82% | ~200KB target | JPG fallback if AVIF/WebP refused |
| WhatsApp Photo | JPG | 1280px wide | 80% | ~200KB | WA recompresses anyway; pre-compress for better result |
| Discord Upload | PNG (screenshots) / JPG (photos) | Original or 1280px | 85% | <10MB | Discord preserves under-limit; PNG for sharp edges |
| Twitter / X | JPG | 1600px wide | 85% | <5MB | 1600x900 recommended for landscape |
| Instagram Post | JPG | 1080px | 85% | ~500KB–1MB | 1:1, 4:5, or 16:9 ratio; WxH varies |
| Instagram Story / Reel | JPG | 1080x1920 | 85% | ~1MB | 9:16 ratio is expected |
| Thumbnail | JPG | 1280x720 | 80% | <200KB | YouTube / OG image standard |

### Video Presets

| Preset | Format | Resolution | Bitrate (video) | Audio | Max Size | Notes |
|--------|--------|------------|-----------------|-------|----------|-------|
| Web Optimized | MP4 (H.264) | 1080p | 2 Mbps | AAC 128kbps | — | CRF 23, good balance |
| WhatsApp | MP4 (H.264) | 720p | 1 Mbps | AAC 128kbps | <16MB | H.264 + AAC = universal; keep under 16MB |
| Discord (Free) | MP4 (H.264) | 720p | 2 Mbps | AAC 128kbps | <10MB | Free tier is 10MB hard limit |
| Twitter / X | MP4 (H.264) | 1280x720 | 2 Mbps | AAC 128kbps | <15MB | 140s max; 30fps recommended |
| Instagram Feed | MP4 (H.264) | 1080x1350 | 3.5 Mbps | AAC 128kbps | <650MB | 4:5 portrait recommended |
| Instagram Reel/Story | MP4 (H.264) | 1080x1920 | 5 Mbps | AAC 128kbps | <1GB | 9:16, max 60s for Reels |
| Compress Only (small) | MP4 (H.264) | Original | CRF 28 | AAC 96kbps | — | Aggressive compression, keep resolution |
| Compress Only (balanced) | MP4 (H.264) | Original | CRF 23 | AAC 128kbps | — | FFmpeg default quality |

---

## UX Patterns: How Top Tools Handle Key Interactions

### Before/After Comparison (Images)

**Standard pattern (Squoosh model):**
- Split screen with draggable vertical divider starting at 50%
- Left = original, right = processed
- File size displayed under each panel (e.g., "1.2 MB" / "145 KB — 88% smaller")
- Slider is the drag handle itself, not a separate control

**Simpler pattern (TinyPNG model):**
- No visual comparison — just show the compressed image with before/after file sizes
- "Download" button appears after processing
- Appropriate when preview quality comparison is less critical (e.g., batch mode)

**Recommendation for ControlMedia:** Squoosh-style slider for single file mode. For batch, TinyPNG-style list with per-file size delta.

---

### Progress Indicators (Video)

**What users need:**
1. Immediate acknowledgment that processing started (spinner or progress bar appears within <1s of submit)
2. Percentage progress (FFmpeg reports progress via stderr — parse it)
3. Estimated time remaining (optional but reduces abandonment significantly)
4. Clear success state with file size result before download button appears
5. Cancel button visible during processing

**What causes abandonment:**
- Blank screen or spinner with no %, no ETA
- Progress bar that jumps from 0% to 100% with no intermediate updates
- No feedback for 30+ seconds on large files

**Implementation pattern:** SSE (Server-Sent Events) endpoint that streams FFmpeg progress parsed from stderr `time=` output. Convert to % using total duration from FFprobe.

---

### Batch Processing UX

**Standard pattern (iLoveIMG / TinyPNG model):**
1. Upload multiple files in one drop or click
2. Show file list with per-file status (queued → processing → done)
3. Individual download per file AND "Download All as ZIP" button
4. Total savings summary: "14 files compressed. Saved 23.4 MB total."

**Batch video** is rare in free tools. Most tools (Clideo, CloudConvert free tier) limit to 1 video or small batches. Offering 3–5 videos in batch is already above average.

---

## Format Support Expectations in 2025

### Image Formats

| Format | Input Support | Output Support | Notes |
|--------|---------------|----------------|-------|
| JPEG/JPG | Required | Required | Universal; most common input |
| PNG | Required | Required | Universal; transparency support |
| WebP | Required | Required | Expected in 2025 — 96%+ browser support |
| AVIF | Required (from phones/macOS) | Required | AVIF support now 93%+ globally; 50% smaller than JPEG |
| HEIC/HEIF | Expected as input | Not required as output | iPhones produce HEIC; must convert on upload |
| GIF | Nice to have | Nice to have | For static GIF compression; animated is complex |
| SVG | Out of scope | Out of scope | Text-based; different optimization domain |
| JPEG XL | Low demand | Low demand | Not yet mainstream; defer |
| TIFF | Low demand | Low demand | Pro photography niche; defer |
| BMP | Low demand | No | Legacy only |

**Sharp handles:** JPEG, PNG, WebP, AVIF, HEIC, TIFF natively. GIF needs giflossy/imagemagick workaround.

### Video Formats

| Format | Input Support | Output Support | Notes |
|--------|---------------|----------------|-------|
| MP4 (H.264) | Required | Required | Universal; most common |
| MOV | Required | Nice to have | iPhone default; FFmpeg converts easily |
| WebM (VP8/VP9) | Required | Required | Web embedding; Chrome/Firefox native |
| AVI | Expected as input | Not required as output | Legacy Windows; FFmpeg handles input |
| MKV | Nice to have | Not required | Container; FFmpeg handles |
| HEVC/H.265 | Nice to have as input | Nice to have as output | Apple devices; better quality/size than H.264 |
| 3GP | Out of scope | Out of scope | Old mobile format; niche |
| FLV | Out of scope | Out of scope | Dead format |

---

## Feature Dependencies

```
Image batch processing → ZIP download (required together)
Video compression → Progress indicator (required — video is slow)
Platform presets → Format conversion + Resize (presets compose these)
Video trim → FFprobe duration probe (need duration before trim UI)
Live preview → Fast API + debounce (risky for video; fine for images)
HEIC input → Server-side Sharp (cannot be done client-side)
```

---

## MVP Recommendation

**Build first (highest impact, lowest effort):**
1. Single image: upload → compress → before/after comparison → download
2. Single image: resize (px or %) with aspect ratio lock
3. Single image: format conversion (JPG, PNG, WebP, AVIF)
4. Single video: compress with CRF control
5. Single video: resolution change (presets: 4K, 1080p, 720p, 480p)
6. Single video: progress indicator via SSE
7. Platform presets for both images and videos (WhatsApp, Discord, Twitter, Instagram, Web)

**Build second (high value, moderate complexity):**
8. Batch image processing + ZIP download
9. Video trim (start/end time)
10. Before/after file size comparison in batch list view

**Defer to Phase 2:**
- Live preview as slider moves (requires fast API + streaming)
- Batch video processing (queue complexity)
- Cancel in-progress video job
- Audio controls (strip/adjust)
- HEVC output
- Metadata strip toggle (expose as option)

---

## Competitive Gaps ControlMedia Can Fill

Based on research, these gaps exist in the current free tool landscape:

1. **Combined image + video in one tool** — Squoosh is images-only. EZGIF is GIF-focused. Clideo is video. No polished free tool does both well.
2. **Platform presets with real specs** — Most tools offer generic "low/medium/high" quality. ControlMedia can offer "WhatsApp", "Discord", "Instagram Reel" with exact correct specs.
3. **No watermark + no login** — The most complained-about feature in competitors. ControlMedia's no-auth, no-watermark stance is a genuine differentiator.
4. **Clean UX without ad overload** — EZGIF and most free tools are cluttered with ads. A clean interface is a real differentiator in this space.
5. **AVIF output** — Squoosh does it client-side. Very few server-side tools expose AVIF output in a simple way.

---

## Sources

- Squoosh: https://squoosh.app / https://github.com/GoogleChromeLabs/squoosh
- EZGIF: https://ezgif.com
- iLoveIMG features: https://www.iloveimg.com/features
- CloudConvert vs Convertio: https://www.spotsaas.com/compare/convertio-vs-cloudconvert
- Clideo: https://clideo.com
- Kapwing: https://www.kapwing.com
- Platform specs (images): https://compresso.io/blog/image-size-limits-every-platform-2026
- Platform specs (video): https://sproutsocial.com/insights/social-media-video-specs-guide/
- WhatsApp video specs: https://convertintomp4.com/blog/best-video-format-for-whatsapp
- AVIF/WebP/HEIC browser support: https://www.rumvision.com/blog/modern-image-formats-webp-avif-browser-support/
- Image optimizer UX comparison: https://themeisle.com/blog/best-online-image-optimizer-tools/
- Web image size recommendations: https://kinsta.com/blog/optimize-images-for-web/
- User complaints about converters: https://medium.com/@o8500170/top-7-mistakes-people-make-when-compressing-videos
