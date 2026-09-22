import { FaceDetector, FilesetResolver } from './vision_bundle.mjs';
let detector;
self.onmessage = async ({ data }) => {
  if (data.type === 'init') {
    try {
      const files = await FilesetResolver.forVisionTasks(new URL('./', self.location.href).href, true);
      detector = await FaceDetector.createFromOptions(files, { baseOptions: { modelAssetPath: new URL('./blaze_face_short_range.tflite', self.location.href).href, delegate: 'CPU' }, runningMode: 'IMAGE', minDetectionConfidence: .65 });
      self.postMessage({ type: 'ready' });
    } catch { self.postMessage({ type: 'error' }); }
  } else if (data.type === 'frame') {
    const frame = data.frame;
    try {
      if (!detector) throw new Error('Not ready');
      const result = detector.detect(frame);
      const boxes = result.detections.slice(0, 8).flatMap(d => d.boundingBox ? [{ x: d.boundingBox.originX / frame.width, y: d.boundingBox.originY / frame.height, width: d.boundingBox.width / frame.width, height: d.boundingBox.height / frame.height, score: d.categories[0]?.score ?? 0 }] : []);
      self.postMessage({ type: 'faces', sequence: data.sequence, boxes });
    } catch { self.postMessage({ type: 'error' }); }
    finally { frame?.close(); }
  }
};
