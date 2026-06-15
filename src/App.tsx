import { useEffect, useState } from 'react';
import { useAuth, useUser, SignIn } from '@clerk/clerk-react';
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
  const { user } = useUser();
  const [isSyncing, setIsSyncing] = useState(false);
  const [authView, setAuthView] = useState<'landing' | 'role_select' | 'login'>('landing');

  // Force login on fresh tab/browser sessions
  useEffect(() => {
    if (!isLoaded) return;
    
    const hasActiveSession = sessionStorage.getItem('physioalign:session_active');
    
    if (!hasActiveSession) {
      // New browser session/tab. If already signed in, force logout to require fresh login.
      if (isSignedIn) {
        signOut();
      }
      sessionStorage.setItem('physioalign:session_active', 'true');
    }
  }, [isLoaded, isSignedIn]);

  // Sync user authentication status with backend database
  useEffect(() => {
    if (!isLoaded || !isSignedIn || !userId || !user) return;

    const syncUser = async () => {
      setIsSyncing(true);
      try {
        const res = await fetch(`/api/users/${userId}`);
        if (res.ok) {
          const profile = await res.json();
          // User exists, save to store and route to correct portal
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
          // New user, send to onboarding
          store.getState().userData = null;
          store.setScreen('onboarding');
        }
      } catch (err) {
        console.error('[PhysioAlign] Failed to sync user profile with backend, routing to onboarding:', err);
        // Fallback: assume onboarding is needed
        store.getState().userData = null;
        store.setScreen('onboarding');
      } finally {
        setIsSyncing(false);
      }
    };

    syncUser();
  }, [isLoaded, isSignedIn, userId, user]);

  if (!isLoaded) {
    return (
      <div className="screen dots-bg" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <h3 style={{ fontFamily: 'Nunito', fontWeight: 800 }}>Loading PhysioAlign Authenticator...</h3>
      </div>
    );
  }

  // Auth screen if not signed in
  if (!isSignedIn) {
    if (authView === 'landing') {
      return (
        <LandingScreen 
          onStartLogin={() => setAuthView('role_select')} 
          onEnterPractice={() => {
            sessionStorage.setItem('physioalign:registration_intent', 'patient');
            setAuthView('login');
          }} 
        />
      );
    }

    if (authView === 'role_select') {
      return (
        <div className="screen dots-bg" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: 24, gap: 28 }}>
          {/* Back button */}
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
            {/* Patient portal selection card */}
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
                  Log joints pain scale, practice active recovery poses, track biomechanical accuracy, and review AI coaching logs.
                </p>
              </div>
            </div>

            {/* Doctor portal selection card */}
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
                  Monitor patient ROM holds, track compliance statistics, view Recharts recovery trends, and trigger clinical Gemini reports.
                </p>
              </div>
            </div>

            {/* Admin portal selection card */}
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
                  Inspect SQL database engine type and directory size telemetry, configure tenant user roles, and trigger cascade deletes.
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
            const intent = sessionStorage.getItem('physioalign:registration_intent');
            if (intent === 'patient' && !sessionStorage.getItem('physioalign:registration_intent')) {
              setAuthView('landing');
            } else {
              setAuthView('role_select');
            }
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
          </div>

          <SignIn 
            appearance={{
              elements: {
                rootBox: {
                  width: '100%',
                  maxWidth: '400px',
                  margin: '0 auto'
                },
                cardBox: {
                  width: '100%',
                  border: '3.5px solid var(--line)',
                  borderRadius: 'var(--r-md)',
                  boxShadow: 'var(--plush-sm)',
                  overflow: 'hidden',
                  background: 'white'
                },
                card: {
                  border: 'none',
                  boxShadow: 'none',
                  background: 'white',
                  width: '100%'
                },
                footer: {
                  borderTop: '3.5px solid var(--line)',
                  background: 'var(--cream)'
                },
                headerTitle: { fontFamily: 'Nunito', fontWeight: 900 },
                headerSubtitle: { fontFamily: 'Nunito', fontWeight: 700 },
                socialButtonsBlockButton: { border: '2.5px solid var(--line)', boxShadow: '0 2px 0 var(--line)', borderRadius: 12, fontWeight: 800 },
                formButtonPrimary: { border: '2.5px solid var(--line)', boxShadow: '0 3px 0 var(--line)', background: 'var(--butter)', color: 'var(--ink)', borderRadius: 12, fontWeight: 800 },
                formButtonPrimary__hover: { background: 'var(--butter-deep)' },
                footerActionLink: { color: 'var(--peach-deep)' }
              }
            }} 
          />

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
