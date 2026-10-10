# Scope and remaining work

Nothing from the required product scope has been intentionally dropped. Implementation is staged according to the supplied milestone gates.

The foundation includes desktop/tool setup (M0), projects/import (M1), multi-track editing/preview (M2), and MP4 export (M3).

M4–M9 are implemented: animation, advanced audio, offline English captions with animated word presets/model controls/filler cuts, visual effects, multi-quality export, presets, frame/cover export, silence removal, media relink, markers/groups, and screen/webcam recording. M10 is now in progress with transcript-based editing, local stabilization and motion tracking. Background removal, smart reframe and local text-to-speech remain unimplemented.

Remaining acceptance coverage: real phone/VFR/rotated and long-media corpus, manual listening/A-V inspection in VLC/Windows Media Player, hardware performance targets, one-hour drift/memory measurements, physical microphone/webcam and system-audio capture, and optional small.en download/inference. Caption timing is tested on two-minute synthetic speech; this does not establish 200 ms word accuracy on arbitrary human speech. Automated synthetic tests do not substitute for these checks.

Video capture is limited to five minutes/120 MB per recording; microphone voiceover is limited to 30 minutes/60 MB. Silence/filler cuts ripple all tracks to retain alignment and refuse cuts through transitions, affected locked tracks, or nonrepresentable source timing units. Effects use a CPU canvas pipeline capped at a 1920-pixel working edge; long-project performance remains unverified. Size estimates are approximate, especially under quality-based encoding.

Cloud features, accounts, translations, non-English captions, 4K, and marketplace/stock services remain out of scope as specified.
