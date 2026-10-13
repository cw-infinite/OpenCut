# Scope and remaining work

Nothing from the required product scope has been intentionally dropped. Implementation is staged according to the supplied milestone gates.

The foundation includes desktop/tool setup (M0), projects/import (M1), multi-track editing/preview (M2), and MP4 export (M3).

M4–M9 are implemented: animation, advanced audio, offline English captions with animated word presets/model controls/filler cuts, visual effects, multi-quality export, presets, frame/cover export, silence removal, media relink, markers/groups, and screen/webcam recording. M10 features are implemented: transcript-based editing, local stabilization, motion tracking, subject-following smart reframe, local Piper speech, and MODNet portrait background removal. Broader real-footage quality and performance acceptance remains manual.

M10 creative limits: reframe uses a user-selected template feature, not automatic semantic subject detection; tracking is limited to 60-second clips. Portrait removal uses a 512-pixel analysis edge, supports people rather than arbitrary objects, and limits video source ranges to 30 seconds. Cutouts use alpha WebM/PNG and the original remains available; apply reverse/stabilization before cutout generation. Speech currently offers one US English voice, 5,000 characters per generation and 0.5–2× speed.

Remaining acceptance coverage: real phone/VFR/rotated and long-media corpus, manual listening/A-V inspection in VLC/Windows Media Player, broader hardware and effect-heavy performance, continuous one-hour preview, real-source one-hour/1080p CPU export throughput, physical microphone/webcam and system-audio capture, and optional small.en download/inference. Caption timing is tested on two-minute synthetic speech; this does not establish 200 ms word accuracy on arbitrary human speech. Automated synthetic tests do not substitute for these checks.

Completed stability acceptance: a ten-second half-quality preview sample on a one-hour, five-track, 900-clip timeline passes on the development desktop; a full synthetic one-hour 480p30 export passes synchronization and Electron memory-growth checks. See `STABILITY.md` for measured results and limits.

Video capture is limited to five minutes/120 MB per recording; microphone voiceover is limited to 30 minutes/60 MB. Silence/filler cuts ripple all tracks to retain alignment and refuse cuts through transitions, affected locked tracks, or nonrepresentable source timing units. Effects use a CPU canvas pipeline capped at a 1920-pixel working edge; effect-heavy long-project performance remains unverified. Size estimates are approximate, especially under quality-based encoding.

Cloud features, accounts, translations, non-English captions, 4K, and marketplace/stock services remain out of scope as specified.
