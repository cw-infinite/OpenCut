# OpenCut

A free, local Windows video editor under development. Built with Electron, React 18, strict TypeScript, electron-vite, Tailwind, Zustand and Immer.

**Current build: 0.9.1 — milestones M0–M9 plus readability and editing improvements, with broader manual acceptance still pending.** Includes multi-track editing, keyframes, speed, transitions, reverse/freeze, animated titles/captions, offline English transcription, visual effects, advanced audio, MP4/audio exports, batch resolutions, platform presets, frame/cover images, silence removal, relink, and screen/webcam recording. See [milestone status](docs/STATUS.md).

## Easier editing in 0.9.1

Interface labels now use at least 14 px text. Drag from empty timeline space in any direction to select every clip touched by the rectangle, including clips on other tracks. Shift-click toggles individual clips. Drag any selected clip to move the selection with live preview and edge scrolling; release to commit one undoable edit, or press Escape to cancel. Invalid overlaps and locked/incompatible tracks are rejected.

The bulk inspector offers delete/deselect, volume and mute for media selections, and font size for text selections. Delete affects the selected clips; Ctrl+D duplicates the whole selection after its original span, preserving offsets and moving later clips on affected tracks to make room.

The preview visibly follows the project's canvas shape. Use **Preview zoom** (25–300%) and **Fit preview**; scroll to inspect a zoomed canvas, or resize the upper workspace vertically. Fullscreen now works and includes playback controls, with a button or Escape to exit. Preview zoom does not alter exported framing.

0.5.1 fixes a black screen when Projects restores media with an older waveform cache. Both array and `{ buckets, peaks }` caches are supported; missing or damaged waveform caches no longer prevent opening a project.

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
6. In **Animation**, select a property and add keyframes at different playhead positions. Edit values/easing in the inspector; drag timeline diamonds to retime. Double-click a timeline clip to add keys; right-click a diamond to delete. Undo/redo and trim/split preserve animation. The inspector also offers speed, transitions, reverse and freeze.
7. Click **Export**. Choose 480p/720p/1080p, FPS, quality, AAC bitrate, and automatic or software encoding. **I/O** set optional export-range endpoints on the timeline.
8. Click **Export MP4** and choose a path. **Keep editing** closes the dialog while export continues; a task indicator remains visible. Cancel removes incomplete output.

## Verify M5: animated titles

Run `npm run dev`, then **Open projects → New project → Create project → Open timeline → Add text**.

1. Edit **Text content**, or double-click the preview and choose **Apply text**. Choose a font and style preset in the inspector.
2. Enable **stroke**, **shadow**, and **background** under Appearance; adjust their colors and dimensions.
3. Under **Text animations**, choose **pop** for In, **slideDown** for Out, and **pulse** for Loop. Seek and play to inspect the entrance and exit.
4. Try **typewriter** with **char** granularity and adjust Stagger. The shared **Animation** section adds transform and opacity keyframes.
5. Name your style and click **Save style** to reuse it. Click **Export → Export MP4** for a local video.

Checks include generated VFR import, frame seeking, restart restore, timeline operations, 200-step history capacity, and real MP4 exports. Animated title frames at 0.2, 0.8, and 1.8 seconds match preview within lossy-encoding tolerance with automatic GPU selection and software encoding. Real-camera footage, long edits, manual player compatibility and performance targets still need broader validation.

The full product roadmap remains the supplied build spec, implemented in milestone order. Decisions and deviations are recorded in `docs/DECISIONS.md` and `docs/SKIPPED.md`.

## Audio and captions

Select an audio/video clip to adjust master gain, solo, fades and ducking in the inspector. Noise reduction and loudness normalization apply during export. **Detect beat markers** adds onset candidates. **Record voiceover** captures your microphone at the playhead; stop recording to add it as an audio clip. Export supports WAV, MP3 and AAC in addition to MP4.

Click **Captions** to generate offline English captions from the audible timeline, an I/O range, or the selected clip. Adjust character/word/line limits and choose a style and position, including karaoke, word-pop and box-highlight presets. The list supports text edits, timing changes, merge/split, delete, find/replace, and restyle all. SRT import/export is available in the same dialog. Captions are ordinary text clips and burn into MP4 output. Generate adds a new track; existing captions stay available for comparison or undo.

Model controls offer base.en and the optional checksum-verified small.en download. Filler-word candidates use generated word timings and can be reviewed and cut with undo. Imported and manually edited caption text has no word timings. Actual small.en inference and arbitrary human-speech timing remain unverified.

## Effects and export polish

Select a media clip for filters, color adjustments, blur, RGB split, shake, zoom pulse, VHS, mirror, pixelation, grain, blend modes, masks, chroma key, and picture-in-picture frames. Preview and export share the same renderer.

In **Export**, choose a platform preset or output shape. Enable **Batch export resolutions** to produce 1080p, 720p and 480p sequentially in one folder. A batch uses one project snapshot; cancel retains completed files. Estimated sizes are approximate. **Save frame** above the preview exports a full-resolution PNG/JPEG or sets the project cover.

The source browser flags missing originals and offers **Relink selected media**. The inspector's **Remove silence** analyzes an audio/video clip, shows candidate intervals, and removes them across all tracks with one undo. **Markers**, **Group**, and **Ungroup** are in the timeline toolbar.

**Record video** offers webcam or a selected screen/window with optional microphone/system audio. Stop to add the recording at the playhead. Video recordings are limited to five minutes/120 MB; physical devices and system-audio capture still need manual testing.
