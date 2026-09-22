# Local vision assets

MediaPipe Tasks Vision runtime 1.0.1, copyright The MediaPipe Authors, Apache-2.0; see LICENSE. `vision_bundle.mjs` and `vision_wasm_module_internal.{js,wasm}` are copied unchanged from the exact pinned npm package `@mediapipe/tasks-vision@1.0.1`.

BlazeFace short-range float16 model, version 1, downloaded from the Google-hosted model linked by the official MediaPipe face detector documentation:
https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite

Documentation: https://developers.google.com/edge/mediapipe/solutions/vision/face_detector/web_js

`attention-worker.js` is Roaminglulu's adapter. Runtime, model and worker are served from this app's origin. No runtime CDN or hosted inference is used. The model detects face locations; this application uses only boxes and confidence, discards landmarks and does not compute identity embeddings. Unsupported WASM/module-worker browsers keep manual capture and conversation available.

The public MediaPipe portrait fixture used during local QA is not included in these distributed assets or the app UI. Source publication remains unauthorized.
