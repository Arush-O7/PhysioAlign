import { useSyncExternalStore } from 'react';
import { apiFetch } from '../utils/api';
import { Screen, UserData, SessionData, Tweaks, HOLD_SCORE_THRESHOLD } from './types';

interface PhysioState {
  screen: Screen;
  activeTab: 'dashboard' | 'trends' | 'consult';
  userData: UserData | null;
  activePoseId: string | null;
  activeSession: SessionData | null;
  sessionHistory: SessionData[];
  tweaks: Tweaks;
}

class PhysioStore {
  private state: PhysioState;
  private listeners = new Set<() => void>();

  constructor() {
    this.state = {
      screen: 'splash',
      activeTab: 'dashboard',
      userData: null,
      activePoseId: null,
      activeSession: null,
      sessionHistory: [],
      tweaks: {
        palette: 'sunshine',
        avatarStyle: 'portrait',
        intensity: 2,
      },
    };
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getState = () => {
    return this.state;
  };

  private notify() {
    this.listeners.forEach((l) => l());
  }

  setScreen(screen: Screen) {
    this.state = { ...this.state, screen };
    this.notify();
  }

  setUserData(userData: UserData | null) {
    this.state = { ...this.state, userData };
    this.notify();
  }

  setActiveTab(activeTab: 'dashboard' | 'trends' | 'consult') {
    this.state = { ...this.state, screen: 'dashboard', activeTab };
    this.notify();
  }

  // returns an error message if the profile couldn't be saved
  async saveOnboarding(userData: UserData): Promise<string | null> {
    try {
      const res = await apiFetch('/api/users', {
        method: 'POST',
        body: JSON.stringify({
          name: userData.name,
          age: userData.age,
          experience: userData.experience,
          goal: userData.goal,
          role: userData.role
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        return data.error || 'Could not save your profile. Please try again.';
      }

      const profile = await res.json();
      this.state = {
        ...this.state,
        userData: {
          name: profile.name,
          age: profile.age,
          experience: profile.experience,
          goal: profile.goal,
          role: profile.role,
          doctor_id: profile.doctor_id,
          care_plan: profile.care_plan
        },
        screen: profile.role === 'doctor' ? 'doctor' : profile.role === 'admin' ? 'admin' : 'dashboard',
      };
      this.notify();
      return null;
    } catch (err) {
      console.error('[PhysioStore] Failed to save profile to backend:', err);
      return 'Could not reach the server. Please try again.';
    }
  }

  async resetOnboarding(clerkId: string) {
    try {
      // Reset user data and sessions
      const res = await apiFetch(`/api/sessions/${clerkId}`);
      if (res.ok) {
        const sessions = await res.json();
        for (const s of sessions) {
          await apiFetch(`/api/sessions/${s.id}`, { method: 'DELETE' });
        }
      }
      
      this.state = {
        ...this.state,
        userData: null,
        sessionHistory: [],
        screen: 'onboarding',
      };
      this.notify();
    } catch (err) {
      console.error('[PhysioStore] Failed to reset profile on backend:', err);
    }
  }

  selectPose(poseId: string) {
    this.state = {
      ...this.state,
      activePoseId: poseId,
      screen: 'session',
    };
    this.notify();
  }

  startSession(poseId: string, poseName: string) {
    const activeSession: SessionData = {
      id: Math.random().toString(36).substring(2, 11),
      poseId,
      poseName,
      date: Date.now(),
      durationSeconds: 0,
      holdTimeSeconds: 0,
      averageScore: 0,
      grade: 'F',
      frameLogs: [],
    };

    this.state = {
      ...this.state,
      activeSession,
    };
    this.notify();
  }

  updateSessionLogs(frameLog: { timestamp: number; score: number; angles: Record<string, number>; feedbackMessage: string }) {
    if (!this.state.activeSession) return;

    const updatedLogs = [...this.state.activeSession.frameLogs, frameLog];
    
    const durationSeconds = this.state.activeSession.durationSeconds + 1;
    const holdTimeSeconds = this.state.activeSession.holdTimeSeconds + (frameLog.score >= HOLD_SCORE_THRESHOLD ? 1 : 0);
    
    const totalScore = updatedLogs.reduce((sum, log) => sum + log.score, 0);
    const averageScore = Math.round(totalScore / updatedLogs.length);

    let grade: 'A' | 'B' | 'C' | 'F' = 'F';
    if (averageScore >= 85) grade = 'A';
    else if (averageScore >= 70) grade = 'B';
    else if (averageScore >= 50) grade = 'C';

    this.state = {
      ...this.state,
      activeSession: {
        ...this.state.activeSession,
        durationSeconds,
        holdTimeSeconds,
        averageScore,
        grade,
        frameLogs: updatedLogs,
      },
    };
    this.notify();
  }

  async completeActiveSession() {
    const session = this.state.activeSession;
    if (!session) return;

    // Show generating state in UI while waiting for POST request
    this.state = {
      ...this.state,
      activeSession: {
        ...session,
        aiCritique: 'Generating...',
      },
      screen: 'debrief',
    };
    this.notify();

    try {
      const res = await apiFetch('/api/sessions', {
        method: 'POST',
        body: JSON.stringify({
          id: session.id,
          poseId: session.poseId,
          poseName: session.poseName,
          date: session.date,
          durationSeconds: session.durationSeconds,
          holdTimeSeconds: session.holdTimeSeconds,
          averageScore: session.averageScore,
          grade: session.grade,
          frameLogs: session.frameLogs,
        }),
      });

      if (res.ok) {
        const savedSession: SessionData = await res.json();
        const newHistory = [savedSession, ...this.state.sessionHistory];
        this.state = {
          ...this.state,
          sessionHistory: newHistory,
          activeSession: savedSession,
        };
        this.notify();
      } else {
        console.error('[PhysioStore] Failed to save session to backend, response status:', res.status);
        this.markCritiqueFailed();
      }
    } catch (err) {
      console.error('[PhysioStore] Failed to save session to backend:', err);
      this.markCritiqueFailed();
    }
  }

  // without this the debrief screen stays stuck on the loading state
  private markCritiqueFailed() {
    if (!this.state.activeSession) return;
    this.state = {
      ...this.state,
      activeSession: {
        ...this.state.activeSession,
        aiCritique: "Couldn't save this session or generate a report. Check that the backend is running and try again.",
      },
    };
    this.notify();
  }

  async syncHistory(clerkId: string) {
    try {
      const res = await apiFetch(`/api/sessions/${clerkId}`);
      if (res.ok) {
        const history = await res.json();
        this.state = {
          ...this.state,
          sessionHistory: history,
        };
        this.notify();
      }
    } catch (err) {
      console.error('[PhysioStore] Failed to sync history from backend:', err);
    }
  }

  async deleteSession(sessionId: string, clerkId: string) {
    try {
      const res = await apiFetch(`/api/sessions/${sessionId}`, { method: 'DELETE' });
      if (res.ok) {
        await this.syncHistory(clerkId);
      }
    } catch (err) {
      console.error('[PhysioStore] Failed to delete session from backend:', err);
    }
  }

  cancelActiveSession() {
    this.state = {
      ...this.state,
      activeSession: null,
      activePoseId: null,
      screen: 'dashboard',
    };
    this.notify();
  }
}

export const store = new PhysioStore();

export function useScreen(): Screen {
  return useSyncExternalStore(store.subscribe, () => store.getState().screen);
}

export function useActiveTab(): 'dashboard' | 'trends' | 'consult' {
  return useSyncExternalStore(store.subscribe, () => store.getState().activeTab);
}

export function useUserData(): UserData | null {
  return useSyncExternalStore(store.subscribe, () => store.getState().userData);
}

export function useActivePoseId(): string | null {
  return useSyncExternalStore(store.subscribe, () => store.getState().activePoseId);
}

export function useActiveSession(): SessionData | null {
  return useSyncExternalStore(store.subscribe, () => store.getState().activeSession);
}

export function useSessionHistory(): SessionData[] {
  return useSyncExternalStore(store.subscribe, () => store.getState().sessionHistory);
}

export function useTweaks(): Tweaks {
  return useSyncExternalStore(store.subscribe, () => store.getState().tweaks);
}
