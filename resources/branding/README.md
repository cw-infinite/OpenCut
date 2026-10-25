# OpenCut branding

`opencut.png` is the transparent master extracted from the user-supplied OpenCut Logo.jpg using the built-in image generation tool. `opencut.ico` contains 16, 24, 32, 48, 64, 128 and 256 pixel PNG frames for Windows. `src/renderer/public/opencut.png` is the 256 pixel application, header and favicon asset. Preserve alpha when resizing these files.

Extraction prompt:

> Use case: background-extraction. Edit target: attached OpenCut logo. Produce the exact turquoise/cyan/blue emblem ONLY on true transparent background, removing the dark navy backdrop and the OpenCut text beneath. Preserve the emblem geometry, film perforations, pen nib, gradient and proportions exactly. All navy areas including internal holes become transparent. Center this isolated emblem in a square canvas with minimal 5% padding. No redesign, no extra elements, no shadow.

The shared Brand component pairs the emblem with accessible OpenCut text. Windows packaging uses `signExecutable: false` to retain icon and metadata editing without requiring code signing.
