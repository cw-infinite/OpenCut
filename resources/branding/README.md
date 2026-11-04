# OpenCut branding

`opencut.png` is the transparent master extracted from the user-supplied Gemini_Generated_Image_li4fi2li4fi2li4f.jpg using the built-in image generation tool. `opencut.ico` contains 16, 24, 32, 48, 64, 128 and 256 pixel PNG frames for Windows. `src/renderer/public/opencut.png` is the 256 pixel application, header and favicon asset. Preserve alpha when resizing these files.

Extraction prompt:

> Use case: background-extraction. Extract ONLY the colored OpenCut emblem above the word from the supplied image: bowed rectangular screen outline, central circular scissor handles, and diagonal blade rising from lower left to upper right with small pivot hole. Preserve exact design, geometry and cyan/teal/green/blue/purple gradient highlights. Remove OpenCut lettering and all dark background including internal negative spaces and background glow. True transparent background, clean edges, no new elements or redesign. Center the emblem in a square canvas with 5% padding around its furthest points. This will be the app icon.

The shared Brand component pairs the emblem with accessible OpenCut text. Windows packaging uses `signExecutable: false` to retain icon and metadata editing without requiring code signing.
