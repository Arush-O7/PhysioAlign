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
 * Calculate the angle between three points (p1, p2, p3)
 * where p2 is the vertex (e.g. elbow vertex between shoulder and wrist)
 * 
 * In vector geometry, the angle θ between vector V1 (p1 - p2) and vector V2 (p3 - p2) is:
 * cos(θ) = (V1 · V2) / (||V1|| * ||V2||)
 * θ = arccos( (V1 · V2) / (||V1|| * ||V2||) )
 */
export const getAngle = (p1: Keypoint, p2: Keypoint, p3: Keypoint): number => {
  // Vector 1 from vertex p2 to p1 (2D projection)
  const vector1 = {
    x: p1.x - p2.x,
    y: p1.y - p2.y,
  };

  // Vector 2 from vertex p2 to p3 (2D projection)
  const vector2 = {
    x: p3.x - p2.x,
    y: p3.y - p2.y,
  };

  // Dot product of vector1 and vector2 in 2D
  const dotProduct = vector1.x * vector2.x + vector1.y * vector2.y;

  // Magnitudes of vector1 and vector2 in 2D
  const magnitude1 = Math.sqrt(vector1.x ** 2 + vector1.y ** 2);
  const magnitude2 = Math.sqrt(vector2.x ** 2 + vector2.y ** 2);

  // Avoid division by zero
  if (magnitude1 * magnitude2 === 0) return 0;

  // Calculate angle in radians
  const angleRad = Math.acos(dotProduct / (magnitude1 * magnitude2));

  // Convert to degrees
  const angleDeg = (angleRad * 180) / Math.PI;

  return Math.round(angleDeg);
};

/**
 * Calculate all relevant joint angles based on body coordinates
 */
export const calculateAngles = (keypoints: Keypoint[]): Record<string, number> | null => {
  if (!keypoints || keypoints.length < 33) return null;

  try {
    return {
      // Knee: Hip -> Knee -> Ankle
      leftKnee: getAngle(
        keypoints[POSE_LANDMARKS.LEFT_HIP],
        keypoints[POSE_LANDMARKS.LEFT_KNEE],
        keypoints[POSE_LANDMARKS.LEFT_ANKLE]
      ),
      rightKnee: getAngle(
        keypoints[POSE_LANDMARKS.RIGHT_HIP],
        keypoints[POSE_LANDMARKS.RIGHT_KNEE],
        keypoints[POSE_LANDMARKS.RIGHT_ANKLE]
      ),

      // Hip: Shoulder -> Hip -> Knee
      leftHip: getAngle(
        keypoints[POSE_LANDMARKS.LEFT_SHOULDER],
        keypoints[POSE_LANDMARKS.LEFT_HIP],
        keypoints[POSE_LANDMARKS.LEFT_KNEE]
      ),
      rightHip: getAngle(
        keypoints[POSE_LANDMARKS.RIGHT_SHOULDER],
        keypoints[POSE_LANDMARKS.RIGHT_HIP],
        keypoints[POSE_LANDMARKS.RIGHT_KNEE]
      ),

      // Elbow: Shoulder -> Elbow -> Wrist
      leftElbow: getAngle(
        keypoints[POSE_LANDMARKS.LEFT_SHOULDER],
        keypoints[POSE_LANDMARKS.LEFT_ELBOW],
        keypoints[POSE_LANDMARKS.LEFT_WRIST]
      ),
      rightElbow: getAngle(
        keypoints[POSE_LANDMARKS.RIGHT_SHOULDER],
        keypoints[POSE_LANDMARKS.RIGHT_ELBOW],
        keypoints[POSE_LANDMARKS.RIGHT_WRIST]
      ),

      // Shoulder: Elbow -> Shoulder -> Hip
      leftShoulder: getAngle(
        keypoints[POSE_LANDMARKS.LEFT_ELBOW],
        keypoints[POSE_LANDMARKS.LEFT_SHOULDER],
        keypoints[POSE_LANDMARKS.LEFT_HIP]
      ),
      rightShoulder: getAngle(
        keypoints[POSE_LANDMARKS.RIGHT_ELBOW],
        keypoints[POSE_LANDMARKS.RIGHT_SHOULDER],
        keypoints[POSE_LANDMARKS.RIGHT_HIP]
      ),

      // Ankle: Knee -> Ankle -> Foot Index
      leftAnkle: getAngle(
        keypoints[POSE_LANDMARKS.LEFT_KNEE],
        keypoints[POSE_LANDMARKS.LEFT_ANKLE],
        keypoints[POSE_LANDMARKS.LEFT_FOOT_INDEX]
      ),
      rightAnkle: getAngle(
        keypoints[POSE_LANDMARKS.RIGHT_KNEE],
        keypoints[POSE_LANDMARKS.RIGHT_ANKLE],
        keypoints[POSE_LANDMARKS.RIGHT_FOOT_INDEX]
      ),
    };
  } catch (error) {
    console.error('[angleCalculations] Error in angle mapping:', error);
    return null;
  }
};
