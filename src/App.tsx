import { lazy, Suspense, useEffect, useState } from 'react';
import { useAuth, signInWithEmailPassword, signUpWithEmailPassword, signInWithGoogle } from './utils/auth';
import { apiFetch } from './utils/api';
import { store, useScreen, useUserData, profileFromApi } from './game/store';
import { applyUrl, startRouting, navigate, pathForState, usePathname } from './game/router';
import { Wordmark, PhysioLogo } from './components/primitives';
import { LandingScreen } from './components/LandingScreen';

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

const ScreenLoading = () => (
  <div className="screen dots-bg" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
    <h3 role="status" style={{ fontWeight: 800 }}>Loading…</h3>
  </div>
);
import './styles/global.css';
import { User, Stethoscope, Shield, ArrowLeft, AlertTriangle } from 'lucide-react';

export default function App() {
  const screen = useScreen();
  const userData = useUserData();
  const { isLoaded, isSignedIn, userId, signOut } = useAuth();
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState('');
  const [syncAttempt, setSyncAttempt] = useState(0);
  // the signed-out screens live at /, /sign-in and /sign-in/<role>
  const pathname = usePathname();
  const pathRole = pathname.split('/')[2];
  const authView: 'landing' | 'role_select' | 'login' =
    pathname === '/sign-in' ? 'role_select' : pathname.startsWith('/sign-in/') ? 'login' : 'landing';
  const setAuthView = (view: 'landing' | 'role_select' | 'login') => {
    const role = sessionStorage.getItem('physioalign:registration_intent') || 'patient';
    navigate(view === 'landing' ? '/' : view === 'role_select' ? '/sign-in' : `/sign-in/${role}`);
  };
  // a /sign-in/<role> link picks the account type, so it wins over what was clicked earlier
  if (['patient', 'doctor', 'admin'].includes(pathRole)) {
    sessionStorage.setItem('physioalign:registration_intent', pathRole);
  }

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
          }
        });
        
        const buttonDiv = document.getElementById("google-signin-button");
        if (buttonDiv) {
          (window as any).google.accounts.id.renderButton(
            buttonDiv,
            { theme: "outline", size: "large", width: 280 }
          );
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
      onboarding: 'Setup Profile | PhysioAlign',
      dashboard: 'Dashboard | PhysioAlign',
      library: 'Select Pose | PhysioAlign',
      session: 'Active Practice | PhysioAlign',
      debrief: 'Anatomical Report | PhysioAlign',
      doctor: 'Clinician PT Portal | PhysioAlign',
      admin: 'Admin Supervisor Terminal | PhysioAlign',
      pending: 'Awaiting Approval | PhysioAlign',
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
          // open whatever the address bar asks for, if this account may see it
          await applyUrl();
          const path = pathForState(store.getState());
          if (path && path !== location.pathname) navigate(path, { replace: true });
          startRouting();
        } else if (res.status === 404) {
          store.setUserData(null);
          store.setScreen('onboarding');
          navigate('/profile', { replace: true });
          startRouting();
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

  // an app address with nobody signed in falls back to the home page
  useEffect(() => {
    if (isLoaded && !isSignedIn && authView === 'landing' && pathname !== '/') {
      navigate('/', { replace: true });
    }
  }, [isLoaded, isSignedIn, authView, pathname]);

  if (!isLoaded) {
    return (
      <div className="screen dots-bg" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <h3 role="status" style={{ fontWeight: 800 }}>Loading…</h3>
      </div>
    );
  }

  if (!isSignedIn) {
    if (authView === 'landing') {
      return (
        <LandingScreen 
          onStartLogin={() => {
            setAuthView('role_select');
          }} 
          onEnterPractice={() => {
            setAuthView('role_select');
          }} 
        />
      );
    }

    if (authView === 'role_select') {
      return (
        <div className="screen dots-bg" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: 24, gap: 28, position: 'relative' }}>
          <div className="auth-topbar">
          <button
            onClick={() => setAuthView('landing')}
            className="tap btn-plush ghost"
            style={{
              fontSize: '14px',
              padding: '10px 18px',
              borderRadius: 'var(--r-pill)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              boxShadow: 'var(--plush-sm)'
            }}
          >
            <ArrowLeft size={16} style={{ strokeWidth: 3 }} aria-hidden="true" /> Back to home
          </button>
          </div>

          <div style={{ textAlign: 'center', maxWidth: 600 }} className="popin">
            <PhysioLogo size={80} />
            <div style={{ marginTop: 12 }}>
              <Wordmark size={36} />
            </div>
            <h1 style={{ fontSize: 26, fontWeight: 900, color: 'var(--ink)', marginTop: 20 }}>Who are you signing in as?</h1>
            <p style={{ fontSize: 14, fontWeight: 800, color: 'var(--ink-soft)', marginTop: 6 }}>
              Pick the account type you registered with. Patients practise, clinicians review, admins manage accounts.
            </p>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: 20,
            maxWidth: 900,
            width: '100%'
          }} className="popin">
            <button
              type="button"
              onClick={() => {
                sessionStorage.setItem('physioalign:registration_intent', 'patient');
                setAuthView('login');
              }}
              className="plush tap card-btn"
              style={{ padding: '28px 24px', background: 'var(--surface)', display: 'flex', flexDirection: 'column', gap: 18, cursor: 'pointer' }}
            >
              <div style={{ width: 48, height: 48, borderRadius: 12, background: 'var(--mint)', border: 'var(--bw) solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--on-accent)', boxShadow: 'var(--plush-tiny)' }}>
                <User size={24} style={{ strokeWidth: 3 }} aria-hidden="true" />
              </div>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 900, color: 'var(--ink)', margin: 0 }}>Patient Portal</h3>
                <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-soft)', lineHeight: 1.5, marginTop: 8, margin: 0 }}>
                  Track your daily pain levels, practice recovery poses with real-time guidance, and view AI coaching feedback.
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                sessionStorage.setItem('physioalign:registration_intent', 'doctor');
                setAuthView('login');
              }}
              className="plush tap card-btn"
              style={{ padding: '28px 24px', background: 'var(--surface)', display: 'flex', flexDirection: 'column', gap: 18, cursor: 'pointer' }}
            >
              <div style={{ width: 48, height: 48, borderRadius: 12, background: 'var(--butter)', border: 'var(--bw) solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--on-accent)', boxShadow: 'var(--plush-tiny)' }}>
                <Stethoscope size={24} style={{ strokeWidth: 3 }} aria-hidden="true" />
              </div>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 900, color: 'var(--ink)', margin: 0 }}>Clinician Suite</h3>
                <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-soft)', lineHeight: 1.5, marginTop: 8, margin: 0 }}>
                  Monitor patient workouts and progress, analyze recovery charts, and assign custom physical therapy plans.
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                sessionStorage.setItem('physioalign:registration_intent', 'admin');
                setAuthView('login');
              }}
              className="plush tap card-btn"
              style={{ padding: '28px 24px', background: 'var(--surface)', display: 'flex', flexDirection: 'column', gap: 18, cursor: 'pointer' }}
            >
              <div style={{ width: 48, height: 48, borderRadius: 12, background: 'var(--peach)', border: 'var(--bw) solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--on-accent)', boxShadow: 'var(--plush-tiny)' }}>
                <Shield size={24} style={{ strokeWidth: 3 }} aria-hidden="true" />
              </div>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 900, color: 'var(--ink)', margin: 0 }}>Admin Terminal</h3>
                <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-soft)', lineHeight: 1.5, marginTop: 8, margin: 0 }}>
                  Manage system database records, configure user accounts and roles, and monitor workspace settings.
                </p>
              </div>
            </button>
          </div>
        </div>
      );
    }

    const registrationIntent = sessionStorage.getItem('physioalign:registration_intent') || 'patient';
    const portalTitle = registrationIntent === 'admin' 
      ? 'Admin sign-in' 
      : registrationIntent === 'doctor' 
        ? 'Clinician sign-in' 
        : 'Patient sign-in';
    const portalBadgeColor = registrationIntent === 'admin'
      ? 'var(--peach)'
      : registrationIntent === 'doctor'
        ? 'var(--butter)'
        : 'var(--mint)';

    return (
      <div className="screen dots-bg" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: 24, flexDirection: 'column', gap: 16, position: 'relative' }}>
        <div className="auth-topbar">
        <button
          onClick={() => {
            setAuthView('role_select');
          }}
          className="tap btn-plush ghost"
          style={{
            fontSize: '14px',
            padding: '10px 18px',
            borderRadius: 'var(--r-pill)'
          }}
        >
          <ArrowLeft size={16} style={{ strokeWidth: 3 }} aria-hidden="true" /> Back to account types
        </button>
        </div>
        
        <div className="popin" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, maxWidth: 440, width: '100%' }}>
          
          <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <PhysioLogo size={80} />
            <div style={{ marginTop: 12 }}>
              <Wordmark size={36} />
            </div>
            
            <div style={{
              background: portalBadgeColor,
              border: 'var(--bw) solid var(--line)',
              borderRadius: 'var(--r-sm)',
              padding: '6px 16px',
              fontFamily: 'inherit',
              fontSize: 13,
              fontWeight: 900,
              color: 'var(--on-accent)',
              marginTop: 16,
              boxShadow: 'var(--plush-tiny)'
            }}>
              {portalTitle}
            </div>

            <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink-2)', marginTop: 12, maxWidth: 320 }}>
              Sign in with your email and password, or with Google.
            </p>
          </div>          {/* Custom Authentication Card (Email/Password & Google Sign-In) */}
          <div style={{
            width: '100%',
            maxWidth: '400px',
            background: 'var(--surface)',
            border: 'var(--bw) solid var(--line)',
            borderRadius: 'var(--r-md)',
            boxShadow: 'var(--plush-sm)',
            overflow: 'hidden',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 16
          }}>
            {/* Toggle Tabs */}
            <div style={{ display: 'flex', width: '100%', border: 'var(--bw) solid var(--line)', borderRadius: '12px', overflow: 'hidden' }}>
              <button
                type="button"
                onClick={() => { setFormMode('signin'); setFormError(''); }}
                aria-pressed={formMode === 'signin'}
                style={{
                  flex: 1,
                  padding: '10px',
                  fontWeight: 900,
                  fontSize: 13,
                  cursor: 'pointer',
                  border: 'none',
                  background: formMode === 'signin' ? 'var(--butter)' : 'var(--surface)',
                  borderRight: 'var(--bw) solid var(--line)',
                  color: formMode === 'signin' ? 'var(--on-accent)' : 'var(--ink)',
                  fontFamily: 'inherit'
                }}
              >
                Sign in
              </button>
              <button
                type="button"
                onClick={() => { setFormMode('signup'); setFormError(''); }}
                aria-pressed={formMode === 'signup'}
                style={{
                  flex: 1,
                  padding: '10px',
                  fontWeight: 900,
                  fontSize: 13,
                  cursor: 'pointer',
                  border: 'none',
                  background: formMode === 'signup' ? 'var(--butter)' : 'var(--surface)',
                  color: formMode === 'signup' ? 'var(--on-accent)' : 'var(--ink)',
                  fontFamily: 'inherit'
                }}
              >
                Create account
              </button>
            </div>

            <h2 style={{ fontSize: 16, fontWeight: 900, color: 'var(--ink)', margin: '8px 0 0 0' }}>
              {formMode === 'signin' ? 'Sign in with email' : 'Create an account'}
            </h2>

            {formError && (
              <div role="alert" id="auth-error" style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 8,
                width: '100%',
                background: 'var(--peach)',
                border: 'var(--bw) solid var(--line)',
                borderRadius: '8px',
                padding: '8px 12px',
                fontSize: 13,
                fontWeight: 800,
                color: 'var(--on-accent)',
                textAlign: 'left'
              }}>
                <AlertTriangle size={16} aria-hidden="true" style={{ flexShrink: 0, marginTop: 1 }} />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleEmailAuth} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {formMode === 'signup' && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4, width: '100%' }}>
                  <label htmlFor="auth-name" className="field-label">Full name</label>
                  <input
                    id="auth-name"
                    name="name"
                    type="text"
                    autoComplete="name"
                    placeholder="Asha Rao"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="field"
                  />
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4, width: '100%' }}>
                <label htmlFor="auth-email" className="field-label">Email</label>
                <input
                  id="auth-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  spellCheck={false}
                  aria-describedby={formError ? 'auth-error' : undefined}
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="field"
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4, width: '100%' }}>
                <label htmlFor="auth-password" className="field-label">Password</label>
                <input
                  id="auth-password"
                  name="password"
                  type="password"
                  autoComplete={formMode === 'signup' ? 'new-password' : 'current-password'}
                  minLength={formMode === 'signup' ? 6 : undefined}
                  aria-describedby={formMode === 'signup' ? 'auth-password-hint' : undefined}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="field"
                />
                {formMode === 'signup' && (
                  <span id="auth-password-hint" style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-soft)' }}>
                    At least 6 characters.
                  </span>
                )}
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="tap"
                aria-busy={isSubmitting}
                style={{
                  width: '100%',
                  background: 'var(--mint)',
                  border: 'var(--bw) solid var(--line)',
                  borderRadius: '10px',
                  padding: '12px',
                  fontWeight: 900,
                  fontSize: 14,
                  cursor: 'pointer',
                  boxShadow: 'var(--sh-down-3)',
                  color: 'var(--on-accent)',
                  marginTop: 8,
                  fontFamily: 'inherit'
                }}
              >
                {isSubmitting ? (formMode === 'signin' ? 'Signing in…' : 'Creating account…') : formMode === 'signin' ? 'Sign in' : 'Create account'}
              </button>
            </form>

            <div style={{ display: 'flex', alignItems: 'center', width: '100%', margin: '8px 0' }}>
              <hr style={{ flex: 1, border: 'none', borderTop: 'var(--bw) solid var(--line)', margin: 0 }} />
              <span style={{ padding: '0 10px', fontSize: 13, fontWeight: 800, color: 'var(--ink-soft)' }}>or</span>
              <hr style={{ flex: 1, border: 'none', borderTop: 'var(--bw) solid var(--line)', margin: 0 }} />
            </div>

            {/* Google Sign-in Option */}
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <div 
                style={{ 
                  display: 'flex', 
                  justifyContent: 'center', 
                  width: '100%',
                  border: 'var(--bw) solid var(--line)',
                  borderRadius: '12px',
                  padding: '10px',
                  background: 'var(--surface)',
                  boxShadow: 'var(--sh-down-3)'
                }}
              >
                <div id="google-signin-button"></div>
              </div>
            </div>
          </div>

        </div>
      </div>
    );
  }

  if (syncError && !isSyncing) {
    return (
      <div className="screen dots-bg" style={{ display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: 24, textAlign: 'center' }}>
        <h3 role="alert" style={{ fontWeight: 800 }}>{syncError}</h3>
        <div style={{ display: 'flex', gap: 12 }}>
          <button className="btn-plush primary" style={{ padding: '10px 24px' }} onClick={() => setSyncAttempt((n) => n + 1)}>
            Try again
          </button>
          <button className="btn-plush ghost" style={{ padding: '10px 24px' }} onClick={signOut}>
            Sign out
          </button>
        </div>
      </div>
    );
  }

  if (isSyncing) {
    return (
      <div className="screen dots-bg" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <h3 role="status" style={{ fontWeight: 800 }}>Loading your profile…</h3>
      </div>
    );
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
