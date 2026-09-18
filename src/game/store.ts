import { useSyncExternalStore } from 'react';
import { apiFetch } from '../utils/api';
import { logSaveTiming } from '../utils/perf';
import { Screen, UserData, SessionData, Tweaks, HOLD_SCORE_THRESHOLD } from './types';

export function profileFromApi(profile: any): UserData {
  return {
    name: profile.name,
    age: profile.age,
    experience: profile.experience,
    goal: profile.goal,
    role: profile.role,
    doctorId: profile.doctorId ?? null,
    carePlan: Array.isArray(profile.carePlan) ? profile.carePlan : [],
    approved: profile.approved !== false,
  };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function screenForProfile(profile: UserData): Screen {
  if (profile.role === 'admin') return 'admin';
  if (profile.role === 'doctor') return profile.approved === false ? 'pending' : 'doctor';
  // email signups only have name/role, so patients still need to fill in onboarding
  return profile.age ? 'dashboard' : 'onboarding';
}

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
      const res = await apiFetch('/api/users/me', {
        method: 'PUT',
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

      const profile = profileFromApi(await res.json());
      this.state = {
        ...this.state,
        userData: profile,
        screen: screenForProfile(profile),
      };
      this.notify();
      return null;
    } catch (err) {
      console.error('[PhysioStore] Failed to save profile to backend:', err);
      return 'Could not reach the server. Please try again.';
    }
  }

  async resetOnboarding(userId: string) {
    try {
      // Reset user data and sessions
      const res = await apiFetch(`/api/users/${userId}/sessions`);
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

  private updateSession(id: string, patch: Partial<SessionData>) {
    const active = this.state.activeSession;
    this.state = {
      ...this.state,
      activeSession: active && active.id === id ? { ...active, ...patch } : active,
      sessionHistory: this.state.sessionHistory.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    };
    this.notify();
  }

  // saves the session, then waits for the critique that the server writes in the background
  async completeActiveSession() {
    const session = this.state.activeSession;
    if (!session) return;

    this.state = {
      ...this.state,
      activeSession: { ...session, aiCritique: null, critiqueStatus: 'saving' },
      screen: 'debrief',
    };
    this.notify();

    try {
      const payloadString = JSON.stringify({
        id: session.id,
        poseId: session.poseId,
        poseName: session.poseName,
        date: session.date,
        durationSeconds: session.durationSeconds,
        holdTimeSeconds: session.holdTimeSeconds,
        averageScore: session.averageScore,
        grade: session.grade,
        frameLogs: session.frameLogs,
      });
      const saveStart = performance.now();

      const res = await apiFetch('/api/sessions', {
        method: 'POST',
        body: payloadString,
      });

      logSaveTiming(performance.now() - saveStart, session.frameLogs.length, payloadString.length);

      if (!res.ok) {
        console.error('[PhysioStore] Failed to save session, status:', res.status);
        this.updateSession(session.id, { critiqueStatus: 'unsaved' });
        return;
      }

      const saved: SessionData = await res.json();
      this.state = {
        ...this.state,
        sessionHistory: [saved, ...this.state.sessionHistory.filter((s) => s.id !== saved.id)],
        activeSession: saved,
      };
      this.notify();
      await this.waitForCritique(saved.id);
    } catch (err) {
      console.error('[PhysioStore] Failed to save session:', err);
      this.updateSession(session.id, { critiqueStatus: 'unsaved' });
    }
  }

  // polls with backoff, gives up after about three minutes
  private async waitForCritique(id: string) {
    const deadline = Date.now() + 3 * 60 * 1000;
    let delay = 1000;
    while (Date.now() < deadline) {
      await sleep(delay);
      delay = Math.min(delay * 1.5, 5000);
      try {
        const res = await apiFetch(`/api/sessions/${id}`);
        if (!res.ok) continue;
        const session: SessionData = await res.json();
        if (session.critiqueStatus !== 'pending') {
          this.updateSession(id, { aiCritique: session.aiCritique, critiqueStatus: session.critiqueStatus });
          return;
        }
      } catch {
        // network blip, keep polling
      }
    }
    this.updateSession(id, { critiqueStatus: 'failed' });
  }

  async retryCritique(id: string) {
    this.updateSession(id, { critiqueStatus: 'pending' });
    try {
      const res = await apiFetch(`/api/sessions/${id}/critique/retry`, { method: 'POST' });
      if (!res.ok) {
        this.updateSession(id, { critiqueStatus: 'failed' });
        return;
      }
      await this.waitForCritique(id);
    } catch {
      this.updateSession(id, { critiqueStatus: 'failed' });
    }
  }

  async syncHistory(userId: string) {
    try {
      const res = await apiFetch(`/api/users/${userId}/sessions`);
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

  async deleteSession(sessionId: string, userId: string) {
    try {
      const res = await apiFetch(`/api/sessions/${sessionId}`, { method: 'DELETE' });
      if (res.ok) {
        await this.syncHistory(userId);
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
