# Local creative tools

OpenCut calls these local tools without modifying their binaries or model weights. Downloads are pinned and SHA-256 verified in `src/main/services/creativeTools.ts`.

- Piper Windows x64, release 2023.11.14-2, MIT. Source and original binary: https://github.com/rhasspy/piper/tree/2023.11.14-2 and https://github.com/rhasspy/piper/releases/tag/2023.11.14-2 . This is the pinned standalone Windows distribution, not the newer Python-based Piper project.
- Piper phonemization includes eSpeak NG, GPL-3.0-or-later. Upstream source: https://github.com/espeak-ng/espeak-ng ; Piper phonemizer build/dependency sources: https://github.com/rhasspy/piper-phonemize . The eSpeak license is included here.
- LJ Speech medium US English voice: https://huggingface.co/rhasspy/piper-voices/tree/c10ece1aade47bb51c153c893d14e5bf8e5b7117/en/en_US/ljspeech/medium . Original model card included; training dataset is public domain.
- MODNet portrait matting, Apache-2.0: https://github.com/ZHKKKe/MODNet . Unmodified ONNX model: https://huggingface.co/gradio/Modnet/tree/2e7196ed50d5d60f99a73f737421d9760cf05e0c . RGB normalization follows the upstream ONNX example. OpenCut uses a 512-pixel analysis edge and resizes the matte to the source dimensions.
- ONNX Runtime Node 1.30.0, MIT: https://github.com/microsoft/onnxruntime/tree/v1.30.0 . Native CPU runtime is packaged with the application; package third-party notices are retained.

These notices are copied into `resources/tools/creative/licenses` in the packaged app. Complete upstream notices/licenses apply to their respective components.
