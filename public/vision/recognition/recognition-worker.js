import Human from './human.esm.js';
let human, embeddingModel;
let busy = false;
self.onmessage = async ({ data }) => {
  if (busy) { data.frame?.close(); return; }
  busy = true;
  try {
    if (data.type === 'init') {
      human = new Human({
        backend: 'cpu', modelBasePath: '/vision/recognition/', cacheSensitivity: 0, skipAllowed: false,
        debug: false, warmup: 'none', async: false,
        filter: { enabled: false }, gesture: { enabled: false }, body: { enabled: false },
        hand: { enabled: false }, object: { enabled: false }, segmentation: { enabled: false },
        face: { enabled: true, detector: { rotation: true, return: true, maxDetected: 2, minConfidence: .75, minSize: 80 },
          mesh: { enabled: true }, iris: { enabled: false }, emotion: { enabled: false },
          description: { enabled: false }, antispoof: { enabled: false }, liveness: { enabled: false },
          mobilefacenet: { enabled: false } },
      });
      await human.load();
      embeddingModel = await human.tf.loadGraphModel('/vision/recognition/mobileface.json');
      self.postMessage({ type: 'ready' });
    } else if (data.type === 'frame' && human) {
      const canvas = new OffscreenCanvas(data.frame.width, data.frame.height);
      canvas.getContext('2d').drawImage(data.frame, 0, 0);
      const result = await human.detect(canvas);
      const faces = result.face.filter(face => face.faceScore >= .75 && face.box[2] >= 80 && face.box[3] >= 80);
      let embedding = null;
      try {
        if (result.face.length === 1 && faces.length === 1 && faces[0].tensor) {
          // Human's aligned crop is 0..1; MobileFace's graph subtracts 127.5
          // internally and therefore expects RGB pixels in 0..255.
          const input = human.tf.tidy(() => human.tf.expandDims(human.tf.mul(human.tf.image.resizeBilinear(faces[0].tensor, [112, 112]), 255), 0));
          const output = embeddingModel.execute(input);
          embedding = Array.from(await output.data());
          input.dispose(); output.dispose();
        }
      } finally { result.face.forEach(face => face.tensor?.dispose()); }
      const norm = embedding?.length === 256 ? Math.hypot(...embedding) : 0;
      self.postMessage({ type: 'result', sequence: data.sequence, count: result.face.length > 1 ? result.face.length : faces.length,
        embedding: norm > 0 && embedding.every(Number.isFinite) ? embedding.map(value => value / norm) : null });
    }
  } catch { self.postMessage({ type: 'error' }); }
  finally { data.frame?.close(); busy = false; }
};
