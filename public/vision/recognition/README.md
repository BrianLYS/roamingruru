# Local face recognition assets

Pinned runtime: `@vladmandic/human` 3.3.6 (MIT). The browser loads these assets from this application's origin only.

- `human.esm.js`, `blazeface.{json,bin}`, `facemesh.{json,bin}` copied from that exact npm package. BlazeFace and FaceMesh originate from Google MediaPipe (Apache 2.0); Human conversion retained.
- `mobileface.{json,bin}` downloaded from https://github.com/vladmandic/human-models/tree/main/models on September 22, 2026. Original model: https://github.com/becauseofAI/MobileFace (MIT). SHA-256 pins in `checksums.txt`.
- License texts retained alongside models. TensorFlow.js is included in Human's distributed runtime (Apache 2.0).

`recognition-worker.js` disables description, demographic, emotion, body, hand and object models. It uses Human solely for face detection/alignment and runs the 256-dimensional embedding graph directly. Important: aligned face crops are 0..1; this MobileFace graph internally subtracts 127.5 and expects 0..255. The worker scales pixels before executing the graph and L2-normalizes its output.

No raw video/image is persisted or sent to the server. The visitor opts into comparing face signatures and separately opts into enrollment. This is social recall, not identity verification, authentication, or liveness detection. Thresholds are conservative demo defaults, not an accuracy guarantee across populations.
