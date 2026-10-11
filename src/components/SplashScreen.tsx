import { store } from '../game/store';
import { Wordmark, PhysioLogo } from './primitives';

export function SplashScreen() {
  const handleStart = () => {
    store.setScreen('onboarding');
  };

  return (
    <div className="screen dots-bg" style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', justifyContent: 'space-between', padding: 24 }}>
      {/* Top spacing */}
      <div style={{ height: 40 }} />

      {/* Main content */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 24, maxWidth: 480, margin: '0 auto' }}>
        
        {/* Animated Cute Logo Face */}
        <div className="floaty" style={{ cursor: 'pointer' }}>
          <PhysioLogo size={145} />
        </div>

        {/* Brand Name */}
        <div style={{ marginTop: 12 }}>
          <Wordmark size={48} />
        </div>

        {/* Subtitle */}
        <p style={{
          fontSize: 18,
          fontWeight: 700,
          color: 'var(--ink-2)',
          lineHeight: 1.5,
          margin: 0
        }}>
          Transform your webcam into a clinical-grade yoga trainer. Evaluate your alignment, track holds, and receive critiques from our AI Attending Coach.
        </p>

        {/* Start Button */}
        <button
          onClick={handleStart}
          className="btn-plush primary popin"
          style={{ width: '100%', maxWidth: 280, marginTop: 12, fontSize: 20 }}
        >
          Begin Practice
        </button>
      </div>

      {/* Footer */}
      <div style={{ textAlign: 'center', fontSize: 13, fontWeight: 800, color: 'var(--ink-soft)' }}>
        Built with ❤️ for your daily yoga practice. Powered by MediaPipe & Gemini.
      </div>
    </div>
  );
}
