/* Runs MediaPipe pose detection off the main thread.
 * This is a classic (non-module) worker on purpose: MediaPipe's wasm loader calls
 * importScripts, which module workers don't support. The CommonJS bundle is served
 * from our own origin (see vite.config.ts) and the wasm comes from the CDN at the
 * same pinned version. */

let landmarker = null;

async function init({ version, modelUrl }) {
  const cdn = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${version}`;
  self.exports = {};
  self.module = { exports: self.exports };
  importScripts('/mediapipe/vision_bundle.js');
  const { PoseLandmarker, FilesetResolver } = self.module.exports;

  const vision = await FilesetResolver.forVisionTasks(`${cdn}/wasm`);
  const options = (delegate) => ({
    baseOptions: { modelAssetPath: modelUrl, delegate },
    runningMode: 'VIDEO',
    numPoses: 1,
  });

  // the gpu delegate needs WebGL in a worker (OffscreenCanvas); fall back to cpu if it isn't there
  try {
    landmarker = await PoseLandmarker.createFromOptions(vision, options('GPU'));
    return 'GPU';
  } catch (error) {
    landmarker = await PoseLandmarker.createFromOptions(vision, options('CPU'));
    return 'CPU';
  }
}

self.onmessage = async ({ data }) => {
  try {
    if (data.type === 'init') {
      const delegate = await init(data);
      self.postMessage({ type: 'ready', delegate });
      return;
    }

    if (data.type === 'frame') {
      const start = performance.now();
      const result = landmarker.detectForVideo(data.bitmap, data.timestamp);
      data.bitmap.close();
      self.postMessage({
        type: 'result',
        id: data.id,
        landmarks: result.landmarks[0] || null,
        worldLandmarks: result.worldLandmarks[0] || null,
        inferenceMs: performance.now() - start,
      });
      return;
    }

    if (data.type === 'close') {
      landmarker && landmarker.close();
      self.close();
    }
  } catch (error) {
    if (data.bitmap) data.bitmap.close();
    self.postMessage({ type: 'error', id: data.id, message: String(error && error.message ? error.message : error) });
  }
};
