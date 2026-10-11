import { useEffect, useRef, useState } from 'react';
import { HelpCircle, LogOut, Settings, X } from 'lucide-react';
import { store, useScreen, useActiveTab, useUserData } from '../game/store';
import { useAuth, useUser } from '../utils/auth';

/** Logo mark: a plumb line with joint nodes either side, i.e. alignment. */
export function PhysioLogo({ size = 32, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      role="img"
      aria-label="PhysioAlign"
    >
      <rect width="32" height="32" rx="8" fill="var(--brand-600)" />
      <path
        d="M9 23 16 9l7 14"
        stroke="#fff"
        strokeWidth="2.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M12.4 18.2a6.4 6.4 0 0 0 7.2 0" stroke="#fff" strokeOpacity="0.55" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="16" cy="9" r="1.9" fill="#fff" />
    </svg>
  );
}

export function Wordmark({ size = 16 }: { size?: number }) {
  return (
    <span className="row row--sm" style={{ gap: 9 }}>
      <PhysioLogo size={Math.round(size * 1.65)} />
      <span className="brand__name" style={{ fontSize: size }}>
        Physio<span>Align</span>
      </span>
    </span>
  );
}

interface BreadcrumbProps {
  steps: string[];
  here: number;
}

export function Breadcrumb({ steps, here }: BreadcrumbProps) {
  return (
    <nav className="breadcrumb" aria-label="Progress">
      {steps.map((step, idx) => (
        <span key={step} className="row row--sm">
          {idx > 0 && <span className="breadcrumb__sep">/</span>}
          <span
            className={`breadcrumb__item${idx === here ? ' is-current' : ''}`}
            aria-current={idx === here ? 'step' : undefined}
          >
            {step}
          </span>
        </span>
      ))}
    </nav>
  );
}

function ProfileMenu() {
  const { user } = useUser();
  const { signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  if (!user) return null;
  const initials = (user.fullName || 'U')
    .split(' ')
    .slice(0, 2)
    .map((part: string) => part[0])
    .join('')
    .toUpperCase();

  return (
    <div style={{ position: 'relative' }} ref={ref}>
      <button
        className="avatar"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        style={{ cursor: 'pointer', padding: 0 }}
      >
        <span className="avatar-initials">{initials}</span>
      </button>

      {open && (
        <div className="menu" role="menu">
          <div className="menu__header">
            <div className="text-sm semibold truncate">{user.fullName}</div>
            <div className="text-xs muted truncate">{user.primaryEmailAddress.emailAddress}</div>
          </div>
          <button
            className="menu__item"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              store.setScreen('onboarding');
            }}
          >
            <Settings size={15} />
            Profile settings
          </button>
          <button className="menu__item" role="menuitem" onClick={signOut}>
            <LogOut size={15} />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

interface TopBarProps {
  here: number;
  steps: string[];
  userName?: string;
  showProfile?: boolean;
}

export function TopBar({ here, steps, showProfile = true }: TopBarProps) {
  const currentScreen = useScreen();
  const activeTab = useActiveTab();
  const userData = useUserData();
  const [helpOpen, setHelpOpen] = useState(false);

  const navItems =
    userData?.role === 'admin'
      ? [{ label: 'Accounts', isActive: currentScreen === 'admin', action: () => store.setScreen('admin') }]
      : userData?.role === 'doctor'
        ? [{ label: 'Patients', isActive: currentScreen === 'doctor', action: () => store.setScreen('doctor') }]
        : [
            { label: 'Dashboard', isActive: currentScreen === 'dashboard' && activeTab === 'dashboard', action: () => store.setActiveTab('dashboard') },
            { label: 'Poses', isActive: currentScreen === 'library', action: () => store.setScreen('library') },
          ];

  return (
    <header className="appbar">
      <div className="container container--wide appbar__inner">
        <button
          className="brand"
          onClick={() =>
            store.setScreen(userData?.role === 'admin' ? 'admin' : userData?.role === 'doctor' ? 'doctor' : 'dashboard')
          }
          aria-label="PhysioAlign home"
        >
          <PhysioLogo size={28} />
          <span className="brand__name">
            Physio<span>Align</span>
          </span>
        </button>

        {showProfile ? (
          <nav className="nav" aria-label="Main">
            {navItems.map((item) => (
              <button
                key={item.label}
                className={`nav-link${item.isActive ? ' is-active' : ''}`}
                onClick={item.action}
                aria-current={item.isActive ? 'page' : undefined}
              >
                {item.label}
              </button>
            ))}
          </nav>
        ) : (
          <Breadcrumb steps={steps} here={here} />
        )}

        {showProfile ? (
          <div className="row row--sm">
            <button className="btn btn--icon" onClick={() => setHelpOpen(true)} aria-label="Help and FAQ" title="Help">
              <HelpCircle size={17} />
            </button>
            <ProfileMenu />
          </div>
        ) : (
          <div style={{ width: 92 }} />
        )}
      </div>

      {helpOpen && <HelpDialog onClose={() => setHelpOpen(false)} />}
    </header>
  );
}

const FAQS = [
  {
    q: 'How does pose tracking work?',
    a: 'MediaPipe runs in your browser and tracks 33 body landmarks per frame. Video never leaves your device — only the per-second scores and joint angles are saved.',
  },
  {
    q: 'How is my score calculated?',
    a: 'Every pose defines a target range for each joint. A frame starts at 100 and loses points for joints outside their range. Any second at 70 or above counts towards hold time.',
  },
  {
    q: 'What do the AI reports include?',
    a: 'After each session, Gemini reviews the corrections logged during practice and writes a short report: what held well, what to adjust, and safety notes for your goal.',
  },
  {
    q: 'What do the coaches do?',
    a: 'Three chat coaches cover different needs: breathing and alignment, strength and holds, and rehab modifications for injuries or stiffness.',
  },
];

function HelpDialog({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label="Help" onClick={(e) => e.stopPropagation()}>
        <div className="modal__header">
          <h2 style={{ fontSize: 16 }}>Help &amp; FAQ</h2>
          <button className="btn btn--icon" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>
        <div className="modal__body stack">
          <div className="stack stack--sm">
            <h3>Getting started</h3>
            <ol className="stack stack--sm secondary text-sm" style={{ paddingLeft: 18, margin: 0 }}>
              <li>Log how your joints feel today on the dashboard.</li>
              <li>Work through the daily plan, or pick any pose from the library.</li>
              <li>Allow camera access and follow the live alignment cues.</li>
              <li>Review the session report and track your progress over time.</li>
            </ol>
          </div>

          <div className="stack stack--sm">
            <h3>Questions</h3>
            {FAQS.map((faq) => (
              <div key={faq.q} className="card card--flat">
                <div className="card__body card__body--tight">
                  <div className="text-sm semibold">{faq.q}</div>
                  <p className="text-sm muted" style={{ marginTop: 4 }}>
                    {faq.a}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
