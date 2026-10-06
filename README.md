# OpenCut

A free, local Windows video editor under development. Built with Electron, React 18, strict TypeScript, electron-vite, Tailwind, Zustand and Immer.

**Current build: 0.3.1 — project import, multi-track editing, visual keyframes, canvas preview and MP4 export.** Animated text, captions, transitions and advanced audio/effects are still in development. See [milestone status](docs/STATUS.md).

## Run on Windows x64

Requires Node.js 22.12+ and npm. From this directory:

```powershell
npm install
npm run setup:tools
npm run dev
```

The first install downloads Electron, FFmpeg and FFprobe. Tool setup downloads the CPU Whisper CLI and English base model (approximately 160 MB), verifies checksums, and stores them in `resources/tools/`. Later use requires no network. `npm run setup:tools -- --small` also installs the optional small English model.

You can also run setup using **Set up local tools** in the app. Failed downloads can be retried. The tool status reports actual executable checks, not just file presence (models are checksum-verified at download).

```powershell
npm run typecheck
npm test
npm run test:smoke
npm run package
```

Portable Windows output goes to `dist/`. No signing, updater, account or telemetry is configured. The bundled tools must be installed before packaging an offline-ready build.

## Verify M0

1. Run `npm run dev`; an **OpenCut** desktop window should open.
2. Click **Set up local tools** if needed. After completion, the header should say **Tools OK**.
3. Confirm FFmpeg, FFprobe, Whisper.cpp and the English speech model all show **Ready**.
4. Click **Check again**. This runs the real `ffmpeg -version` and `ffprobe -version` commands through the typed IPC bridge, plus Whisper `--help`.

## Edit and export

1. Click **Open projects → New project**. Choose the canvas and frame rate, then create it.
2. Click **Import media** or drop local video/audio/images into the source browser. Wait for proxy/thumbnails/waveform preparation.
3. Click **Open timeline**. Add a video/audio track and drag media onto it, or double-click a media item to create a clip on a new track.
4. Move clips by dragging. Drag clip edges to trim. Click the ruler to seek; select a clip and press **S** to split, **Delete** to remove, or **Shift+Delete** to ripple delete. **Ctrl+Z/Y** undo/redo. **Space** plays/pauses.
5. Adjust position, scale, rotation, opacity, crop, fit, flip and audio volume in the inspector. Drag the preview to position; use its handles to scale/rotate. Track controls lock/hide/mute and reorder tracks. Edits autosave.
6. In **Animation**, select a property and add keyframes at different playhead positions. Edit values/easing in the inspector; drag timeline diamonds to retime. Undo/redo and trim/split preserve animation.
7. Click **Export**. Choose 480p/720p/1080p, FPS, quality, AAC bitrate, and automatic or software encoding. **I/O** set optional export-range endpoints on the timeline.
8. Click **Export MP4** and choose a path. **Keep editing** closes the dialog while export continues; a task indicator remains visible. Cancel removes incomplete output.

Checks include generated VFR import, frame seeking, restart restore, timeline operations, 200-step history capacity, real MP4 exports and a decoded-frame comparison. Real-camera footage, long edits, manual player compatibility and performance targets still need broader validation.

The full product roadmap remains the supplied build spec, implemented in milestone order. Decisions and deviations are recorded in `docs/DECISIONS.md` and `docs/SKIPPED.md`.
