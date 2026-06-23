import { useEffect, useState } from 'react';
import { useAuth, setSavedUser, decodeJwt, signInWithEmailPassword, signUpWithEmailPassword } from './utils/auth';
import { store, useScreen } from './game/store';
import { SplashScreen } from './components/SplashScreen';
import { OnboardingScreen } from './components/OnboardingScreen';
import { HomeScreen } from './components/HomeScreen';
import { PoseLibraryScreen } from './components/PoseLibraryScreen';
import { SessionScreen } from './components/SessionScreen';
import { DebriefScreen } from './components/DebriefScreen';
import { Wordmark, PhysioLogo } from './components/primitives';
import { LandingScreen } from './components/LandingScreen';
import { DoctorPortal } from './components/DoctorPortal';
import { AdminPortal } from './components/AdminPortal';
import './styles/global.css';
import { User, Stethoscope, Shield, ArrowLeft } from 'lucide-react';

export default function App() {
  const screen = useScreen();
  const { isLoaded, isSignedIn, userId, signOut } = useAuth();
  const [isSyncing, setIsSyncing] = useState(false);
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
          callback: (response: any) => {
            const payload = decodeJwt(response.credential);
            if (payload) {
              setSavedUser({
                id: payload.sub,
                name: payload.name,
                email: payload.email,
                picture: payload.picture
              });
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

  // Sync auth status with database
  useEffect(() => {
    if (!isLoaded || !isSignedIn || !userId) return;

    // If user data is already populated, we've successfully synced. Do not trigger it again on navigation or re-render.
    if (store.getState().userData) return;

    const syncUser = async () => {
      setIsSyncing(true);
      try {
        const res = await fetch(`/api/users/${userId}`);
        if (res.ok) {
          const profile = await res.json();
          store.getState().userData = {
            name: profile.name,
            age: profile.age,
            experience: profile.experience,
            goal: profile.goal,
            role: profile.role,
            doctor_id: profile.doctor_id,
            care_plan: profile.care_plan
          };
          const nextScreen = profile.role === 'doctor' ? 'doctor' : profile.role === 'admin' ? 'admin' : 'dashboard';
          store.setScreen(nextScreen);
        } else if (res.status === 404) {
          store.getState().userData = null;
          store.setScreen('onboarding');
        }
      } catch (err) {
        console.error('[PhysioAlign] Failed to sync user profile with backend, routing to onboarding:', err);
      } finally {
        setIsSyncing(false);
      }
    };

    syncUser();
  }, [isLoaded, isSignedIn, userId]);

  if (!isLoaded) {
    return (
      <div className="screen dots-bg" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <h3 style={{ fontFamily: 'Nunito', fontWeight: 800 }}>Loading PhysioAlign Authenticator...</h3>
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
        <div className="screen dots-bg" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: 24, gap: 28 }}>
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
              boxShadow: '0 3.5px 0 var(--line)'
            }}
          >
            <ArrowLeft size={16} style={{ strokeWidth: 3 }} /> Back to Home
          </button>

          <div style={{ textAlign: 'center', maxWidth: 600 }} className="popin">
            <PhysioLogo size={80} />
            <div style={{ marginTop: 12 }}>
              <Wordmark size={36} />
            </div>
            <h2 style={{ fontSize: 26, fontWeight: 900, color: 'var(--ink)', marginTop: 20 }}>Select Your Access Portal</h2>
            <p style={{ fontSize: 14, fontWeight: 800, color: 'var(--ink-soft)', marginTop: 6 }}>
              Choose the portal workspace matching your user role registration.
            </p>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: 20,
            maxWidth: 900,
            width: '100%'
          }} className="popin">
            <div 
              onClick={() => {
                sessionStorage.setItem('physioalign:registration_intent', 'patient');
                setAuthView('login');
              }}
              className="plush tap" 
              style={{ padding: '28px 24px', background: 'white', display: 'flex', flexDirection: 'column', gap: 18, cursor: 'pointer' }}
            >
              <div style={{ width: 48, height: 48, borderRadius: 12, background: 'var(--mint)', border: '2.5px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink)', boxShadow: '0 2.5px 0 var(--line)' }}>
                <User size={24} style={{ strokeWidth: 3 }} />
              </div>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 900, color: 'var(--ink)', margin: 0 }}>Patient Portal</h3>
                <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-soft)', lineHeight: 1.5, marginTop: 8, margin: 0 }}>
                  Track your daily pain levels, practice recovery poses with real-time guidance, and view AI coaching feedback.
                </p>
              </div>
            </div>

            <div 
              onClick={() => {
                sessionStorage.setItem('physioalign:registration_intent', 'doctor');
                setAuthView('login');
              }}
              className="plush tap" 
              style={{ padding: '28px 24px', background: 'white', display: 'flex', flexDirection: 'column', gap: 18, cursor: 'pointer' }}
            >
              <div style={{ width: 48, height: 48, borderRadius: 12, background: 'var(--butter)', border: '2.5px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink)', boxShadow: '0 2.5px 0 var(--line)' }}>
                <Stethoscope size={24} style={{ strokeWidth: 3 }} />
              </div>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 900, color: 'var(--ink)', margin: 0 }}>Clinician Suite</h3>
                <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-soft)', lineHeight: 1.5, marginTop: 8, margin: 0 }}>
                  Monitor patient workouts and progress, analyze recovery charts, and assign custom physical therapy plans.
                </p>
              </div>
            </div>

            <div 
              onClick={() => {
                sessionStorage.setItem('physioalign:registration_intent', 'admin');
                setAuthView('login');
              }}
              className="plush tap" 
              style={{ padding: '28px 24px', background: 'white', display: 'flex', flexDirection: 'column', gap: 18, cursor: 'pointer' }}
            >
              <div style={{ width: 48, height: 48, borderRadius: 12, background: 'var(--peach)', border: '2.5px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink)', boxShadow: '0 2.5px 0 var(--line)' }}>
                <Shield size={24} style={{ strokeWidth: 3 }} />
              </div>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 900, color: 'var(--ink)', margin: 0 }}>Admin Terminal</h3>
                <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-soft)', lineHeight: 1.5, marginTop: 8, margin: 0 }}>
                  Manage system database records, configure user accounts and roles, and monitor workspace settings.
                </p>
              </div>
            </div>
          </div>
        </div>
      );
    }

    const registrationIntent = sessionStorage.getItem('physioalign:registration_intent') || 'patient';
    const portalTitle = registrationIntent === 'admin' 
      ? 'Admin Supervisor Terminal' 
      : registrationIntent === 'doctor' 
        ? 'Clinician PT Portal' 
        : 'Patient Access Portal';
    const portalBadgeColor = registrationIntent === 'admin'
      ? 'var(--peach)'
      : registrationIntent === 'doctor'
        ? 'var(--butter)'
        : 'var(--mint)';

    return (
      <div className="screen dots-bg" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: 24, flexDirection: 'column', gap: 16 }}>
        <button
          onClick={() => {
            setAuthView('role_select');
          }}
          className="tap btn-plush ghost"
          style={{
            fontSize: '14px',
            padding: '10px 18px',
            borderRadius: 'var(--r-pill)',
            marginBottom: 8
          }}
        >
          ← Back to Selection
        </button>
        
        <div className="popin" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, maxWidth: 440, width: '100%' }}>
          
          <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <PhysioLogo size={80} />
            <div style={{ marginTop: 12 }}>
              <Wordmark size={36} />
            </div>
            
            <div style={{
              background: portalBadgeColor,
              border: '2.5px solid var(--line)',
              borderRadius: 'var(--r-sm)',
              padding: '6px 16px',
              fontFamily: 'inherit',
              fontSize: 13,
              fontWeight: 900,
              color: 'var(--ink)',
              marginTop: 16,
              boxShadow: '0 2.5px 0 var(--line)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}>
              {portalTitle}
            </div>

            <p style={{ fontSize: 13, fontWeight: 800, color: 'var(--ink-soft)', marginTop: 12, maxWidth: 300 }}>
              Sign in with your Google account to access your workspace environment.
            </p>
          </div>          {/* Custom Authentication Card (Email/Password & Google Sign-In) */}
          <div style={{
            width: '100%',
            maxWidth: '400px',
            background: 'white',
            border: '3.5px solid var(--line)',
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
            <div style={{ display: 'flex', width: '100%', border: '2.5px solid var(--line)', borderRadius: '12px', overflow: 'hidden' }}>
              <button
                type="button"
                onClick={() => { setFormMode('signin'); setFormError(''); }}
                style={{
                  flex: 1,
                  padding: '10px',
                  fontWeight: 900,
                  fontSize: 13,
                  cursor: 'pointer',
                  border: 'none',
                  background: formMode === 'signin' ? 'var(--butter)' : 'white',
                  borderRight: '2.5px solid var(--line)',
                  color: 'var(--ink)',
                  fontFamily: 'Nunito'
                }}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => { setFormMode('signup'); setFormError(''); }}
                style={{
                  flex: 1,
                  padding: '10px',
                  fontWeight: 900,
                  fontSize: 13,
                  cursor: 'pointer',
                  border: 'none',
                  background: formMode === 'signup' ? 'var(--butter)' : 'white',
                  color: 'var(--ink)',
                  fontFamily: 'Nunito'
                }}
              >
                Sign Up
              </button>
            </div>

            <h3 style={{ fontSize: 16, fontWeight: 900, color: 'var(--ink)', margin: '8px 0 0 0' }}>
              {formMode === 'signin' ? 'Sign in with Email' : 'Create an Account'}
            </h3>

            {formError && (
              <div style={{
                width: '100%',
                background: 'var(--peach)',
                border: '2px solid var(--line)',
                borderRadius: '8px',
                padding: '8px 12px',
                fontSize: 12,
                fontWeight: 800,
                color: 'var(--ink)',
                textAlign: 'left'
              }}>
                ⚠️ {formError}
              </div>
            )}

            <form onSubmit={handleEmailAuth} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {formMode === 'signup' && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4, width: '100%' }}>
                  <label style={{ fontSize: 11, fontWeight: 900, color: 'var(--ink-soft)', textTransform: 'uppercase' }}>Full Name</label>
                  <input
                    type="text"
                    placeholder="Enter your name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    style={{
                      width: '100%',
                      border: '2.5px solid var(--line)',
                      borderRadius: '8px',
                      padding: '10px 12px',
                      fontSize: 13,
                      fontWeight: 700,
                      fontFamily: 'Nunito',
                      color: 'var(--ink)',
                      boxShadow: '0 2px 0 var(--line)'
                    }}
                  />
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4, width: '100%' }}>
                <label style={{ fontSize: 11, fontWeight: 900, color: 'var(--ink-soft)', textTransform: 'uppercase' }}>Email Address</label>
                <input
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    border: '2.5px solid var(--line)',
                    borderRadius: '8px',
                    padding: '10px 12px',
                    fontSize: 13,
                    fontWeight: 700,
                    fontFamily: 'Nunito',
                    color: 'var(--ink)',
                    boxShadow: '0 2px 0 var(--line)'
                  }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4, width: '100%' }}>
                <label style={{ fontSize: 11, fontWeight: 900, color: 'var(--ink-soft)', textTransform: 'uppercase' }}>Password</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    border: '2.5px solid var(--line)',
                    borderRadius: '8px',
                    padding: '10px 12px',
                    fontSize: 13,
                    fontWeight: 700,
                    fontFamily: 'Nunito',
                    color: 'var(--ink)',
                    boxShadow: '0 2px 0 var(--line)'
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="tap"
                style={{
                  width: '100%',
                  background: 'var(--mint)',
                  border: '2.5px solid var(--line)',
                  borderRadius: '10px',
                  padding: '12px',
                  fontWeight: 900,
                  fontSize: 14,
                  cursor: 'pointer',
                  boxShadow: '0 3px 0 var(--line)',
                  color: 'var(--ink)',
                  marginTop: 8,
                  fontFamily: 'Nunito'
                }}
              >
                {isSubmitting ? 'Processing...' : formMode === 'signin' ? 'Sign In' : 'Sign Up'}
              </button>
            </form>

            <div style={{ display: 'flex', alignItems: 'center', width: '100%', margin: '8px 0' }}>
              <hr style={{ flex: 1, border: 'none', borderTop: '2px solid var(--line)', margin: 0 }} />
              <span style={{ padding: '0 10px', fontSize: 11, fontWeight: 800, color: 'var(--ink-soft)', textTransform: 'uppercase' }}>or</span>
              <hr style={{ flex: 1, border: 'none', borderTop: '2px solid var(--line)', margin: 0 }} />
            </div>

            {/* Google Sign-in Option */}
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <p style={{ fontSize: 11, fontWeight: 800, color: 'var(--ink-soft)', margin: 0, textTransform: 'uppercase' }}>
                Continue with Google
              </p>
              <div 
                style={{ 
                  display: 'flex', 
                  justifyContent: 'center', 
                  width: '100%',
                  border: '2.5px solid var(--line)',
                  borderRadius: '12px',
                  padding: '10px',
                  background: 'white',
                  boxShadow: '0 3px 0 var(--line)'
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

  if (isSyncing) {
    return (
      <div className="screen dots-bg" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <h3 style={{ fontFamily: 'Nunito', fontWeight: 800 }}>Syncing profile logs...</h3>
      </div>
    );
  }

  return (
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
    </div>
  );
}
