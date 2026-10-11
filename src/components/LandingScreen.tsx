import { useState } from 'react';
import { useAuth } from '../utils/auth';
import { PhysioLogo, TopBar } from './primitives';
import {
  Activity,
  Camera,
  ChevronDown,
  ClipboardList,
  LineChart,
  Lock,
  MessageSquare,
  Stethoscope,
} from 'lucide-react';

interface LandingScreenProps {
  onStartLogin?: () => void;
  onEnterPractice?: () => void;
}

const FEATURES = [
  {
    icon: Camera,
    title: 'Live alignment feedback',
    body: 'MediaPipe tracks 33 body landmarks per frame. Joint angles are scored against the target range for each pose and corrected on screen and out loud.',
  },
  {
    icon: Activity,
    title: 'Hold timing that counts',
    body: 'Only seconds spent in good form add to your hold time, so a session reflects control rather than how long you stood in front of the camera.',
  },
  {
    icon: ClipboardList,
    title: 'Session reports',
    body: 'Each session is graded and summarised: which joints held, what slipped, and the cues to focus on next time.',
  },
  {
    icon: LineChart,
    title: 'Progress over time',
    body: 'Accuracy, streaks and the joints that need the most attention, tracked across every session you complete.',
  },
  {
    icon: Stethoscope,
    title: 'Clinician review',
    body: 'Approved clinicians see their assigned patients’ history and prescribe poses with target hold times and frequency.',
  },
  {
    icon: MessageSquare,
    title: 'Coaching chat',
    body: 'Three coaches for breathing and alignment, strength and holds, or rehab modifications after an injury.',
  },
];

const STEPS = [
  { title: 'Set up your profile', body: 'Age, experience and your main goal tune the thresholds and the advice you get.' },
  { title: 'Pick a pose', body: 'Nine poses, each with instructions, target angles and a reference image.' },
  { title: 'Practise with the camera on', body: 'Follow the live cues and hold the pose. Everything is processed on your device.' },
  { title: 'Review the report', body: 'See your accuracy over time, the grade and what to work on before the next session.' },
];

const FAQS = [
  {
    q: 'Does my video get uploaded?',
    a: 'No. Pose detection runs in your browser with MediaPipe. Only the per-second scores and joint angles are sent to the server so your history and reports can be saved.',
  },
  {
    q: 'How is a pose scored?',
    a: 'Every pose defines a target range for each joint. A frame starts at 100 and loses points for each joint outside its range, with bigger deviations costing more. Any second scoring 70 or above counts towards hold time.',
  },
  {
    q: 'What do the AI reports contain?',
    a: 'After a session, Gemini reviews the corrections logged during practice and writes a short report: a biomechanical summary, two or three alignment cues, and safety notes for your age and goal.',
  },
  {
    q: 'Who can see my sessions?',
    a: 'Only you, and a clinician an administrator has assigned to you. Clinician accounts stay pending until an administrator approves them.',
  },
  {
    q: 'What do I need to run it?',
    a: 'A laptop or desktop with a webcam, and enough room to step back so your whole body is in frame. Chrome gives the smoothest tracking.',
  },
];

export function LandingScreen({ onStartLogin, onEnterPractice }: LandingScreenProps) {
  const { isSignedIn } = useAuth();
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const start = onEnterPractice || onStartLogin;

  return (
    <div className="marketing">
      {isSignedIn ? (
        <TopBar here={0} steps={['Home']} />
      ) : (
        <header className="marketing__nav">
          <div className="container container--wide appbar__inner">
            <span className="brand">
              <PhysioLogo size={28} />
              <span className="brand__name">
                Physio<span>Align</span>
              </span>
            </span>
            <div className="row row--sm">
              <a className="nav-link marketing__link" href="#features">
                Features
              </a>
              <a className="nav-link marketing__link" href="#how-it-works">
                How it works
              </a>
              <a className="nav-link marketing__link" href="#faq">
                FAQ
              </a>
              <button className="btn btn--primary btn--sm" onClick={onStartLogin}>
                Sign in
              </button>
            </div>
          </div>
        </header>
      )}

      <section className="hero">
        <div className="container hero__inner">
          <span className="eyebrow">
            <Lock size={13} />
            Runs locally in your browser
          </span>
          <h1>Check your posture in real time, without sending video anywhere.</h1>
          <p className="hero__lede">
            PhysioAlign turns a webcam into a posture coach for yoga and physiotherapy. It measures your joint angles on every
            frame, tells you what to correct as you hold a pose, and keeps a record your clinician can review.
          </p>
          <div className="row row--sm" style={{ marginTop: 4 }}>
            <button className="btn btn--primary btn--lg" onClick={start}>
              Start a session
            </button>
            <a className="btn btn--secondary btn--lg" href="#how-it-works">
              See how it works
            </a>
          </div>

          <figure className="hero__preview" style={{ margin: '36px 0 0', maxWidth: 940 }}>
            <img src="/preview-session.jpg" alt="PhysioAlign live session screen with skeleton overlay and joint angle readouts" />
          </figure>
        </div>
      </section>

      <section className="section" id="features">
        <div className="container">
          <div className="section__head">
            <h2>Everything a practice session needs</h2>
            <p className="page-subtitle">From the first camera frame to the report your clinician reads afterwards.</p>
          </div>
          <div className="grid grid--3">
            {FEATURES.map((feature) => (
              <div key={feature.title} className="card">
                <div className="card__body feature">
                  <span className="icon-tile">
                    <feature.icon size={18} />
                  </span>
                  <h3>{feature.title}</h3>
                  <p>{feature.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section section--muted" id="how-it-works">
        <div className="container">
          <div className="section__head">
            <h2>How it works</h2>
            <p className="page-subtitle">Four steps, about five minutes for your first session.</p>
          </div>
          <div className="grid grid--4">
            {STEPS.map((step, idx) => (
              <div key={step.title} className="step">
                <span className="step__num">{idx + 1}</span>
                <div>
                  <h3 style={{ fontSize: 14.5 }}>{step.title}</h3>
                  <p className="text-sm muted" style={{ marginTop: 4 }}>
                    {step.body}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section" id="faq">
        <div className="container container--narrow">
          <div className="section__head">
            <h2>Questions</h2>
          </div>
          <div className="stack stack--sm">
            {FAQS.map((faq, idx) => {
              const open = openFaq === idx;
              return (
                <div key={faq.q} className="card">
                  <button
                    className="card__body card__body--tight row spread"
                    style={{ width: '100%', background: 'none', border: 0, cursor: 'pointer', textAlign: 'left' }}
                    onClick={() => setOpenFaq(open ? null : idx)}
                    aria-expanded={open}
                  >
                    <span className="text-sm semibold">{faq.q}</span>
                    <ChevronDown
                      size={16}
                      className="muted"
                      style={{ flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 150ms ease' }}
                    />
                  </button>
                  {open && (
                    <div className="card__body card__body--tight" style={{ paddingTop: 0 }}>
                      <p className="text-sm secondary">{faq.a}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="section section--muted" style={{ borderBottom: 0 }}>
        <div className="container" style={{ textAlign: 'center' }}>
          <h2 style={{ fontSize: 26, letterSpacing: '-0.025em' }}>Ready to check your alignment?</h2>
          <p className="page-subtitle" style={{ margin: '8px auto 20px', maxWidth: 480 }}>
            Create an account, allow camera access and run your first session.
          </p>
          <button className="btn btn--primary btn--lg" onClick={start}>
            Get started
          </button>
        </div>
      </section>

      <footer className="footer">
        <div className="container footer__inner">
          <span className="row row--sm">
            <PhysioLogo size={22} />
            PhysioAlign
          </span>
          <span>A personal project, not a medical device.</span>
        </div>
      </footer>
    </div>
  );
}
