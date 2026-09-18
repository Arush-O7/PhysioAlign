import type { Keypoint } from './angleCalculations';

// keep in sync with the exact version in package.json, the wasm and the worker bundle come from this CDN path
export const MEDIAPIPE_VERSION = '0.10.32';
const WASM_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}/wasm`;
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';

export interface PoseResult {
  landmarks: Keypoint[] | null;
  worldLandmarks: Keypoint[] | null;
  // time spent inside the model
  inferenceMs: number;
}

export interface PoseDetector {
  mode: 'worker' | 'main-thread';
  delegate: string;
  detect(video: HTMLVideoElement, timestamp: number): Promise<PoseResult>;
  close(): void;
}

const toKeypoints = (landmarks: any[] | null | undefined): Keypoint[] | null =>
  landmarks
    ? landmarks.map((l) => ({ x: l.x, y: l.y, z: l.z, visibility: l.visibility || 0 }))
    : null;

const workerSupported = () =>
  typeof Worker !== 'undefined' && typeof OffscreenCanvas !== 'undefined' && typeof createImageBitmap !== 'undefined';

async function createWorkerDetector(): Promise<PoseDetector> {
  const worker = new Worker('/pose-worker.js');
  const pending = new Map<number, { resolve: (r: PoseResult) => void; reject: (e: Error) => void }>();
  let nextId = 0;

  const delegate = await new Promise<string>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Pose worker took too long to start')), 30000);
    worker.onmessage = ({ data }) => {
      if (data.type === 'ready') {
        clearTimeout(timeout);
        resolve(data.delegate);
      } else if (data.type === 'error') {
        clearTimeout(timeout);
        reject(new Error(data.message));
      }
    };
    worker.onerror = (event) => {
      clearTimeout(timeout);
      reject(new Error(event.message || 'Pose worker failed to load'));
    };
    worker.postMessage({ type: 'init', version: MEDIAPIPE_VERSION, modelUrl: MODEL_URL });
  });

  worker.onmessage = ({ data }) => {
    const job = pending.get(data.id);
    if (!job) return;
    pending.delete(data.id);
    if (data.type === 'result') {
      job.resolve({
        landmarks: toKeypoints(data.landmarks),
        worldLandmarks: toKeypoints(data.worldLandmarks),
        inferenceMs: data.inferenceMs,
      });
    } else {
      job.reject(new Error(data.message));
    }
  };

  return {
    mode: 'worker',
    delegate,
    async detect(video, timestamp) {
      // the frame is copied into a bitmap and transferred, not cloned
      const bitmap = await createImageBitmap(video);
      const id = nextId++;
      return new Promise<PoseResult>((resolve, reject) => {
        pending.set(id, { resolve, reject });
        worker.postMessage({ type: 'frame', id, bitmap, timestamp }, [bitmap]);
      });
    },
    close() {
      worker.postMessage({ type: 'close' });
      pending.clear();
    },
  };
}

async function createMainThreadDetector(): Promise<PoseDetector> {
  const { PoseLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision');
  const vision = await FilesetResolver.forVisionTasks(WASM_URL);
  const create = (delegate: 'GPU' | 'CPU') =>
    PoseLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: MODEL_URL, delegate },
      runningMode: 'VIDEO',
      numPoses: 1,
    });

  let delegate: 'GPU' | 'CPU' = 'GPU';
  let landmarker;
  try {
    landmarker = await create('GPU');
  } catch {
    delegate = 'CPU';
    landmarker = await create('CPU');
  }

  return {
    mode: 'main-thread',
    delegate,
    async detect(video, timestamp) {
      const start = performance.now();
      const result = landmarker.detectForVideo(video, timestamp);
      return {
        landmarks: toKeypoints(result.landmarks[0]),
        worldLandmarks: toKeypoints(result.worldLandmarks[0]),
        inferenceMs: performance.now() - start,
      };
    },
    close() {
      landmarker.close();
    },
  };
}

// prefers the worker so inference never blocks rendering, falls back to the main thread
// on browsers without OffscreenCanvas or if the worker fails to start.
// ?detector=main in the url forces the main thread, handy for comparing the two
export async function createPoseDetector(): Promise<PoseDetector> {
  const forced = new URLSearchParams(window.location.search).get('detector');
  if (forced !== 'main' && workerSupported()) {
    try {
      return await createWorkerDetector();
    } catch (error) {
      console.warn('[PhysioAlign] Pose worker unavailable, using the main thread:', error);
    }
  }
  return createMainThreadDetector();
}
