# OpenCut branding

`opencut.png` is the transparent master extracted from the user-supplied OpenCutLogo2.jpg using the built-in image generation tool. `opencut.ico` contains 16, 24, 32, 48, 64, 128 and 256 pixel PNG frames for Windows. `src/renderer/public/opencut.png` is the 256 pixel application, header and favicon asset. Preserve alpha when resizing these files.

Extraction prompt:

> Use case: background-extraction. Edit target: supplied OpenCutLogo2.jpg. Extract ONLY the blue square frame and white inner frame sliced diagonally from top left to bottom right by the long tapered white slash. Remove the black background including all internal negative spaces, and remove both text lines. Preserve exact geometry, proportions, white slash and blue gradient. Center the emblem on square transparent canvas with 5% padding around the outermost slash tips. Clean crisp edges. No redesign, no shadows, no text. True transparent background.

The shared Brand component pairs the emblem with accessible OpenCut text. Windows packaging uses `signExecutable: false` to retain icon and metadata editing without requiring code signing.
