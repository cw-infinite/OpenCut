# Scope and remaining work

Nothing from the required product scope has been intentionally dropped. Implementation is staged according to the supplied milestone gates.

The foundation includes desktop/tool setup (M0), projects/import (M1), multi-track editing/preview (M2), and MP4 export (M3).

M4 and M5 are implemented: transform/volume keyframes, speed, transitions, reverse/freeze, text styling and in/out/loop animations. M6 advanced audio is implemented and verified. M7 now generates offline English captions and supports list editing, static styles, position controls and SRT import/export. Remaining M7 work: animated word presets, configurable maximum lines, model selection/setup UI, filler removal, and full acceptance on long speech and caption MP4 export. M8 effects and M9 batch export/recording/polish remain. M10 stays optional.

Remaining acceptance coverage: real phone/VFR/rotated and long-media corpus, manual listening/A-V inspection in VLC/Windows Media Player, hardware performance targets, and one-hour drift/memory measurements. Automated synthetic tests do not substitute for these checks.

Cloud features, accounts, translations, non-English captions, 4K, and marketplace/stock services remain out of scope as specified.
