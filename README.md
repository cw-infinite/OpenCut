# OpenCut

OpenCut is a local Windows video editor for turning footage, audio, images, and text into finished videos. Organize projects, build multi-track edits, animate titles, generate English captions, and export video without an account or a cloud editing service. Media processing and creative tools run on your computer; internet access is needed for initial installation and optional tool downloads.

**Current version: 0.10.14 · Windows x64 · In development**

**Documentation updated: October 30, 2026**

The core M0–M10 feature set is implemented. Current work focuses on editing usability, project organization, and stability. This README describes the current source checkout, including the recent improvements below; broader real-footage and hardware validation is still underway.

## Recent improvements in the current build

- **Project tags and groups:** assign multiple tags, reuse existing tags, and filter the Projects page by a tag, Untagged, or All projects. Combine grouping with name search in card, simple-list, and detailed-list views. Tags persist with projects and are retained when duplicating them.
- **Bulk media management:** drag from empty space in the Media library to select items, Ctrl-click to toggle, or Shift-click to select a range. Select visible items, clear selection, delete selected items, or delete the entire library. Delete all includes items hidden by search. Original files are kept; a batch containing media used on the timeline is rejected without deleting any items.
- **Resizable timeline:** drag the divider above the timeline up to increase its height or down to restore preview space. Double-click to reset. A focused divider also supports the Up/Down arrows and Home/End, with size limits to keep both panels usable.
- **Updated branding:** the blue-and-white OpenCut emblem is used in setup, the workspace/editor header, favicon, and Windows application icon.

These updates are part of the current 0.10.14 checkout; they have not been assigned separate version numbers.

## Available features

### Projects and media

- Create, rename, duplicate, delete, and reopen local projects, with autosaving and recovery from valid backup data.
- Browse projects as cards, a simple list, or a detailed table with duration, resolution, aspect ratio, frame rate, media count, and update date.
- Organize projects with up to 20 tags per project, each up to 40 characters. Groups are tag-based rather than filesystem folders; a project can belong to several groups.
- Import local video, audio, and images using a file picker or drag and drop, with prepared proxies, thumbnails, and waveforms.
- Preview source media, identify missing originals, and relink files.
- Save a preview frame as a project cover.

### Timeline and preview

- Multi-track video, audio, and text editing with drag-and-drop insertion, live trimming, splitting, deletion, ripple deletion, copying, duplication, and undo/redo.
- Create tracks by dropping media or text between tracks or into the bottom drop area; double-click insertion is also available.
- Marquee and multi-clip selection, moving selections together, grouping, markers, snapping, and gap closing across all tracks or a chosen track.
- Track locking, hiding, muting, and reordering, plus protection against invalid overlaps and incompatible edits.
- Live preview move, resize, and rotation gestures, with one undo step per gesture and Escape to cancel.
- Preview zoom, fit, fullscreen, quality controls, horizontally resizable media/inspector panels, and a draggable timeline-height divider.

### Video, animation, and effects

- Position, scale, rotation, opacity, crop, fit/fill, horizontal mirror, and vertical flip controls.
- Property keyframes, easing, custom Bézier curves, speed changes, transitions, reverse, and freeze frames.
- Color adjustments, filters, blur, RGB split, shake, zoom pulse, VHS, pixelation, grain, blend modes, masks, chroma key, and picture-in-picture frames.
- Local video stabilization that creates a derived copy and preserves the original.
- Motion tracking for text/image overlays and subject-following smart reframe, producing editable position keyframes.
- Local portrait background removal for photos and short video ranges, creating transparent PNG/WebM derivatives.

### Text and captions

- Editable titles with bundled fonts, built-in styles, saved style presets, and motion-text templates.
- Text alignment, spacing, wrapping, gradients, outlines, shadows, glow, and backgrounds; entrance, exit, loop, and staggered/typewriter animations.
- Bulk styling and positioning for selected text/caption clips.
- Offline English transcription using Whisper.cpp, with base.en and optional small.en model controls.
- Caption text/timing editing, merge/split, deletion, find/replace, restyling, and SRT import/export.
- Animated karaoke, word-pop, and box-highlight styles. Captions are editable text clips and can be burned into MP4 output.
- Transcript-based cuts and filler-word review using generated word timings. Imported SRT or manually edited captions without word timing cannot drive transcript cuts.

### Audio and recording

- Clip and master volume, solo/mute, fades, ducking, and beat-marker detection.
- Export-time noise reduction and loudness normalization.
- Silence detection with review and undoable removal across tracks.
- Microphone voiceover recording and local text-to-speech using Piper.
- Webcam and screen/window recording, with microphone and system-audio options.

### Export

- MP4 video with H.264/AAC, automatic hardware-encoder selection where available, and software encoding.
- 480p, 720p, and 1080p options; frame rate, quality, audio bitrate, output-shape, and platform presets.
- Full-timeline or marked-range exports, plus sequential batch exports at multiple resolutions.
- WAV, MP3, and AAC audio export, and full-resolution PNG/JPEG frame export.
- Background export while editing, progress reporting, and cancellation with incomplete-output cleanup. Completed batch files remain available after cancellation.

## Quick start

1. Open OpenCut and complete local tool setup if prompted. Use **Check again** to verify tool readiness.
2. Choose **Open projects → New project**, enter a name, and choose the canvas and frame rate.
3. Import or drop video, audio, and images into the **Media library**.
4. Choose **Open timeline**. Drag media or the Text tile onto a track or a track-insertion area, or double-click a media item to insert it.
5. Trim and arrange clips, adjust properties in the inspector, and add text, captions, audio, or effects. Drag the divider above the timeline when you need more room for tracks.
6. Choose **Export**, configure the output, and select a destination.
7. Return to **Projects** to organize the project: click its tag icon, enter comma-separated tags, and choose **Save tags**. Use **Project group** to view a group separately.

### Common shortcuts

| Action | Shortcut |
|---|---|
| Play / pause | Space |
| Split selected clip | S |
| Delete selected clips | Delete |
| Ripple delete | Shift+Delete |
| Undo / redo | Ctrl+Z / Ctrl+Y |
| Copy / paste / duplicate | Ctrl+C / Ctrl+V / Ctrl+D |
| Seek one frame | Left / Right arrow |
| Seek one second | Shift+Left / Shift+Right |
| Set export-range start / end | I / O |
| Cancel an active preview/edit gesture | Escape |

Library selection uses Ctrl-click to toggle and Shift-click for a range. Timeline selection uses Shift-click to toggle clips.

## Current status and validation

The current version is **0.10.14**, as declared in `package.json`. It is a development build, not a claim of complete production or hardware certification.

Recent completed checks include:

- TypeScript type checking and production builds.
- Project-tag normalization, persistence, older untagged projects, duplication, and independent tag edits: six targeted unit/integration tests passed across the project and tag suites.
- Desktop checks for tag editing/reuse/removal, combined search and group filters, and existing project views, rename, duplicate, and open behavior.
- Desktop checks for media selection, canceled and confirmed bulk deletion, filtered delete-all, original-file preservation, and atomic rejection when media is used on the timeline.
- Desktop checks for timeline-divider dragging, keyboard resizing, bounds, release behavior, and reset.
- Visual review of the updated project and editor interfaces, and Windows unpacked builds with the current branding.

These are targeted checks completed during the recent changes, not a fresh full-suite run for every feature. Historical milestone acceptance and export checks are recorded in [Milestone status](docs/STATUS.md); its numbered release entries currently run through 0.10.7. See [Stability acceptance](docs/STABILITY.md) for the synthetic long-project measurements and their limits.

### Known limits and remaining validation

- Windows x64 is the current packaging target. Canvas dimensions are even numbers from 64 to 1920 pixels, with the shorter edge at most 1080; supported frame rates are 24, 25, 30, 50, and 60 fps. 4K is not supported.
- Captions currently target English. Actual optional small.en inference and timing quality on arbitrary human speech still need broader validation.
- Motion tracking and smart reframe require a user-selected feature and support clips up to 60 seconds. Occlusion, fast motion, and similar-looking subjects can require manual correction.
- Portrait removal targets people, uses a 512-pixel analysis edge, and limits video source ranges to 30 seconds. Apply reverse/stabilization before generating cutouts.
- Text-to-speech currently provides one US English voice, up to 5,000 characters per request, at 0.5–2× speed.
- Video capture is limited to five minutes/120 MB; microphone voiceover to 30 minutes/60 MB. Physical device and system-audio capture still need manual acceptance.
- Broader phone/VFR/rotated-media testing, manual listening and external-player checks, continuous long-session playback, effect-heavy performance, and real-source long 1080p CPU exports remain outstanding.
- No account, telemetry, automatic updater, or code signing is configured. Cloud services, stock marketplaces, translation, and non-English captions are outside the current scope.
- Some in-app version labels still display 0.10.7; use `package.json` for the current application version.

See [Scope and remaining work](docs/SKIPPED.md) for detailed constraints and acceptance gaps.

## Run from source on Windows x64

Requires Node.js 22.12+ and npm. From the repository directory:

```powershell
npm install
npm run setup:tools
npm run setup:creative
npm run dev
```

Installation downloads Electron, FFmpeg, and FFprobe. Core setup downloads the CPU Whisper CLI and English base model (approximately 160 MB), verifies checksums, and stores tools under `resources/tools/`. Creative setup installs the local speech and portrait-removal tools. Once installed, processing runs locally without a network connection.

For the optional small English transcription model:

```powershell
npm run setup:tools -- --small
```

The app also exposes explicit setup/download actions for missing tools. Failed downloads can be retried. Tool status checks execute the tools rather than checking file presence alone; downloaded models are checksum-verified. See [Tool licenses and sources](docs/licenses/README.md).

## Build, test, and package

```powershell
npm run typecheck
npm test
npm run build
npm run test:smoke
npm run test:stability
npm run package
```

`test:smoke` builds first and launches Electron desktop tests. Stability checks include generated fixtures; the full one-hour export is opt-in as documented in [Stability acceptance](docs/STABILITY.md).

`npm run package` produces an unsigned Windows x64 portable executable in `dist/`. Install the bundled tools before packaging an offline-ready build. An unpacked build can also be produced with:

```powershell
npm run build
npx electron-builder --win --dir --x64
```

Run `OpenCut.exe` inside the resulting `win-unpacked` folder and keep its supporting files together. Build outputs are local artifacts, not files included with a source checkout. The latest local build produced during the project-tag update is `dist/project-tags/win-unpacked/OpenCut.exe`; older output folders may contain earlier features.

## Technology and project notes

OpenCut uses Electron, React 18, TypeScript, electron-vite, Tailwind, Zustand, and Immer. Local media and creative processing uses FFmpeg/FFprobe, Whisper.cpp, Piper, and MODNet. Preview and video export share rendering logic.

- [Milestone history and acceptance evidence](docs/STATUS.md)
- [Stability measurements and repeatable checks](docs/STABILITY.md)
- [Remaining work and feature limits](docs/SKIPPED.md)
- [Implementation decisions](docs/DECISIONS.md)
- [Bundled tool licenses and sources](docs/licenses/README.md)
