import { lazy, Suspense, useEffect, useState } from 'react';
import { useAuth, signInWithEmailPassword, signUpWithEmailPassword, signInWithGoogle } from './utils/auth';
import { apiFetch } from './utils/api';
import { store, useScreen, useUserData, profileFromApi, screenForProfile } from './game/store';
import { PhysioLogo } from './components/primitives';
import { LandingScreen } from './components/LandingScreen';
import './styles/global.css';
import { AlertCircle, ArrowLeft, Check, Shield, Stethoscope, User } from 'lucide-react';

// everything behind the login is split into its own chunk, so the landing page
// doesn't download recharts, the portals or the session screen up front
const screens = {
  splash: () => import('./components/SplashScreen').then((m) => ({ default: m.SplashScreen })),
  onboarding: () => import('./components/OnboardingScreen').then((m) => ({ default: m.OnboardingScreen })),
  dashboard: () => import('./components/HomeScreen').then((m) => ({ default: m.HomeScreen })),
  library: () => import('./components/PoseLibraryScreen').then((m) => ({ default: m.PoseLibraryScreen })),
  session: () => import('./components/SessionScreen').then((m) => ({ default: m.SessionScreen })),
  debrief: () => import('./components/DebriefScreen').then((m) => ({ default: m.DebriefScreen })),
  doctor: () => import('./components/DoctorPortal').then((m) => ({ default: m.DoctorPortal })),
  admin: () => import('./components/AdminPortal').then((m) => ({ default: m.AdminPortal })),
  pending: () => import('./components/PendingApprovalScreen').then((m) => ({ default: m.PendingApprovalScreen })),
};
const SplashScreen = lazy(screens.splash);
const OnboardingScreen = lazy(screens.onboarding);
const HomeScreen = lazy(screens.dashboard);
const PoseLibraryScreen = lazy(screens.library);
const SessionScreen = lazy(screens.session);
const DebriefScreen = lazy(screens.debrief);
const DoctorPortal = lazy(screens.doctor);
const AdminPortal = lazy(screens.admin);
const PendingApprovalScreen = lazy(screens.pending);

const ScreenLoading = ({ label = 'Loading' }: { label?: string }) => (
  <div className="screen screen--centered">
    <div className="row row--sm muted">
      <span className="spinner" />
      {label}
    </div>
  </div>
);

const PORTALS = [
  {
    id: 'patient',
    label: 'Patient',
    icon: User,
    description: 'Practise poses with live feedback, log how you feel and follow your plan.',
  },
  {
    id: 'doctor',
    label: 'Clinician',
    icon: Stethoscope,
    description: 'Review your patients’ sessions, track progress and prescribe care plans.',
  },
  {
    id: 'admin',
    label: 'Administrator',
    icon: Shield,
    description: 'Manage accounts, approve clinicians and assign patients.',
  },
];

export default function App() {
  const screen = useScreen();
  const userData = useUserData();
  const { isLoaded, isSignedIn, userId, signOut } = useAuth();
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState('');
  const [syncAttempt, setSyncAttempt] = useState(0);
  const [authView, setAuthView] = useState<'landing' | 'role_select' | 'login'>('landing');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [formMode, setFormMode] = useState<'signin' | 'signup'>('signin');
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setIsSubmitting(true);

    try {
      const registrationIntent = sessionStorage.getItem('physioalign:registration_intent') || 'patient';
      if (formMode === 'signup') {
        if (!name.trim()) throw new Error('Name is required');
        if (!email.trim()) throw new Error('Email is required');
        if (password.length < 6) throw new Error('Password must be at least 6 characters');
        await signUpWithEmailPassword(name, email, password, registrationIntent);
      } else {
        if (!email.trim()) throw new Error('Email is required');
        if (!password) throw new Error('Password is required');
        await signInWithEmailPassword(email, password);
      }
    } catch (err: any) {
      setFormError(err.message || 'An error occurred during authentication');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Load and initialize Google Sign-in button when login screen is rendered
  useEffect(() => {
    if (authView !== 'login') return;

    const initGoogle = () => {
      if ((window as any).google) {
        const client_id = (import.meta as any).env.VITE_GOOGLE_CLIENT_ID || '303655418647-jmkugqbao9oc38na1qigl309qsa7gg96.apps.googleusercontent.com';
        (window as any).google.accounts.id.initialize({
          client_id,
          callback: async (response: any) => {
            setFormError('');
            try {
              await signInWithGoogle(response.credential);
            } catch (err: any) {
              setFormError(err.message || 'Google sign-in failed');
            }
          },
        });

        const buttonDiv = document.getElementById('google-signin-button');
        if (buttonDiv) {
          (window as any).google.accounts.id.renderButton(buttonDiv, {
            theme: 'outline',
            size: 'large',
            width: 320,
            text: 'continue_with',
          });
        }
      } else {
        setTimeout(initGoogle, 100);
      }
    };

    initGoogle();
  }, [authView]);

  useEffect(() => {
    const titles: Record<string, string> = {
      splash: 'PhysioAlign',
      onboarding: 'Your profile · PhysioAlign',
      dashboard: 'Dashboard · PhysioAlign',
      library: 'Pose library · PhysioAlign',
      session: 'Live session · PhysioAlign',
      debrief: 'Session report · PhysioAlign',
      doctor: 'Clinician portal · PhysioAlign',
      admin: 'Admin · PhysioAlign',
      pending: 'Pending approval · PhysioAlign',
    };
    document.title = titles[screen] || 'PhysioAlign';
  }, [screen]);

  useEffect(() => {
    if (!isLoaded) return;

    const hasActiveSession = sessionStorage.getItem('physioalign:session_active');

    if (!hasActiveSession) {
      if (isSignedIn) {
        signOut();
      }
      sessionStorage.setItem('physioalign:session_active', 'true');
    }
  }, [isLoaded, isSignedIn]);

  // warm up the main chunks in the background once someone is signed in
  useEffect(() => {
    if (!isSignedIn) return;
    const prefetch = () => [screens.dashboard, screens.library, screens.session, screens.debrief].forEach((load) => load());
    const idle = (window as any).requestIdleCallback as ((cb: () => void) => number) | undefined;
    if (idle) idle(prefetch);
    else setTimeout(prefetch, 1500);
  }, [isSignedIn]);

  // Sync auth status with database
  useEffect(() => {
    if (!isLoaded || !isSignedIn || !userId) return;

    // If user data is already populated, we've successfully synced. Do not trigger it again on navigation or re-render.
    if (store.getState().userData) return;

    const syncUser = async () => {
      setIsSyncing(true);
      setSyncError('');
      try {
        const res = await apiFetch('/api/users/me');
        if (res.ok) {
          const profile = profileFromApi(await res.json());
          store.setUserData(profile);
          store.setScreen(screenForProfile(profile));
        } else if (res.status === 404) {
          store.setUserData(null);
          store.setScreen('onboarding');
        } else {
          const data = await res.json().catch(() => ({}));
          setSyncError(data.error || 'Could not load your profile.');
        }
      } catch (err) {
        console.error('[PhysioAlign] Failed to sync user profile with backend:', err);
        setSyncError('Could not reach the server.');
      } finally {
        setIsSyncing(false);
      }
    };

    syncUser();
  }, [isLoaded, isSignedIn, userId, syncAttempt]);

  if (!isLoaded) {
    return <ScreenLoading />;
  }

  if (!isSignedIn) {
    if (authView === 'landing') {
      return <LandingScreen onStartLogin={() => setAuthView('role_select')} onEnterPractice={() => setAuthView('role_select')} />;
    }

    if (authView === 'role_select') {
      return (
        <div className="screen screen--centered">
          <div className="stack stack--lg fade-in" style={{ width: '100%', maxWidth: 940 }}>
            <button className="btn btn--ghost btn--sm" style={{ alignSelf: 'flex-start' }} onClick={() => setAuthView('landing')}>
              <ArrowLeft size={15} />
              Back
            </button>

            <div className="stack stack--sm" style={{ textAlign: 'center', alignItems: 'center' }}>
              <PhysioLogo size={40} />
              <h1 style={{ marginTop: 8 }}>Choose how you'll use PhysioAlign</h1>
              <p className="page-subtitle" style={{ maxWidth: 520 }}>
                Your workspace and permissions depend on the account type. Clinician accounts are reviewed by an administrator
                before they can see patient data.
              </p>
            </div>

            <div className="grid grid--3">
              {PORTALS.map((portal) => (
                <button
                  key={portal.id}
                  className="card card--raised"
                  onClick={() => {
                    sessionStorage.setItem('physioalign:registration_intent', portal.id);
                    setAuthView('login');
                  }}
                  style={{ cursor: 'pointer', textAlign: 'left', padding: 0 }}
                >
                  <div className="card__body stack stack--sm">
                    <span className="icon-tile">
                      <portal.icon size={18} />
                    </span>
                    <div>
                      <h3>{portal.label}</h3>
                      <p className="text-sm muted" style={{ marginTop: 4 }}>
                        {portal.description}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      );
    }

    const registrationIntent = sessionStorage.getItem('physioalign:registration_intent') || 'patient';
    const portal = PORTALS.find((p) => p.id === registrationIntent) ?? PORTALS[0];

    return (
      <div className="auth">
        <aside className="auth__aside">
          <div className="stack stack--lg">
            <div className="row row--sm">
              <PhysioLogo size={32} />
              <span className="brand__name" style={{ fontSize: 17, color: '#fff' }}>
                PhysioAlign
              </span>
            </div>
            <div className="stack stack--sm">
              <h2 style={{ color: '#fff', fontSize: 26, letterSpacing: '-0.02em' }}>
                Posture analysis that runs in the browser.
              </h2>
              <p style={{ color: 'rgba(255,255,255,0.76)', fontSize: 14.5 }}>
                Live joint-angle feedback, hold timing and session reports — with the camera feed never leaving your device.
              </p>
            </div>
            <ul className="auth__points">
              {[
                '33 body landmarks tracked locally per frame',
                'Clinician review with prescribed care plans',
                'AI session reports and progress trends',
              ].map((point) => (
                <li key={point}>
                  <Check size={15} />
                  {point}
                </li>
              ))}
            </ul>
          </div>
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.55)' }}>
            A personal project, not a medical device.
          </p>
        </aside>

        <main className="auth__main">
          <div className="auth__form stack">
            <button className="btn btn--ghost btn--sm" style={{ alignSelf: 'flex-start' }} onClick={() => setAuthView('role_select')}>
              <ArrowLeft size={15} />
              Change account type
            </button>

            <div className="stack stack--sm">
              <span className="badge badge--brand">
                <portal.icon size={13} />
                {portal.label} access
              </span>
              <h1 style={{ fontSize: 24 }}>{formMode === 'signin' ? 'Sign in' : 'Create your account'}</h1>
              <p className="page-subtitle">
                {formMode === 'signin' ? (
                  <>
                    New here?{' '}
                    <button className="link-button" onClick={() => { setFormMode('signup'); setFormError(''); }}>
                      Create an account
                    </button>
                  </>
                ) : (
                  <>
                    Already registered?{' '}
                    <button className="link-button" onClick={() => { setFormMode('signin'); setFormError(''); }}>
                      Sign in instead
                    </button>
                  </>
                )}
              </p>
            </div>

            {formError && (
              <div className="alert alert--danger" role="alert">
                <AlertCircle size={16} className="alert__icon" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleEmailAuth} className="stack">
              {formMode === 'signup' && (
                <div className="field">
                  <label className="label" htmlFor="auth-name">
                    Full name
                  </label>
                  <input
                    id="auth-name"
                    className="input"
                    type="text"
                    placeholder="Jane Doe"
                    autoComplete="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>
              )}

              <div className="field">
                <label className="label" htmlFor="auth-email">
                  Email
                </label>
                <input
                  id="auth-email"
                  className="input"
                  type="email"
                  placeholder="you@example.com"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="field">
                <label className="label" htmlFor="auth-password">
                  Password
                </label>
                <input
                  id="auth-password"
                  className="input"
                  type="password"
                  placeholder={formMode === 'signup' ? 'At least 6 characters' : '••••••••'}
                  autoComplete={formMode === 'signup' ? 'new-password' : 'current-password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              <button type="submit" className="btn btn--primary btn--block btn--lg" disabled={isSubmitting}>
                {isSubmitting && <span className="spinner" style={{ borderTopColor: '#fff', borderColor: 'rgba(255,255,255,0.4)' }} />}
                {isSubmitting ? 'Please wait' : formMode === 'signin' ? 'Sign in' : 'Create account'}
              </button>
            </form>

            <div className="auth__divider">
              <span>or</span>
            </div>

            <div id="google-signin-button" style={{ display: 'flex', justifyContent: 'center', minHeight: 44 }} />
          </div>
        </main>
      </div>
    );
  }

  if (syncError && !isSyncing) {
    return (
      <div className="screen screen--centered">
        <div className="card card--raised" style={{ maxWidth: 420, width: '100%' }}>
          <div className="card__body stack">
            <span className="icon-tile" style={{ background: 'var(--danger-50)', color: 'var(--danger-600)' }}>
              <AlertCircle size={18} />
            </span>
            <div>
              <h2 style={{ fontSize: 17 }}>{syncError}</h2>
              <p className="text-sm muted" style={{ marginTop: 4 }}>
                Your session is fine — the server just didn't answer. Try again in a moment.
              </p>
            </div>
            <div className="row row--sm">
              <button className="btn btn--primary" onClick={() => setSyncAttempt((n) => n + 1)}>
                Try again
              </button>
              <button className="btn btn--secondary" onClick={signOut}>
                Sign out
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isSyncing) {
    return <ScreenLoading label="Loading your profile" />;
  }

  // the logo and nav buttons can switch screens before the profile has loaded,
  // and nothing on those screens can be saved without one
  const needsProfile = !userData && !['splash', 'landing', 'onboarding'].includes(screen);
  if (needsProfile) {
    return (
      <Suspense fallback={<ScreenLoading />}>
        <OnboardingScreen />
      </Suspense>
    );
  }

  return (
    <Suspense fallback={<ScreenLoading />}>
      <div className="app">
        {screen === 'landing' && <LandingScreen onStartLogin={() => store.setScreen('dashboard')} />}
        {screen === 'splash' && <SplashScreen />}
        {screen === 'onboarding' && <OnboardingScreen />}
        {screen === 'dashboard' && <HomeScreen />}
        {screen === 'library' && <PoseLibraryScreen />}
        {screen === 'session' && <SessionScreen />}
        {screen === 'debrief' && <DebriefScreen />}
        {screen === 'doctor' && <DoctorPortal />}
        {screen === 'admin' && <AdminPortal />}
        {screen === 'pending' && <PendingApprovalScreen />}
      </div>
    </Suspense>
  );
}
