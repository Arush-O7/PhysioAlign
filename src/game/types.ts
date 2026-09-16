export type Screen = 'landing' | 'splash' | 'onboarding' | 'dashboard' | 'library' | 'session' | 'debrief' | 'doctor' | 'admin' | 'pending';

// a second only counts towards hold time when the score is at or above this
export const HOLD_SCORE_THRESHOLD = 70;

export interface UserData {
  name: string;
  age: number;
  experience: 'beginner' | 'intermediate' | 'advanced';
  goal: 'flexibility' | 'strength' | 'balance' | 'rehabilitation';
  role: 'patient' | 'doctor' | 'admin' | 'pending';
  doctor_id?: string | null;
  care_plan?: string | null;
  approved?: boolean;
}

export type JointName =
  | 'leftKnee'
  | 'rightKnee'
  | 'leftHip'
  | 'rightHip'
  | 'leftShoulder'
  | 'rightShoulder'
  | 'leftElbow'
  | 'rightElbow'
  | 'leftAnkle'
  | 'rightAnkle';

export interface JointAngleConfig {
  min: number;
  max: number;
  optimal: number;
  label: string;
}

export interface PoseConfig {
  id: string;
  name: string;
  description: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  instructions: string[];
  commonMistakes: string[];
  targetMuscles: string[];
  targetAngles: Partial<Record<JointName, JointAngleConfig>>;
  visibilityRequirements: string[];
  image: string;
}

export interface FrameLog {
  timestamp: number;
  score: number;
  angles: Record<string, number>;
  feedbackMessage: string;
}

export interface SessionData {
  id: string;
  poseId: string;
  poseName: string;
  date: number;
  durationSeconds: number;
  holdTimeSeconds: number;
  averageScore: number;
  grade: 'A' | 'B' | 'C' | 'F';
  aiCritique?: string;
  frameLogs: FrameLog[];
}

export interface Tweaks {
  palette: 'sunshine';
  avatarStyle: 'portrait';
  intensity: number;
}
