export interface Keypoint {
  x: number;
  y: number;
  z: number;
  visibility: number;
}

export const POSE_LANDMARKS = {
  // Face
  NOSE: 0,
  // Upper Body
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  // Lower Body
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
  // Feet
  LEFT_HEEL: 29,
  RIGHT_HEEL: 30,
  LEFT_FOOT_INDEX: 31,
  RIGHT_FOOT_INDEX: 32,
};

/**
 * Angle at p2 between p1 and p3: acos((V1 · V2) / (|V1| |V2|)).
 * With world landmarks this is a real 3D joint angle, so it doesn't change
 * depending on which way you face the camera.
 */
export const getAngle = (p1: Keypoint, p2: Keypoint, p3: Keypoint, use3d = false): number => {
  const v1 = { x: p1.x - p2.x, y: p1.y - p2.y, z: use3d ? p1.z - p2.z : 0 };
  const v2 = { x: p3.x - p2.x, y: p3.y - p2.y, z: use3d ? p3.z - p2.z : 0 };

  const dotProduct = v1.x * v2.x + v1.y * v2.y + v1.z * v2.z;
  const magnitude1 = Math.hypot(v1.x, v1.y, v1.z);
  const magnitude2 = Math.hypot(v2.x, v2.y, v2.z);

  if (magnitude1 * magnitude2 === 0) return 0;

  // clamp, rounding can push the ratio just past ±1 and acos returns NaN
  const cos = Math.min(1, Math.max(-1, dotProduct / (magnitude1 * magnitude2)));
  return Math.round((Math.acos(cos) * 180) / Math.PI);
};

const L = POSE_LANDMARKS;

// [first point, vertex, last point] for each joint
const JOINTS: Record<string, [number, number, number]> = {
  leftKnee: [L.LEFT_HIP, L.LEFT_KNEE, L.LEFT_ANKLE],
  rightKnee: [L.RIGHT_HIP, L.RIGHT_KNEE, L.RIGHT_ANKLE],
  leftHip: [L.LEFT_SHOULDER, L.LEFT_HIP, L.LEFT_KNEE],
  rightHip: [L.RIGHT_SHOULDER, L.RIGHT_HIP, L.RIGHT_KNEE],
  leftElbow: [L.LEFT_SHOULDER, L.LEFT_ELBOW, L.LEFT_WRIST],
  rightElbow: [L.RIGHT_SHOULDER, L.RIGHT_ELBOW, L.RIGHT_WRIST],
  leftShoulder: [L.LEFT_ELBOW, L.LEFT_SHOULDER, L.LEFT_HIP],
  rightShoulder: [L.RIGHT_ELBOW, L.RIGHT_SHOULDER, L.RIGHT_HIP],
  leftAnkle: [L.LEFT_KNEE, L.LEFT_ANKLE, L.LEFT_FOOT_INDEX],
  rightAnkle: [L.RIGHT_KNEE, L.RIGHT_ANKLE, L.RIGHT_FOOT_INDEX],
};

/**
 * Joint angles for the whole body. Pass MediaPipe's world landmarks (metres,
 * hip-centred) to get 3D angles. The normalised image landmarks are only a 2D
 * fallback, and they're skewed by the camera's aspect ratio.
 */
export const calculateAngles = (keypoints: Keypoint[], worldKeypoints?: Keypoint[]): Record<string, number> | null => {
  const use3d = !!worldKeypoints && worldKeypoints.length >= 33;
  const points = use3d ? worldKeypoints! : keypoints;
  if (!points || points.length < 33) return null;

  const angles: Record<string, number> = {};
  for (const [joint, [a, b, c]] of Object.entries(JOINTS)) {
    angles[joint] = getAngle(points[a], points[b], points[c], use3d);
  }
  return angles;
};
