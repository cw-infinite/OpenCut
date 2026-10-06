# BUILD SPEC: Local Free Video Editor (CapCut-style) for Windows

> **Audience:** an LLM coding agent that will build this product end to end.
> **Owner/user:** one person, personal use, Windows 10/11 desktop.
> Read §0–§3 fully before writing any code. Everything in §2 and §3 is a **final decision**; do not re-open it or ask about it.

---

## 0. Instructions to the builder (LLM)

1. Build **milestone by milestone** (§9). Do not start milestone N+1 until N's acceptance checklist passes. After each milestone, give the owner exact commands to run and what to click to verify.
2. Do not ask clarifying questions unless blocked. When something is ambiguous, pick the simplest option consistent with this spec and note it in `docs/DECISIONS.md`.
3. **Everything must run locally and free.** No cloud APIs, no API keys, no accounts, no telemetry, no paid SDKs, no subscriptions. If a feature seems to need one, implement a local alternative or skip the feature and list it in `docs/SKIPPED.md`.
4. Prefer boring, well-known libraries. Keep every source file under ~400 lines; split by responsibility.
5. Put pure logic (time math, timeline operations, FFmpeg argument builders, animation math, caption chunking) in framework-free TypeScript modules with unit tests (Vitest). UI code stays thin.
6. When modifying an existing large file, show targeted diffs with clear location markers rather than re-dumping the whole file.
7. Never claim something works without running it. Run `npm run typecheck`, `npm test`, and launch the app at the end of each milestone.
8. Do not copy CapCut's UI artwork, icons, names, or assets. Original UI only. Name the app **"LocalCut"** (placeholder; owner may rename).
9. Verify tool CLI flags (`ffmpeg`, `whisper-cli`) against the installed binary's `--help` before relying on them; flag names change between versions.

---

## 1. Product summary

LocalCut is a Windows desktop video editor that gives the owner CapCut's most-used features without paying for CapCut Pro: a multi-track timeline, animated text, auto-generated captions from audio, audio mixing, transitions/filters, and export of the whole edit as **one compiled video at selectable quality**. All processing happens on the owner's PC. Projects are local files.

**Must-have features (owner's explicit list):**
1. Export the edited sequence as one compiled video in different qualities.
2. Auto-generate captions from audio (English).
3. Add text with different effects and animations.
4. Add audio files (music, voiceover, SFX) to the timeline.
5. Other commonly used CapCut features (listed in §7).

---

## 2. Hard constraints (non-negotiable)

| # | Constraint |
|---|---|
| C1 | Platform: **Windows 10/11 x64 desktop app** (Electron). Not web-hosted, not mobile. |
| C2 | 100% local processing. Works fully offline after the one-time tool/model download in M0. |
| C3 | 100% free: no paid services, no API keys, no watermark, no resolution or feature gating. |
| C4 | No user accounts, no cloud sync, no network calls during normal use. |
| C5 | Max export resolution for v1: **1080p**. (Architecture must not preclude 4K later.) |
| C6 | Captions: **English only**. |
| C7 | Target hardware: mid-range laptop/desktop (e.g., 4+ cores, 8–16 GB RAM, integrated or entry GPU). No low-end or mobile support. |
| C8 | Personal use only; no installer signing, auto-update, or store packaging required. A portable build (`npm run package`) is enough. |

---

## 3. Fixed technology decisions

| Concern | Decision |
|---|---|
| Shell | **Electron** (latest stable) + **electron-vite** template |
| UI | **React 18 + TypeScript (strict)** + Vite |
| State | **Zustand** with **immer**; undo/redo via patch history (immer `produceWithPatches`) |
| Styling | Tailwind CSS (core utilities); dark theme default |
| Preview rendering | Single **compositor** drawing to a `<canvas>` (Canvas 2D first; keep the interface swappable for WebGL later) |
| Source decoding for preview/export | `HTMLVideoElement` on **frame-accurate proxy files** (see §6.1) |
| Media tooling | **FFmpeg + FFprobe** via npm `ffmpeg-static` and `ffprobe-static` (GPL builds are fine: personal use, not redistributed) |
| Export pipeline | Compositor renders frames → raw RGBA piped to FFmpeg stdin; audio mixed by an FFmpeg filtergraph; muxed to MP4 (see §6.4) |
| Encoders | `libx264` always; auto-detect and prefer `h264_nvenc` / `h264_qsv` / `h264_amf` if a test encode succeeds |
| Speech-to-text | **whisper.cpp** prebuilt Windows CLI (`whisper-cli.exe`, CPU build) + GGML model `ggml-base.en.bin` (default) and `ggml-small.en.bin` (optional, "higher accuracy"). Downloaded once by `npm run setup:tools` from GitHub releases / Hugging Face. |
| Fonts | `@fontsource/*` npm packages (SIL OFL): Inter, Roboto, Montserrat, Poppins, Oswald, Anton, Bebas Neue, Lobster, Pacifico, Permanent Marker, Playfair Display, Roboto Mono. Plus all installed Windows system fonts via the Local Font Access API or a main-process font list. |
| Audio waveform/peaks | FFmpeg decodes to mono 8 kHz PCM → peaks array cached on disk |
| Audio preview | One `HTMLAudioElement`/`<video>` per active clip, synced to the playhead, volume computed per frame (fades/keyframes). Export audio is authoritative. |
| Persistence | Project = a folder under `%APPDATA%/LocalCut/projects/<id>/` containing `project.json`, `proxies/`, `peaks/`, `thumbs/`, `captions/`. Original media is **referenced by absolute path, not copied**. |
| Testing | Vitest (unit), Playwright for Electron (a few smoke tests) |
| Package manager | npm |

**Why these choices (so you don't second-guess):** Electron gives a Chromium renderer (canvas, WebAudio, `<video>`) plus native child processes, so FFmpeg/whisper.cpp run as real executables. This is more robust and faster than in-browser WASM, and plays to React/TypeScript skills.

---

## 4. Repository layout

```
localcut/
  package.json
  electron.vite.config.ts
  scripts/setup-tools.ts            # downloads whisper-cli + models into /resources/tools
  resources/tools/                  # ffmpeg is from npm; whisper-cli.exe + models land here
  src/
    main/                           # Electron main process (Node)
      index.ts
      ipc/                          # IPC handlers: media, project, export, captions, fonts
      services/
        ffmpeg.ts                   # spawn helpers, probe, proxy, peaks, thumbnails
        exportRunner.ts             # runs an export job, pipes frames, reports progress
        whisper.ts                  # runs whisper-cli, parses JSON
        encoders.ts                 # hardware encoder detection
        projectStore.ts             # read/write project folder, autosave, recovery
    preload/index.ts                # contextBridge API (typed)
    renderer/
      app/                          # shell, layout, panels
      state/                        # zustand stores, history
      engine/                       # PURE logic, no React
        time.ts  timeline.ts  keyframes.ts  easing.ts
        compositor.ts  textLayout.ts  textAnimations.ts
        captions.ts  audioGraph.ts  ffmpegArgs.ts
      ui/                           # media panel, timeline, preview, inspector, export dialog
    shared/types.ts                 # Project/Clip/etc. types shared by main + renderer
  docs/ DECISIONS.md  SKIPPED.md
  tests/
```

---

## 5. Core data model (authoritative; put in `shared/types.ts`)

**Time:** all times are **integer microseconds** (`type Us = number`). Convert to frames only at render: `frame = Math.round(t * fps / 1_000_000)`. Never store floating seconds.

```ts
type Us = number;

interface Project {
  id: string; name: string; version: 1;
  settings: { width: number; height: number; fps: number; sampleRate: 48000 };
  media: Record<string, MediaAsset>;
  tracks: Track[];                  // index 0 = bottom of the visual stack
  markers: { id: string; time: Us; label: string }[];
  captionStyles: Record<string, TextStyle>;   // user-saved presets
}

interface MediaAsset {
  id: string; path: string;         // absolute path of original
  kind: 'video' | 'audio' | 'image';
  duration: Us; width?: number; height?: number; fps?: number;
  hasAudio: boolean; rotation?: number;
  proxyPath?: string; peaksPath?: string; thumbDir?: string;
  status: 'importing' | 'ready' | 'error';
}

interface Track {
  id: string; kind: 'video' | 'audio' | 'text';   // 'video' tracks hold video/image/sticker clips
  name: string; locked: boolean; hidden: boolean; muted: boolean;
  clips: Clip[];                    // non-overlapping within a track, sorted by start
}

type Clip = MediaClip | TextClip;

interface ClipBase {
  id: string; trackId: string;
  start: Us; duration: Us;          // placement on the timeline
  transform: Transform;             // animatable
  opacity: Animatable<number>;      // 0..1
  effects: EffectInstance[];
  transitionIn?: Transition;        // applies at clip start (overlaps previous clip)
}

interface MediaClip extends ClipBase {
  type: 'media'; mediaId: string;
  sourceIn: Us; sourceOut: Us;      // trim window in source time
  speed: number;                    // 0.1..100, constant (curve in P1)
  reverse: boolean;
  volume: Animatable<number>;       // 0..4 (linear gain), default 1
  fadeIn: Us; fadeOut: Us;          // audio fades
  muted: boolean;
  fit: 'fit' | 'fill' | 'stretch';  // default 'fit' with blurred-background option
  blurBackground: boolean;
  crop: { l: number; t: number; r: number; b: number };   // 0..1 fractions
  filter?: { preset: string; intensity: number };
  adjust: { brightness: number; contrast: number; saturation: number; temperature: number; vignette: number; sharpen: number };
}

interface TextClip extends ClipBase {
  type: 'text';
  content: string;                  // plain text; \n allowed
  style: TextStyle;
  animIn?: TextAnimation; animOut?: TextAnimation; animLoop?: TextAnimation;
  caption?: { words: { text: string; start: Us; end: Us }[] };  // present for auto-caption clips
}

interface Transform {
  x: Animatable<number>; y: Animatable<number>;          // canvas-normalized center, 0..1 (0.5,0.5 = center)
  scale: Animatable<number>; rotation: Animatable<number>; // rotation in degrees
}

type Animatable<T> = { value: T; keyframes: Keyframe<T>[] };   // keyframes sorted by time (clip-relative Us)
interface Keyframe<T> { time: Us; value: T; easing: 'linear'|'easeIn'|'easeOut'|'easeInOut'|'hold'|{bezier:[number,number,number,number]} }

interface TextStyle {
  fontFamily: string; fontSize: number;       // px at 1080p reference height; scale with canvas
  weight: 400|500|600|700|800|900; italic: boolean;
  color: string; align: 'left'|'center'|'right';
  lineHeight: number; letterSpacing: number;
  stroke?: { color: string; width: number };
  shadow?: { color: string; blur: number; offsetX: number; offsetY: number };
  glow?: { color: string; blur: number };
  background?: { color: string; opacity: number; paddingX: number; paddingY: number; radius: number };
  gradient?: { from: string; to: string; angle: number };
  maxWidthFraction: number;                   // wrap width as fraction of canvas width
}

interface TextAnimation {
  preset: string;                              // key into textAnimations registry (§7.4)
  duration: Us;                                // for in/out; for loop = one cycle
  easing: Keyframe<number>['easing'];
  granularity: 'whole' | 'line' | 'word' | 'char';
  stagger: Us;                                 // delay between units when granularity != whole
}

interface Transition { type: 'fade'|'dissolve'|'slideLeft'|'slideRight'|'slideUp'|'slideDown'|'wipeLeft'|'wipeRight'|'zoomIn'|'zoomOut'|'blur'|'flash'; duration: Us }
interface EffectInstance { type: string; params: Record<string, number | string>; enabled: boolean }
```

**Invariants (enforce in `timeline.ts` with tests):** clips on a track never overlap (except the transition-overlap rule, §7.5); `sourceOut - sourceIn = duration * speed`; `duration > 0`; all times integers; clip ids unique.

---

## 6. Key technical designs (implement exactly)

### 6.1 Import and proxies
On import of a video file:
1. `ffprobe -show_streams -show_format -of json` → fill `MediaAsset` (duration, size, fps, rotation, audio presence).
2. Generate a **proxy** with FFmpeg: constant frame rate (project fps or source fps rounded to 24/25/30/50/60), max 1920×1080 preserving aspect (apply rotation), H.264 **all-intra** (`-g 1` or `-intra`), high quality (`-crf 14`), `yuv420p`, AAC audio, `+faststart`. Reason: makes `<video>.currentTime` seeking frame-accurate and fast, and normalizes variable-frame-rate phone footage.
3. Generate thumbnails (1 per ~1 s, 160 px tall) and an audio peaks file.
4. Run steps 2–3 in the background with a progress indicator; the asset is usable on the timeline only when `status === 'ready'`.
Audio-only files: peaks only (and a converted WAV/AAC proxy if the browser can't play the format). Images: no proxy; load directly.

### 6.2 Compositor (`engine/compositor.ts`)
Pure function-ish API: `renderFrame(ctx, project, t, resources): void`.
- Draw order: tracks bottom→top; within a track by start time. Skip hidden tracks.
- For each active clip at `t`: compute source time `sourceIn + (t - clip.start) * speed` (reversed if `reverse`); evaluate animatable properties at clip-relative time; draw to an offscreen canvas with transform, crop, fit mode, adjust/filter/effects, opacity; composite to the main canvas.
- Transitions: when two clips on the same track overlap by the transition duration, render both to offscreen canvases and blend with the transition function.
- Text clips: layout via `textLayout.ts` (word wrap, per-glyph positions), apply animation parameters per unit (§7.4), draw with stroke/shadow/glow/background.
- **The preview and the exporter must call the same `renderFrame`.** This guarantees preview ≈ export.
- Preview resolution is selectable (Full/Half/Quarter) by scaling the canvas, not the project.

### 6.3 Playback engine
- Master clock = `performance.now()`-driven playhead while playing; each rAF tick: update the playhead, `renderFrame`, and sync media elements (`currentTime` correction only when drift > ~80 ms to avoid stutter).
- Use `video.requestVideoFrameCallback` where possible; when paused or scrubbing, seek and await `seeked` before drawing.
- Maintain a pool of video elements keyed by clip id; pre-seek the next clip ~1 s before its start.

### 6.4 Export pipeline (`exportRunner.ts` + hidden renderer window)
Inputs: project JSON, range (start,end), settings `{width,height,fps,quality,videoCodec,encoderPreference,audioBitrate,outputPath}`.
1. Main creates a **hidden BrowserWindow** (so the editing UI stays responsive) that loads the same compositor and the project.
2. Build the **audio mix** first with FFmpeg: for each audible clip create an input with `-ss/-t`, `atempo` chain for speed (ranges 0.5–2.0 per filter; chain for others), `areverse` if reversed, `volume` (use `volume` with expression or pre-split segments for keyframes), `afade` in/out, `adelay` to timeline position, then `amix=normalize=0` (or sum then `alimiter`), output `mix.wav` (48 kHz stereo). Muted/hidden tracks excluded. Audio from video clips comes from the **original file** (not the proxy) when available.
3. Start FFmpeg for video: `-f rawvideo -pix_fmt rgba -s WxH -r FPS -i pipe:0 -i mix.wav -map 0:v -map 1:a -c:v <encoder> <quality args> -pix_fmt yuv420p -c:a aac -b:a <audioBitrate> -movflags +faststart -shortest out.mp4`.
4. Hidden window loop: for `i` in `0..totalFrames-1`: `t = round(i*1e6/fps)`; seek/prepare sources; `renderFrame` at export size; `getImageData` → transfer ArrayBuffer to main via IPC → write to FFmpeg stdin **respecting backpressure** (`drain`). Report progress `{frame,total,fps,etaSeconds}` every ~250 ms.
5. Cancel: kill FFmpeg, close the window, delete the partial file. Failure: surface FFmpeg stderr tail in the UI.
6. Quality mapping (libx264 `-preset medium`): Low `crf 28`, Medium `crf 23`, High `crf 19`, Maximum `crf 15`; hardware encoders use `-cq`/`-global_quality` equivalents tuned to similar quality; "Custom" = explicit video bitrate in Mbps (`-b:v`).
7. Resolution presets (height; width follows project aspect, rounded to even): 480, 720, 1080. FPS: 24, 25, 30, 50, 60. Audio: AAC 128/192/256/320 kbps.
8. **Batch export:** the export dialog allows ticking several resolutions; jobs run sequentially from a queue.
9. Optional "burn captions" is automatic because captions are text clips. "Export SRT" writes a sidecar from caption clips.

### 6.5 Auto-captions pipeline (`whisper.ts`)
1. User selects a clip (or "whole timeline"). Main extracts audio with FFmpeg → `16 kHz mono PCM WAV` (mixing all audible audio in the selected range for "whole timeline").
2. Run `whisper-cli.exe -m <model> -f <wav> -l en` with JSON output including **word-level timestamps** (verify exact flags in `--help`; e.g., `--output-json-full` and per-word splitting such as `--max-len 1 --split-on-word`). Stream progress from stdout/stderr to the UI.
3. Parse to `{text,start,end}[]` words. Offset by the selected clip's timeline start and account for clip `speed`.
4. **Chunk words into caption lines** (`engine/captions.ts`, pure + tested): break on punctuation (`. ? ! ,` when line ≥ min length), max chars per line (default 32), max 2 lines, max words per caption (default 6 for "short-form" mode), min duration 400 ms, max duration 5 s, no gaps shorter than 80 ms (extend previous).
5. Create one `TextClip` per caption on a new text track named "Captions", each carrying `caption.words` for karaoke highlighting; apply the chosen caption style preset.
6. Caption panel: list of captions with inline edit, merge/split, delete, retime (drag in timeline), find/replace, restyle-all.
7. Import `.srt`; export `.srt`.
8. Model files are loaded from `resources/tools/models/`; if missing, show a button that runs the downloader.

---

## 7. Functional requirements

Priority: **P0** = required for the owner's first usable version, **P1** = next, **P2** = optional/later. Each milestone in §9 lists which IDs it delivers.

### 7.1 Projects & media
| ID | Requirement | P |
|---|---|---|
| PRJ-1 | New/open/rename/duplicate/delete project; project list with last-edited time | P0 |
| PRJ-2 | Project settings: aspect ratio presets (9:16, 16:9, 1:1, 4:5) + custom; resolution up to 1080p long edge; fps 24/25/30/50/60 | P0 |
| PRJ-3 | Autosave every 5 s and on changes; crash recovery on next launch | P0 |
| PRJ-4 | Import by file picker and drag-and-drop: MP4, MOV, MKV, WebM, AVI; MP3, WAV, M4A, AAC, OGG, FLAC; JPG, PNG, WebP, GIF (static) | P0 |
| PRJ-5 | Media panel: thumbnail, name, duration, resolution; search; delete from library (warn if used) | P0 |
| PRJ-6 | Relink missing media | P1 |
| PRJ-7 | Record microphone voiceover directly onto an audio track; record screen/webcam | P1 |

### 7.2 Timeline & editing
| ID | Requirement | P |
|---|---|---|
| TL-1 | Multiple video tracks, audio tracks, and text tracks; add/remove/reorder/rename | P0 |
| TL-2 | Drag media from library to a track; drag clips to move (across tracks of same kind) | P0 |
| TL-3 | Split at playhead; trim by dragging clip edges; delete; ripple delete | P0 |
| TL-4 | Snapping to playhead, clip edges, markers (toggle) | P0 |
| TL-5 | Zoom (Ctrl+wheel), horizontal scroll, "fit to project"; thumbnails on video clips; waveforms on audio | P0 |
| TL-6 | Undo/redo (≥100 steps), multi-select, copy/paste/duplicate | P0 |
| TL-7 | Keyboard: Space play/pause, S split, Delete, ←/→ frame step, Shift+←/→ 1 s, Home/End, Ctrl+Z/Y, Ctrl+C/V/D, +/- zoom, M marker, I/O in/out points | P0 |
| TL-8 | Detach audio from video clip; link/unlink; lock/hide/mute tracks | P0 |
| TL-9 | Freeze frame, reverse clip, duplicate | P1 |
| TL-10 | Auto-remove silence in a clip (using FFmpeg `silencedetect`, then split/delete) | P1 |
| TL-11 | Markers with labels; group/ungroup | P1 |

### 7.3 Transform, speed, keyframes
| ID | Requirement | P |
|---|---|---|
| XF-1 | Inspector + on-canvas handles for position, scale, rotation, opacity, crop, flip; fit/fill/stretch; blurred-background fill | P0 |
| XF-2 | Keyframes on position, scale, rotation, opacity, volume: add/move/delete in inspector and timeline; easing per keyframe | P0 |
| XF-3 | Constant speed 0.1×–100× (audio pitch-preserved via `atempo` chain in export) | P0 |
| XF-4 | Speed ramp curve with presets (montage, hero, bullet, flash in/out) and editable points | P1 |
| XF-5 | Bézier easing editor for keyframes | P1 |
| XF-6 | Stabilization (FFmpeg `vidstab` or `deshake`) applied at proxy time | P2 |
| XF-7 | Motion tracking for text/stickers (OpenCV.js or a simple template tracker) | P2 |

### 7.4 Text, titles, animation (owner priority)
| ID | Requirement | P |
|---|---|---|
| TXT-1 | Add text at playhead on a text track; edit on canvas (double-click) and in inspector | P0 |
| TXT-2 | Styling: font family, size, weight, italic, color, alignment, line height, letter spacing | P0 |
| TXT-3 | Effects: stroke, shadow, glow, background box (padding/radius), gradient fill, opacity | P0 |
| TXT-4 | **In animations** (`animIn`): `fade`, `slideUp`, `slideDown`, `slideLeft`, `slideRight`, `pop` (scale overshoot), `zoomIn`, `typewriter`, `bounce`, `blurIn`, `rotateIn`, `wipe` | P0 |
| TXT-5 | **Out animations** (`animOut`): mirrored versions of the in set | P0 |
| TXT-6 | **Loop animations** (`animLoop`): `pulse`, `wiggle`, `float`, `shake`, `flicker`, `colorCycle` | P1 |
| TXT-7 | Animation options: duration, easing, granularity (whole/line/word/char), stagger | P0 |
| TXT-8 | Text style presets (bold title, lower third, quote, subtitle, neon, comic, outline) and "save my style" | P1 |
| TXT-9 | Stickers/shapes/arrows/emoji as image clips using the same animation system (bundle a small CC0 set; user can import PNG/SVG/GIF) | P1 |
| TXT-10 | Text keyframes via the shared transform keyframe system | P0 |
| TXT-11 | Curved text, text-on-path, video-fill text | P2 |

**Text animation implementation:** `textAnimations.ts` exports a registry `preset → (unit, progress 0..1, ctx) => { dx, dy, scale, rotation, opacity, blur, visibleChars?, colorShift? }`. The compositor evaluates per unit (char/word/line/whole) with `unitProgress = clamp((localT - unitIndex*stagger) / duration)` after easing. In = progress 0→1 over the first `duration` of the clip; out = 1→0 over the last `duration`; loop = periodic function over the whole clip. Include unit tests for boundary values.

### 7.5 Transitions, filters, effects
| ID | Requirement | P |
|---|---|---|
| TR-1 | Transitions between adjacent clips on a track (drag handle to set duration): fade, dissolve, slide ×4, wipe ×2, zoom in/out, blur, flash | P1 |
| TR-2 | "Apply default transition to all cuts" | P1 |
| FX-1 | Filter presets (CSS/canvas color matrices or small `.cube` LUT support) with intensity: e.g., Vivid, Warm, Cool, B&W, Vintage, Cinematic, Faded | P1 |
| FX-2 | Adjustments: brightness, contrast, saturation, temperature, vignette, sharpen | P1 |
| FX-3 | Effects: gaussian blur, glitch/RGB-split, shake, zoom pulse, VHS, mirror, pixelate, film grain (apply to clip) | P1 |
| FX-4 | Blend modes (multiply, screen, overlay, add) and masks (rect/circle/linear with feather, invert) | P1 |
| FX-5 | Chroma key (key color, similarity, smoothness, spill) via a small WebGL/canvas pixel shader | P1 |
| FX-6 | Background removal (local ONNX model, e.g., MediaPipe selfie segmentation or u2net via `onnxruntime-node`/web) | P2 |
| FX-7 | Smart reframe (subject-centered crop 16:9→9:16) | P2 |
| FX-8 | Picture-in-picture presets (corner snap, rounded corners, border, shadow) | P1 |

### 7.6 Audio
| ID | Requirement | P |
|---|---|---|
| AUD-1 | Add audio files to audio tracks; waveform; trim/split/move | P0 |
| AUD-2 | Per-clip volume (0–400%), mute, track mute/solo, master volume | P0 |
| AUD-3 | Fade in/out handles on clips | P0 |
| AUD-4 | Volume keyframes | P0 |
| AUD-5 | Extract/detach audio from video clips | P0 |
| AUD-6 | Auto-ducking: lower selected music track while speech clips are active (computed from clip activity or Whisper timings), with attack/release | P1 |
| AUD-7 | Beat detection → markers; "snap cuts to beat" (FFmpeg + simple onset detection in TS) | P1 |
| AUD-8 | Noise reduction (FFmpeg `afftdn`/`arnndn` with bundled free model) and loudness normalize (`loudnorm`) as clip effects applied at export | P1 |
| AUD-9 | EQ presets, pitch shift/voice effects, reverb/echo (FFmpeg filters) | P2 |
| AUD-10 | Audio-only export (MP3/WAV/AAC) | P1 |
| AUD-11 | Free music/SFX: ship no copyrighted audio; include a folder `assets/audio/` the owner can fill; optionally a tiny CC0 starter pack | P1 |

### 7.7 Captions (see §6.5 for the pipeline)
| ID | Requirement | P |
|---|---|---|
| CAP-1 | Auto-generate captions from a clip/timeline range, offline, English | P0 |
| CAP-2 | Caption list editor (edit text, merge/split, delete, retime, find/replace) | P0 |
| CAP-3 | Caption style presets incl. animated ones: karaoke word-highlight (active word color/scale), word-by-word pop-in, box-highlight, outline-bold "short-form" style | P0 |
| CAP-4 | Chunking controls: max chars/line, max lines, max words, position (top/middle/bottom) | P0 |
| CAP-5 | Import/export `.srt` | P0 |
| CAP-6 | Model choice: base.en (fast) / small.en (more accurate) | P1 |
| CAP-7 | Filler-word ("um", "uh") detection and one-click cut | P1 |
| CAP-8 | Transcript-based editing (delete words → cut video) | P2 |
| CAP-9 | Local text-to-speech (Piper, free) producing an audio clip from text | P2 |
| CAP-10 | Translation, other languages, speaker labels | **Dropped** (C6) |

### 7.8 Export (owner priority; implementation §6.4)
| ID | Requirement | P |
|---|---|---|
| EXP-1 | Export entire timeline or in/out range as **one MP4** with all tracks mixed | P0 |
| EXP-2 | Resolution: 480p / 720p / 1080p (aspect follows project) | P0 |
| EXP-3 | FPS: 24 / 25 / 30 / 50 / 60 | P0 |
| EXP-4 | Quality presets: Low / Medium / High / Maximum, plus Custom bitrate (Mbps) | P0 |
| EXP-5 | Audio: AAC at 128/192/256/320 kbps | P0 |
| EXP-6 | Hardware encoder auto-detect (NVENC/QSV/AMF) with fallback to libx264; user can force software | P0 |
| EXP-7 | Progress bar, ETA, cancel; export runs in a hidden window so editing stays usable | P0 |
| EXP-8 | Estimated file size shown from settings | P1 |
| EXP-9 | **Batch/multi-quality export** (e.g., 1080p + 720p + 480p in one click) | P1 |
| EXP-10 | Platform presets (YouTube 1080p30 16:9, Shorts/TikTok/Reels 1080×1920 30fps, WhatsApp small) | P1 |
| EXP-11 | Export current frame as PNG/JPG; choose a cover frame | P1 |
| EXP-12 | Export `.srt`; audio-only export | P0 / P1 |
| EXP-13 | WebM/GIF/MOV outputs | P2 |
| EXP-14 | 2K/4K (do **not** implement now; keep resolution a parameter) | P2 |

### 7.9 UI/UX
| ID | Requirement | P |
|---|---|---|
| UX-1 | Layout: left panel (Media / Text / Audio / Effects / Transitions / Captions tabs), center preview, right inspector, bottom timeline | P0 |
| UX-2 | Player controls: play/pause, frame step, loop, fullscreen, preview quality, safe-area guides, current time / duration | P0 |
| UX-3 | Dark theme (default) + light theme | P0 |
| UX-4 | Inspector shows only tabs relevant to the selected clip (Video, Audio, Speed, Animation, Adjust, Text) | P0 |
| UX-5 | Right-click context menus; drag-and-drop; tooltips with shortcuts | P0 |
| UX-6 | Background task tray (importing, captioning, exporting) with progress | P0 |
| UX-7 | First-run setup screen that checks tools/models and offers the one-time download | P0 |

---

## 8. Non-functional requirements

| ID | Requirement |
|---|---|
| NFR-1 | Preview ≥ 24 fps for a 1080p, 5-track project at "Half" preview quality on a mid-range laptop; timeline interactions respond < 100 ms |
| NFR-2 | Export: 1080p30 H.264 completes in ≤ 2× real time on CPU for typical edits; faster with hardware encoding |
| NFR-3 | Captioning: 5 min of speech with `base.en` on CPU finishes in under ~5 min; show progress |
| NFR-4 | A/V sync drift < 1 frame over 1 hour of export |
| NFR-5 | Memory: never load full videos into RAM; stream frames; cap decoded-frame caches |
| NFR-6 | No network access except the explicit one-time tool download (user-triggered) |
| NFR-7 | Renderer sandboxed with `contextIsolation: true`, `nodeIntegration: false`; all file/process access via typed IPC in preload |
| NFR-8 | Crash safety: autosave; export writes to a temp file then renames on success |
| NFR-9 | Exported MP4 plays in Windows Media Player/Movies & TV, VLC, and uploads to YouTube/TikTok/Instagram without re-encoding errors (`yuv420p`, `+faststart`, even dimensions) |

---

## 9. Milestones (build in this order)

Each milestone ends with: `npm run typecheck && npm test` green, app launches, and the checklist verified manually.

### M0 — Scaffold & tools
Electron + electron-vite + React + TS strict + Tailwind + Zustand + Vitest. Typed IPC bridge. `scripts/setup-tools.ts` downloads `whisper-cli.exe` + `ggml-base.en.bin` (+ optional small) to `resources/tools/`. `ffmpeg-static`/`ffprobe-static` wired up. First-run check screen (UX-7).
**Accept:** `npm run dev` opens a window; "Tools OK" shows FFmpeg version and whisper presence; a test IPC call runs `ffmpeg -version`.

### M1 — Projects, import, media library (PRJ-1..5, PRJ-3)
Project CRUD + autosave; import with probe, proxy, thumbnails, peaks; media panel.
**Accept:** import a 1080p phone video (VFR) and an MP3; both show thumbnails/waveform; proxy plays and seeks frame-accurately; app restart restores the project.

### M2 — Timeline + preview (TL-1..8, UX-1..6, XF-1 basic)
Timeline UI, clip operations, snapping, zoom, undo/redo, compositor v1 (video+image, transform, fit modes), playback engine with synced audio.
**Accept:** drag 3 clips onto a track, split/trim/move/delete, undo/redo works; playback is smooth with audio in sync; scrubbing shows the right frame.

### M3 — Export MVP (EXP-1..7, EXP-12 srt) ← first end-to-end product
Hidden export window, frame pipe, audio filtergraph (volume, fades, speed, delay, amix), encoder detection, progress/cancel, temp-file rename.
**Accept:** the M2 project exports to MP4 at 720p and 1080p; opens in VLC with correct picture, audio sync, duration; cancel works and leaves no partial file; preview vs. exported frame at t=2 s are visually identical.

### M4 — Keyframes, speed, transitions, reverse/freeze (XF-2, XF-3, TL-9, TR-1, TR-2)
**Accept:** animate scale+position over 2 s with easing; 0.5× and 2× speed exports have correct duration and pitch-correct audio; a dissolve between two clips appears in export.

### M5 — Text & animation (TXT-1..8, TXT-10)
Text layout, styles/effects, animation registry, presets, inspector UI.
**Accept:** create a title with stroke+shadow+background; apply `pop` in, `slideDown` out, `pulse` loop; char-by-char `typewriter`; export matches preview; unit tests cover animation boundaries (progress 0 and 1).

### M6 — Audio features (AUD-1..8, AUD-10)
Volume keyframes, fades handles, ducking, beat markers, noise reduction, loudnorm, audio-only export, voiceover recording.
**Accept:** music auto-ducks under a speech clip; fade handles audible in export; audio-only MP3 export works.

### M7 — Auto-captions (CAP-1..7)
Pipeline §6.5, caption list editor, animated presets, SRT import/export.
**Accept:** a 2-minute English speech clip yields caption clips whose timings match speech within ~200 ms; karaoke highlight follows words; editing caption text updates preview; SRT export opens in VLC; captions burn into the exported MP4.

### M8 — Filters, effects, masks, chroma key, PiP (FX-1..5, FX-8)
**Accept:** each effect visible in preview and export; chroma key removes a green background cleanly on a sample clip.

### M9 — Export polish & presets (EXP-8..11, TL-10, TL-11, PRJ-6, PRJ-7)
Batch multi-quality export queue, platform presets, file-size estimate, frame export, silence removal, relink, recording.
**Accept:** one click exports 1080p+720p+480p files sequentially; "TikTok" preset yields 1080×1920/30 fps.

### M10 — Optional (P2): background removal, stabilization, tracking, smart reframe, TTS (Piper), transcript editing. Only if M0–M9 are solid.

---

## 10. Testing requirements

- **Unit (Vitest):** `time.ts` conversions; timeline ops (split/trim/move/ripple/snap, overlap invariants, speed/duration invariant); keyframe interpolation + easing; text animation boundary values; caption chunking (edge cases: no punctuation, very long words, tiny gaps); `ffmpegArgs.ts` builders (golden-string tests for audio filtergraphs incl. speed chains outside 0.5–2×, reverse, fades, delay); SRT parse/format.
- **Integration (Node):** generate tiny test media with FFmpeg `lavfi` (color bars + sine); run probe → proxy → peaks; run an export of a 2-second two-clip project and assert duration ±1 frame via ffprobe.
- **Smoke (Playwright Electron):** launch, create project, import fixture, add to timeline, export, file exists.
- **Golden frame test:** render frame N via compositor in preview mode and via export path; compare with a small pixel tolerance.
- **Media corpus to test manually:** VFR phone clip, portrait rotated clip, clip with no audio, odd resolution (e.g., 1366×768), 60 fps clip, 1+ hour audio file, PNG with transparency.

---

## 11. Explicitly out of scope / dropped (do not build)

Cloud rendering/AI, accounts, sync, collaboration, template marketplace, stock-media services, generative AI (video/image/music), voice cloning, auto-translation, non-English captions, mobile/tablet/web builds, 4K/8K/HDR/ProRes/AV1, direct upload to platforms, auto-update, store packaging, telemetry.

---

## 12. Setup & run commands (target for `package.json`)

```
npm install
npm run setup:tools     # downloads whisper-cli.exe + models (one-time, needs internet)
npm run dev             # run the app in development
npm test                # unit + integration tests
npm run typecheck
npm run package         # produce a portable Windows build in /dist
```

---

## 13. Definition of done (whole product)

The owner can, fully offline and without paying for anything: import several clips and music, arrange them on a multi-track timeline, add animated styled text, generate English captions from speech and restyle them, adjust audio, add transitions/filters, and export one MP4 at 480p/720p/1080p in several quality levels with no watermark that plays correctly in standard players and uploads cleanly to social platforms.
