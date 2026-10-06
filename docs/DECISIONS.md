# OpenCut implementation decisions

- User-requested name **OpenCut** overrides LocalCut throughout the supplied spec, including `%APPDATA%/OpenCut`.
- Milestones follow the supplied order; unimplemented editing capabilities are labelled rather than simulated.
- Electron 44.5.1 was the latest stable version returned by npm at bootstrap. Vite 7 is used because electron-vite 5 declares support through Vite 7.
- Whisper CPU binary is pinned to official v1.9.2 with the published SHA-256. The latest release metadata (v1.9.4) had no binary assets. Both model downloads have pinned SHA-256 checksums from the official Hugging Face repository.
- Downloading is explicit via the setup button or command. Normal renderer requests are limited to local resources; development additionally allows its loopback Vite server.
- Downloads stream to `.part` files, verify their checksum, and then replace the target. Optional `--small` downloads the higher-accuracy model too.
- Bundled tools live in `resources/tools` in development and the portable app's resources directory after packaging.
- The scaffold uses an original restrained graphite/lime interface and bundled Inter. No CapCut assets are included.
- Tailwind 4.3.3, Vitest 4.1.11 and Electron's maintained ZIP extractor replace older bootstrap dependencies after audit findings. Final M0 dependency audit reports zero vulnerabilities.
- The spec's PRJ-2 long-edge 1080 wording conflicts with its 1920×1080/1080×1920 export presets. Canvas settings support both explicit 1080p orientations; short edge is capped at 1080 and long edge at 1920.
- Project mutations save immediately and atomically; the prior valid JSON is retained for crash recovery. Imported source files are never copied or deleted. Duplicating a project copies its proxy/cache files so either project can be deleted independently.
- Project FPS is fixed after import in M1 because CFR proxies use the project rate. Changing FPS requires a new project until proxy regeneration is implemented.
- Media protocol responses explicitly serve HTTP-style byte ranges: forwarding file responses did not produce seekable video in Electron's custom protocol handler.
- M1 automated acceptance uses generated 1080p variable-frame-rate footage with audio, an MP3, and a transparent PNG. This does not constitute testing the full real-phone/long-audio media corpus.

References: [electron-vite requirements](https://electron-vite.org/guide/), [official Whisper releases](https://github.com/ggml-org/whisper.cpp/releases), [official model repository](https://huggingface.co/ggerganov/whisper.cpp).
