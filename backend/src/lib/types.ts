export type Role = 'patient' | 'doctor' | 'admin';

export interface CarePlanItem {
  poseId: string;
  poseName?: string;
  targetHold: number;
  frequency?: string;
}

export interface FrameLog {
  timestamp: number;
  score: number;
  angles: Record<string, number>;
  feedbackMessage: string;
}

export interface UserRow {
  user_id: string;
  name: string;
  email: string | null;
  age: number | null;
  experience: string | null;
  goal: string | null;
  role: Role;
  doctor_id: string | null;
  care_plan: CarePlanItem[] | null;
  password_hash: string | null;
  approved: boolean;
  created_at: Date;
}

export interface SessionRow {
  id: string;
  user_id: string;
  pose_id: string;
  pose_name: string;
  date: number;
  duration_seconds: number;
  hold_time_seconds: number;
  average_score: number;
  grade: string;
  ai_critique: string | null;
  critique_status: 'pending' | 'ready' | 'failed';
  critique_attempts: number;
  frame_logs: FrameLog[];
}

export interface AuthContext {
  id: string;
  email: string | null;
  user: UserRow | null;
  // doctors waiting for approval get 'pending_doctor' so they have no staff access
  role: Role | 'pending_doctor' | null;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth: AuthContext;
    }
  }
}
