import { useCallback, useSyncExternalStore } from 'react';
import { store, screenForProfile } from './store';
import { apiFetch } from '../utils/api';
import { POSES } from '../data/poses';
import type { Screen, SessionData, UserData } from './types';

// The screen store stays the source of truth; this keeps the address bar in step with it
// so screens, dashboard tabs, filters and the open patient can be linked, reloaded and
// reached with back/forward.
//
//   /                      home (landing)
//   /dashboard             patient dashboard        /dashboard/trends   analytics tab
//   /coaches               coach chat (?coach=)     /poses              pose library
//   /session/:poseId       live practice            /report/:sessionId  session report
//   /patients              clinician portal (?view=all, ?q=, ?patient=)
//   /accounts              admin portal (?q=)       /profile            profile setup
//   /sign-in, /sign-in/:role   signed-out sign-in screens

type Tab = 'dashboard' | 'trends' | 'consult';
interface Route {
  screen: Screen;
  tab?: Tab;
  poseId?: string;
  sessionId?: string;
}

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const onUrlChange = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
window.addEventListener('popstate', emit);

export function navigate(url: string, { replace = false } = {}) {
  if (url === location.pathname + location.search) return;
  history[replace ? 'replaceState' : 'pushState'](null, '', url);
  emit();
}

export function pathForState(state: ReturnType<typeof store.getState>): string | null {
  switch (state.screen) {
    case 'dashboard':
      return state.activeTab === 'trends' ? '/dashboard/trends' : state.activeTab === 'consult' ? '/coaches' : '/dashboard';
    case 'library':
      return '/poses';
    case 'session':
      return state.activePoseId ? `/session/${state.activePoseId}` : '/poses';
    case 'debrief':
      return state.activeSession ? `/report/${state.activeSession.id}` : '/dashboard';
    case 'doctor':
      return '/patients';
    case 'admin':
      return '/accounts';
    case 'onboarding':
      return '/profile';
    case 'pending':
      return '/pending';
    case 'landing':
      return '/';
    default:
      return null;
  }
}

export function parsePath(path: string): Route | null {
  const [first, second] = path.split('/').filter(Boolean);
  switch (first) {
    case undefined:
      return { screen: 'landing' };
    case 'dashboard':
      return { screen: 'dashboard', tab: second === 'trends' ? 'trends' : 'dashboard' };
    case 'coaches':
      return { screen: 'dashboard', tab: 'consult' };
    case 'poses':
      return { screen: 'library' };
    case 'session':
      return second ? { screen: 'session', poseId: decodeURIComponent(second) } : { screen: 'library' };
    case 'report':
      return second ? { screen: 'debrief', sessionId: decodeURIComponent(second) } : null;
    case 'patients':
      return { screen: 'doctor' };
    case 'accounts':
      return { screen: 'admin' };
    case 'profile':
      return { screen: 'onboarding' };
    case 'pending':
      return { screen: 'pending' };
    default:
      return null;
  }
}

const PATIENT_SCREENS = new Set<Screen>(['landing', 'dashboard', 'library', 'session', 'debrief', 'onboarding']);

function allowed(route: Route, profile: UserData) {
  const home = screenForProfile(profile);
  if (route.screen === 'onboarding') return true;
  if (profile.role !== 'patient' || home === 'onboarding') return route.screen === home;
  return PATIENT_SCREENS.has(route.screen);
}

async function findSession(id: string): Promise<SessionData | null> {
  const known = store.getState().sessionHistory.find((s) => s.id === id);
  if (known) return known;
  try {
    const res = await apiFetch(`/api/sessions/${encodeURIComponent(id)}`);
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

// moves the store to whatever the address bar says, or to the role's home screen when
// the address doesn't name a screen this account can open
export async function applyUrl() {
  const profile = store.getState().userData;
  if (!profile) return;
  const route = parsePath(location.pathname);
  const home = screenForProfile(profile);
  const goHome = () => (home === 'dashboard' ? store.setActiveTab('dashboard') : store.setScreen(home));

  if (!route || !allowed(route, profile)) return goHome();

  if (route.screen === 'dashboard') return store.setActiveTab(route.tab ?? 'dashboard');
  if (route.screen === 'session') {
    if (!POSES.some((p) => p.id === route.poseId)) return store.setScreen('library');
    // a live session can't be resumed from a link, so start the pose fresh
    if (store.getState().activePoseId !== route.poseId) store.selectPose(route.poseId!);
    else store.setScreen('session');
    return;
  }
  if (route.screen === 'debrief') {
    const session = await findSession(route.sessionId!);
    return session ? store.viewSession(session) : goHome();
  }
  store.setScreen(route.screen);
}

let started = false;

// call once the profile is loaded: from then on screen changes push history entries,
// and back/forward move the screens
export function startRouting() {
  if (started) return;
  started = true;
  store.subscribe(() => {
    const path = pathForState(store.getState());
    // a new screen starts with a clean query string; the old screen's filters don't apply
    if (path && path !== location.pathname) navigate(path);
  });
  window.addEventListener('popstate', () => {
    applyUrl();
  });
}

// a query-string value that survives reloads and back/forward. typing replaces the
// history entry; pass { push: true } for a change worth a back step (opening a drawer)
export function useQueryParam(key: string): [string, (value: string, opts?: { push?: boolean }) => void] {
  const value = useSyncExternalStore(onUrlChange, () => new URLSearchParams(location.search).get(key) ?? '');
  const set = useCallback(
    (next: string, opts?: { push?: boolean }) => {
      const params = new URLSearchParams(location.search);
      if (next) params.set(key, next);
      else params.delete(key);
      const qs = params.toString();
      navigate(location.pathname + (qs ? `?${qs}` : ''), { replace: !opts?.push });
    },
    [key]
  );
  return [value, set];
}

export function usePathname(): string {
  return useSyncExternalStore(onUrlChange, () => location.pathname);
}
