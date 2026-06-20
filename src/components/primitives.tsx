import { useState } from 'react';
import { X, User } from 'lucide-react';
import { store, useScreen, useActiveTab } from '../game/store';
import { UserButton } from '@clerk/clerk-react';

// --- DOODLE ICONS ---
export type DoodleKind = 'star' | 'flower' | 'heart' | 'cross' | 'leaf';

interface DoodleProps {
  kind: DoodleKind;
  size?: number;
  color?: string;
  className?: string;
}

export function Doodle({ kind, size = 24, color = 'var(--line)', className = '' }: DoodleProps) {
  if (kind === 'flower') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <circle cx="12" cy="12" r="3" fill={color} stroke="var(--line)" strokeWidth="2.5" />
        <circle cx="12" cy="6" r="3.5" fill={color} stroke="var(--line)" strokeWidth="2.5" />
        <circle cx="12" cy="18" r="3.5" fill={color} stroke="var(--line)" strokeWidth="2.5" />
        <circle cx="6" cy="12" r="3.5" fill={color} stroke="var(--line)" strokeWidth="2.5" />
        <circle cx="18" cy="12" r="3.5" fill={color} stroke="var(--line)" strokeWidth="2.5" />
      </svg>
    );
  }
  if (kind === 'leaf') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <path d="M12 2C12 2 4 10 4 14C4 18.4 7.6 22 12 22C16.4 22 20 18.4 20 14C20 10 12 2 12 2Z" fill={color} stroke="var(--line)" strokeWidth="2.5" />
        <path d="M12 22V6" stroke="var(--line)" strokeWidth="2.5" />
        <path d="M12 14C12 14 15 12 17 13" stroke="var(--line)" strokeWidth="2" strokeLinecap="round" />
        <path d="M12 17C12 17 9 15 7 16" stroke="var(--line)" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }
  if (kind === 'star') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <path
          d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"
          fill={color}
          stroke="var(--line)"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (kind === 'heart') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <path
          d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
          fill={color}
          stroke="var(--line)"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  // Cross
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M12 2v20M2 12h20"
        stroke={color}
        strokeWidth="4"
        strokeLinecap="round"
      />
    </svg>
  );
}

// --- WORDMARK ---
export function Wordmark({ size = 32, dark = false }) {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 10,
        fontFamily: 'Nunito',
        fontWeight: 900,
        fontSize: size,
        color: dark ? 'white' : 'var(--ink)',
        letterSpacing: '-0.02em',
      }}
    >
      <PhysioLogo size={Math.round(size * 1.15)} />
      <span style={{ position: 'relative', display: 'inline-block' }}>
        Physio
        <span
          style={{
            color: 'var(--peach-deep)',
            textShadow: dark ? 'none' : '0 2px 0 var(--line)',
            WebkitTextStroke: dark ? '0' : '2px var(--line)',
            paintOrder: 'stroke fill',
          }}
        >
          Align
        </span>
      </span>
    </div>
  );
}

// --- BREADCRUMB ---
interface BreadcrumbProps {
  steps: string[];
  here: number;
}

export function Breadcrumb({ steps, here }: BreadcrumbProps) {
  return (
    <div className="breadcrumb" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {steps.map((step, idx) => (
        <span key={step} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          {idx > 0 && <span className="sep" style={{ fontWeight: 800, color: 'var(--ink-soft)' }}>/</span>}
          {idx === here ? (
            <span 
              className="here popin" 
              style={{ 
                fontFamily: 'inherit',
                fontWeight: 900,
                fontSize: '13px',
                color: 'var(--ink)',
                background: 'var(--butter)',
                border: '2px solid var(--line)',
                borderRadius: '8px',
                padding: '4px 12px',
                boxShadow: '0 2px 0 var(--line)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}
            >
              {step}
            </span>
          ) : (
            <span style={{ opacity: 0.6, fontWeight: 700, fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{step}</span>
          )}
        </span>
      ))}
    </div>
  );
}

// --- TOPBAR ---
interface TopBarProps {
  here: number;
  steps: string[];
  userName?: string;
  showProfile?: boolean;
}

export function TopBar({ here, steps, showProfile = true }: TopBarProps) {
  const currentScreen = useScreen();
  const activeTab = useActiveTab();
  const [helpOpen, setHelpOpen] = useState(false);

  const isLinkActive = (item: 'landing' | 'dashboard' | 'library' | 'consult') => {
    if (item === 'landing') return currentScreen === 'landing';
    if (item === 'library') return currentScreen === 'library';
    if (item === 'dashboard') return currentScreen === 'dashboard' && activeTab === 'dashboard';
    if (item === 'consult') return currentScreen === 'dashboard' && activeTab === 'consult';
    return false;
  };

  const navItems = [
    { label: 'Home', screen: 'landing', action: () => store.setScreen('landing') },
    { label: 'Dashboard', screen: 'dashboard', action: () => store.setActiveTab('dashboard') },
    { label: 'Pose Library', screen: 'library', action: () => store.setScreen('library') },
    { label: 'Chatbot', screen: 'consult', action: () => store.setActiveTab('consult') },
  ];

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '14px 22px',
        borderBottom: '3px solid var(--line)',
        background: 'white',
      }}
    >
      <span
        className="tap"
        onClick={() => store.setScreen('dashboard')}
        title="Back to dashboard"
        style={{ display: 'inline-flex', alignItems: 'center', cursor: 'pointer' }}
      >
        <Wordmark size={28} />
      </span>

      {showProfile ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {navItems.map((item) => {
            const active = isLinkActive(item.screen as any);
            return (
              <button
                key={item.label}
                onClick={item.action}
                className="tap"
                style={{
                  background: active ? 'var(--butter)' : 'white',
                  border: '2.5px solid var(--line)',
                  borderRadius: 'var(--r-sm)',
                  padding: '6px 14px',
                  fontFamily: 'inherit',
                  fontSize: 13,
                  fontWeight: 900,
                  color: 'var(--ink)',
                  cursor: 'pointer',
                  boxShadow: active ? '0 1px 0 var(--line)' : '0 2.5px 0 var(--line)',
                  transform: active ? 'translateY(1.5px)' : 'none',
                  transition: 'all 100ms',
                }}
              >
                {item.label}
              </button>
            );
          })}
          <button
            onClick={() => setHelpOpen(true)}
            className="tap"
            style={{
              background: 'white',
              border: '2.5px solid var(--line)',
              borderRadius: 'var(--r-sm)',
              padding: '6px 14px',
              fontFamily: 'inherit',
              fontSize: 13,
              fontWeight: 900,
              color: 'var(--ink)',
              cursor: 'pointer',
              boxShadow: '0 2.5px 0 var(--line)',
              transition: 'all 100ms',
            }}
          >
            Help & FAQ
          </button>
        </div>
      ) : (
        <Breadcrumb steps={steps} here={here} />
      )}

      {showProfile ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={() => store.setScreen('onboarding')}
            className="tap"
            style={{
              background: 'white',
              border: '2.5px solid var(--line)',
              borderRadius: 'var(--r-sm)',
              padding: '6px 12px',
              fontFamily: 'inherit',
              fontSize: 13,
              fontWeight: 900,
              color: 'var(--ink)',
              cursor: 'pointer',
              boxShadow: '0 2.5px 0 var(--line)',
              transition: 'all 100ms',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            <User size={14} style={{ strokeWidth: 3 }} />
            Edit Profile
          </button>
          
          <div style={{
            border: '2.5px solid var(--line)',
            borderRadius: '50%',
            overflow: 'hidden',
            width: 32,
            height: 32,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 0 var(--line)'
          }}>
            <UserButton afterSignOutUrl="/" />
          </div>
        </div>
      ) : (
        <div style={{ width: 80 }} />
      )}

      {/* Help Modal */}
      {helpOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.4)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 20
        }}>
          <div className="plush popin" style={{
            background: 'white',
            maxWidth: 580,
            width: '100%',
            maxHeight: '85vh',
            display: 'flex',
            flexDirection: 'column',
            borderRadius: 'var(--r-md)',
            overflow: 'hidden',
            border: '4px solid var(--line)',
          }}>
            {/* Modal Header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '16px 20px',
              borderBottom: '3.5px solid var(--line)',
              background: 'var(--mint)',
            }}>
              <h3 style={{ fontSize: 20, fontWeight: 900, color: 'var(--ink)', margin: 0 }}>
                PhysioAlign Guide & FAQs
              </h3>
              <button
                onClick={() => setHelpOpen(false)}
                className="tap"
                style={{
                  padding: '4px',
                  borderRadius: '50%',
                  width: 30,
                  height: 30,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  border: '2.5px solid var(--line)',
                  background: 'white',
                  boxShadow: '0 1.5px 0 var(--line)'
                }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Content */}
            <div style={{
              flex: 1,
              overflowY: 'auto',
              padding: 24,
              display: 'flex',
              flexDirection: 'column',
              gap: 20,
              background: 'var(--cream)',
            }}>
              {/* Quick Instructions */}
              <div className="plush" style={{ padding: 18, background: 'white', border: '3px solid var(--line)', borderRadius: 'var(--r-sm)' }}>
                <h4 style={{ fontSize: 16, fontWeight: 900, color: 'var(--ink)', marginTop: 0, marginBottom: 8 }}>
                  How to use PhysioAlign
                </h4>
                <ol style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-2)', paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 6, margin: 0 }}>
                  <li>Log your daily stiffness using the <strong>Pain Tracker</strong> on the dashboard.</li>
                  <li>Follow your automatically adapted <strong>Daily Roadmap</strong>.</li>
                  <li>Head to the <strong>Pose Library</strong> to practice with real-time AI posture feedback via your webcam.</li>
                  <li>Read your post-session <strong>OSCE Grade report card</strong> powered by Google Gemini AI.</li>
                  <li>Consult our specialized AI coaches in the <strong>Chatbot</strong> section for customized advice.</li>
                </ol>
              </div>

              {/* FAQs */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <h4 style={{ fontSize: 16, fontWeight: 900, color: 'var(--ink)', margin: '0 0 4px 0' }}>
                  Frequently Asked Questions
                </h4>
                
                <div className="plush" style={{ padding: 14, background: 'white', border: '3px solid var(--line)', borderRadius: 'var(--r-sm)' }}>
                  <h5 style={{ fontSize: 14, fontWeight: 900, color: 'var(--ink)', margin: '0 0 6px 0' }}>
                    How does the real-time pose tracking work?
                  </h5>
                  <p style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink-soft)', margin: 0, lineHeight: 1.4 }}>
                    PhysioAlign uses Google MediaPipe in your browser to track 33 skeleton coordinates in real-time. No video is ever sent to servers—it's 100% private and runs local-first.
                  </p>
                </div>

                <div className="plush" style={{ padding: 14, background: 'white', border: '3px solid var(--line)', borderRadius: 'var(--r-sm)' }}>
                  <h5 style={{ fontSize: 14, fontWeight: 900, color: 'var(--ink)', margin: '0 0 6px 0' }}>
                    What does the AI Attending Coach do?
                  </h5>
                  <p style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink-soft)', margin: 0, lineHeight: 1.4 }}>
                    Once you complete a pose session, your metrics (hold times, angles, deviations) are analyzed by Google Gemini AI to generate a clinical grade (A, B, C, F) and alignment cues.
                  </p>
                </div>

                <div className="plush" style={{ padding: 14, background: 'white', border: '3px solid var(--line)', borderRadius: 'var(--r-sm)' }}>
                  <h5 style={{ fontSize: 14, fontWeight: 900, color: 'var(--ink)', margin: '0 0 6px 0' }}>
                    Who are the three specialized AI Yoga Coaches?
                    {" "}
                  </h5>
                  <p style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink-soft)', margin: 0, lineHeight: 1.4 }}>
                    You can consult Zen Master Anya (for mindful breathing & alignment flows), Coach Rocky (for core strength building), or Dr. Maya (a physical therapy specialist for joint modifications).
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// --- CUTE AVATAR ---
export function CuteFace({ size = 80, skin = '#FFD8B5', mood = 'happy' }) {
  const stroke = 'var(--line)';
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" style={{ transform: 'rotate(-2deg)' }}>
      {/* Hair back */}
      <circle cx="100" cy="100" r="72" fill="var(--ink-2)" />
      {/* Face circle */}
      <circle cx="100" cy="104" r="62" fill={skin} stroke={stroke} strokeWidth="6" />
      {/* Hair top cut */}
      <path d="M 42 78 Q 60 38 100 40 Q 140 38 158 78 Q 130 60 100 64 Q 70 60 42 78 Z" fill="var(--ink-2)" stroke={stroke} strokeWidth="3" />
      {/* Blush */}
      <ellipse cx="70" cy="120" rx="10" ry="7" fill="#FF9DAA" opacity="0.8" />
      <ellipse cx="130" cy="120" rx="10" ry="7" fill="#FF9DAA" opacity="0.8" />
      {/* Eyes */}
      <circle cx="78" cy="104" r="6" fill={stroke} />
      <circle cx="122" cy="104" r="6" fill={stroke} />
      {/* Mouth */}
      {mood === 'happy' ? (
        <path d="M 85 130 Q 100 152 115 130" stroke={stroke} strokeWidth="5" fill="none" strokeLinecap="round" />
      ) : (
        <path d="M 85 136 Q 100 125 115 136" stroke={stroke} strokeWidth="5" fill="none" strokeLinecap="round" />
      )}
    </svg>
  );
}

// --- PHYSIOALIGN JOINT TRACKING SKELETON LOGO ---
export function PhysioLogo({ size = 80, className = '' }) {
  return (
    <div 
      className={className} 
      style={{ 
        width: size, 
        height: size, 
        borderRadius: '50%', 
        overflow: 'hidden', 
        border: '3.5px solid var(--line)',
        boxShadow: '4.5px 4.5px 0 var(--line)',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'white',
        flexShrink: 0,
        transform: 'rotate(-1deg)'
      }}
    >
      <img 
        src="/logo.png" 
        alt="PhysioAlign Logo" 
        style={{ 
          width: '100%', 
          height: '100%', 
          objectFit: 'cover' 
        }} 
      />
    </div>
  );
}
