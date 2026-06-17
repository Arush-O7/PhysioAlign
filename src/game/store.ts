import { useSyncExternalStore } from 'react';
import { Screen, UserData, SessionData, Tweaks } from './types';

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

  setActiveTab(activeTab: 'dashboard' | 'trends' | 'consult') {
    this.state = { ...this.state, screen: 'dashboard', activeTab };
    this.notify();
  }

  async saveOnboarding(userData: UserData, clerkId: string, email: string) {
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clerkId,
          name: userData.name,
          email,
          age: userData.age,
          experience: userData.experience,
          goal: userData.goal,
          role: userData.role
        }),
      });

      const nextScreen = userData.role === 'doctor' ? 'doctor' : userData.role === 'admin' ? 'admin' : 'dashboard';

      if (res.ok) {
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
      } else {
        console.warn('[PhysioStore] Backend profile save returned error, falling back to local state.');
        this.state = {
          ...this.state,
          userData,
          screen: nextScreen,
        };
        this.notify();
      }
    } catch (err) {
      console.error('[PhysioStore] Failed to save profile to backend, falling back to local state:', err);
      const nextScreen = userData.role === 'doctor' ? 'doctor' : userData.role === 'admin' ? 'admin' : 'dashboard';
      this.state = {
        ...this.state,
        userData,
        screen: nextScreen,
      };
      this.notify();
    }
  }

  async resetOnboarding(clerkId: string) {
    try {
      // Reset user data and sessions
      const res = await fetch(`/api/sessions/${clerkId}`);
      if (res.ok) {
        const sessions = await res.json();
        for (const s of sessions) {
          await fetch(`/api/sessions/${s.id}`, { method: 'DELETE' });
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
    const holdTimeSeconds = this.state.activeSession.holdTimeSeconds + (frameLog.score >= 75 ? 1 : 0);
    
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

  async completeActiveSession(clerkId: string) {
    if (!this.state.activeSession) return;

    const completedSession: SessionData = {
      ...this.state.activeSession,
      aiCritique: 'Generating...',
    };

    try {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: completedSession.id,
          clerkId,
          poseId: completedSession.poseId,
          poseName: completedSession.poseName,
          date: completedSession.date,
          durationSeconds: completedSession.durationSeconds,
          holdTimeSeconds: completedSession.holdTimeSeconds,
          averageScore: completedSession.averageScore,
          grade: completedSession.grade,
          frameLogs: completedSession.frameLogs,
        }),
      });

      if (res.ok) {
        const newHistory = [completedSession, ...this.state.sessionHistory];
        this.state = {
          ...this.state,
          sessionHistory: newHistory,
          activeSession: completedSession,
          screen: 'debrief',
        };
        this.notify();

        this.pollSessionCritique(completedSession.id, clerkId);
      }
    } catch (err) {
      console.error('[PhysioStore] Failed to save session to backend:', err);
    }
  }

  async pollSessionCritique(sessionId: string, clerkId: string) {
    const check = async () => {
      try {
        const res = await fetch(`/api/sessions/detail/${sessionId}`);
        if (res.ok) {
          const session = await res.json();
          if (session.aiCritique && session.aiCritique !== 'Generating...') {
            if (this.state.activeSession?.id === sessionId) {
              this.state = {
                ...this.state,
                activeSession: {
                  ...this.state.activeSession,
                  aiCritique: session.aiCritique,
                },
              };
              this.notify();
            }
            await this.syncHistory(clerkId);
            return true;
          }
        }
      } catch (e) {
        console.error('[PhysioStore] Critique polling error:', e);
      }
      return false;
    };

    let attempts = 0;
    const interval = setInterval(async () => {
      attempts++;
      const isDone = await check();
      if (isDone || attempts >= 20) {
        clearInterval(interval);
      }
    }, 3000);
  }

  async syncHistory(clerkId: string) {
    try {
      const res = await fetch(`/api/sessions/${clerkId}`);
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
      const res = await fetch(`/api/sessions/${sessionId}`, { method: 'DELETE' });
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
