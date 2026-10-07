# Scope and remaining work

Nothing from the required product scope has been intentionally dropped. Implementation is staged according to the supplied milestone gates.

Implemented through the first end-to-end milestone: desktop/tool setup (M0), projects/import (M1), basic multi-track editing/preview (M2), and MP4 export (M3).

M4 is implemented: transform/volume keyframes, speed, transitions, reverse and freeze. Remaining milestones: text and animation (M5), advanced audio (M6), auto-captions and editing (M7), effects (M8), and batch export/recording/polish (M9). M10 stays optional. The SRT exporter requires caption clips, which the UI will create in M7.

Remaining acceptance coverage: real phone/VFR/rotated and long-media corpus, manual listening/A-V inspection in VLC/Windows Media Player, hardware performance targets, and one-hour drift/memory measurements. Automated synthetic tests do not substitute for these checks.

Cloud features, accounts, translations, non-English captions, 4K, and marketplace/stock services remain out of scope as specified.
