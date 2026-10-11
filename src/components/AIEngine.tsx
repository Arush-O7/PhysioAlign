import { useEffect, useRef, useState, memo } from 'react';
import Webcam from 'react-webcam';
import { AlertCircle } from 'lucide-react';
import { calculateAngles, Keypoint } from '../utils/angleCalculations';
import { createPoseDetector, PoseDetector, PoseResult } from '../utils/poseDetector';
import { recordFrame } from '../utils/perf';

interface AIEngineProps {
  onPoseDetected: (data: { keypoints: Keypoint[]; angles: Record<string, number> }) => void;
  onPoseLost?: () => void;
  onStatusChange?: (status: { isLoaded: boolean; error: string | null }) => void;
  poseImage?: string;
  poseName?: string;
}

export const AIEngine = memo(({ onPoseDetected, onPoseLost, onStatusChange, poseImage, poseName }: AIEngineProps) => {
  const webcamRef = useRef<Webcam>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fps, setFps] = useState(0);
  const [detectorMode, setDetectorMode] = useState<PoseDetector['mode'] | null>(null);

  const detectorRef = useRef<PoseDetector | null>(null);
  const animationFrameIdRef = useRef<number | null>(null);
  const lastVideoTimeRef = useRef(-1);
  const frameCountRef = useRef(0);
  const lastFpsTimeRef = useRef(performance.now());
  const lastTimestampRef = useRef(0);
  const personVisibleRef = useRef(false);
  const busyRef = useRef(false);

  // Load the pose model, in a web worker when the browser supports it
  useEffect(() => {
    let cancelled = false;

    createPoseDetector()
      .then((detector) => {
        // component unmounted while the model was still downloading
        if (cancelled) {
          detector.close();
          return;
        }
        detectorRef.current = detector;
        setDetectorMode(detector.mode);
        setIsModelLoaded(true);
        onStatusChange?.({ isLoaded: true, error: null });
        console.log(`[PhysioAlign] Pose model loaded (${detector.mode}, ${detector.delegate})`);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('[PhysioAlign] Error loading model:', err);
        setError('Failed to load posture AI model. Please check your internet and reload.');
        onStatusChange?.({ isLoaded: false, error: 'Failed to load AI model' });
      });

    return () => {
      cancelled = true;
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
      detectorRef.current?.close();
      detectorRef.current = null;
    };
  }, []);

  // Prediction loop. only one frame is in flight at a time, so a slow frame is
  // dropped instead of queueing up behind the camera
  useEffect(() => {
    // dispatchMs is what the main thread spent handing the frame over (worker mode)
    const handleResult = (result: PoseResult, frameStart: number, dispatchMs: number, inWorker: boolean) => {
      const handleStart = performance.now();
      const canvas = canvasRef.current;
      if (!result.landmarks) {
        if (personVisibleRef.current) {
          personVisibleRef.current = false;
          onPoseLost?.();
        }
        const ctx = canvas?.getContext('2d');
        if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
        return;
      }

      personVisibleRef.current = true;
      const keypoints = result.landmarks;
      const angles = calculateAngles(keypoints, result.worldLandmarks ?? undefined);
      if (angles) onPoseDetected({ keypoints, angles });

      if (canvas) drawSkeleton(keypoints, canvas);

      const now = performance.now();
      const handlingMs = now - handleStart;
      recordFrame({
        // camera frame in to feedback out, including the model
        totalMs: now - frameStart,
        // how long the ui thread was blocked for this frame
        mainThreadMs: (inWorker ? dispatchMs : result.inferenceMs) + handlingMs,
        lowVisibility: keypoints.some((kp) => kp.visibility > 0 && kp.visibility < 0.6),
      });

      frameCountRef.current++;
      if (now - lastFpsTimeRef.current >= 1000) {
        setFps(frameCountRef.current);
        frameCountRef.current = 0;
        lastFpsTimeRef.current = now;
      }
    };

    const detectPose = () => {
      animationFrameIdRef.current = requestAnimationFrame(detectPose);

      const detector = detectorRef.current;
      const video = webcamRef.current?.video;
      if (!detector || busyRef.current || !video || video.readyState !== 4) return;

      // Skip processing if the video frame hasn't updated
      if (video.currentTime === lastVideoTimeRef.current) return;
      lastVideoTimeRef.current = video.currentTime;

      // Ensure canvas matches video dimensions
      const canvas = canvasRef.current;
      if (canvas && (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight)) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }

      let timestamp = performance.now();
      if (timestamp <= lastTimestampRef.current) timestamp = lastTimestampRef.current + 1;
      lastTimestampRef.current = timestamp;

      busyRef.current = true;
      const frameStart = performance.now();
      const pending = detector.detect(video, timestamp);
      // on the worker path the main thread only pays for grabbing the frame
      const dispatchMs = performance.now() - frameStart;

      pending
        .then((result) => handleResult(result, frameStart, dispatchMs, detector.mode === 'worker'))
        .catch((err) => console.error('[PhysioAlign] Detection error:', err))
        .finally(() => {
          busyRef.current = false;
        });
    };

    if (isCameraActive && isModelLoaded) {
      detectPose();
    }

    return () => {
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
    };
  }, [isCameraActive, isModelLoaded, onPoseDetected, onPoseLost]);

  // Draw pose skeleton connections
  const drawSkeleton = (keypoints: Keypoint[], canvas: HTMLCanvasElement) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = canvas;
    ctx.clearRect(0, 0, width, height);

    // List of key point pairings representing bones
    const connections = [
      [11, 13], [13, 15], // Left arm
      [12, 14], [14, 16], // Right arm
      [11, 12],           // Shoulders
      [11, 23], [12, 24], // Torso
      [23, 24],           // Hips
      [23, 25], [25, 27], // Left leg
      [24, 26], [26, 28], // Right leg
      [27, 31], [28, 32], // Feet
    ];

    // 1. Draw Bones (Bridges)
    ctx.strokeStyle = '#2dd4bf';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';

    connections.forEach(([i1, i2]) => {
      const p1 = keypoints[i1];
      const p2 = keypoints[i2];

      // Only draw if both points are highly visible
      if (p1 && p2 && p1.visibility > 0.5 && p2.visibility > 0.5) {
        ctx.beginPath();
        ctx.moveTo(p1.x * width, p1.y * height);
        ctx.lineTo(p2.x * width, p2.y * height);
        ctx.stroke();
      }
    });

    // 2. Draw Joint Markers
    keypoints.forEach((kp, idx) => {
      // Only draw critical joints (shoulders, elbows, wrists, hips, knees, ankles)
      const criticalJoints = [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28];
      if (!criticalJoints.includes(idx)) return;

      if (kp.visibility > 0.5) {
        ctx.fillStyle = 'rgba(15, 23, 42, 0.55)';
        ctx.beginPath();
        ctx.arc(kp.x * width, kp.y * height, 7, 0, 2 * Math.PI);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(kp.x * width, kp.y * height, 3.5, 0, 2 * Math.PI);
        ctx.fill();
      }
    });
  };

  const handleCameraStart = () => {
    setIsCameraActive(true);
    setError(null);
  };

  const handleCameraError = () => {
    setIsCameraActive(false);
    setError('Webcam access was denied. Please grant camera permission in your browser.');
    if (onStatusChange) onStatusChange({ isLoaded: isModelLoaded, error: 'Webcam access denied' });
  };

  return (
    <div className="camera">
      {error ? (
        <div className="camera__overlay">
          <span className="icon-tile" style={{ background: 'var(--danger-50)', color: 'var(--danger-600)' }}>
            <AlertCircle size={18} />
          </span>
          <div className="text-sm semibold" style={{ color: 'var(--text)' }}>
            Camera unavailable
          </div>
          <p className="text-sm muted" style={{ maxWidth: 320 }}>
            {error}
          </p>
        </div>
      ) : (
        <>
          {(!isModelLoaded || !isCameraActive) && (
            <div className="camera__overlay">
              <span className="spinner spinner--lg" />
              <div className="text-sm semibold" style={{ color: 'var(--text)' }}>
                {!isModelLoaded ? 'Loading the pose model' : 'Starting your camera'}
              </div>
              <p className="text-sm muted">
                {!isModelLoaded ? 'This happens once, then it is cached.' : 'Allow camera access to continue.'}
              </p>
            </div>
          )}

          {poseImage && (
            <figure className="camera__reference">
              <img src={poseImage} alt={poseName || 'Target pose'} />
              <figcaption>Target</figcaption>
            </figure>
          )}

          <Webcam
            ref={webcamRef}
            audio={false}
            className="camera__feed"
            onUserMedia={handleCameraStart}
            onUserMediaError={handleCameraError}
            screenshotFormat="image/jpeg"
            videoConstraints={{
              facingMode: 'user',
              width: 640,
              height: 480,
            }}
          />

          <canvas ref={canvasRef} className="camera__canvas" />

          {isModelLoaded && isCameraActive && (
            <div className="camera__chip camera__chip--br">
              <span className="badge__dot" style={{ background: '#4ade80' }} />
              {fps} fps{detectorMode === 'worker' ? ' · worker' : ''}
            </div>
          )}
        </>
      )}
    </div>
  );
});

AIEngine.displayName = 'AIEngine';
