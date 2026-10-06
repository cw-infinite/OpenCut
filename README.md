# OpenCut

A free, local Windows video editor under development. Built with Electron, React 18, strict TypeScript, electron-vite, Tailwind, Zustand and Immer.

**Current milestone: M0 — desktop foundation and local tool setup. Editing/export are not implemented yet.** See [milestone status](docs/STATUS.md).

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

The full product roadmap remains the supplied build spec, implemented in milestone order. Decisions and deviations are recorded in `docs/DECISIONS.md` and `docs/SKIPPED.md`.
