import { useState } from 'react';
import { useAuth } from '../utils/auth';
import { Wordmark, TopBar } from './primitives';
import { store } from '../game/store';
import { WordHighlight } from './WordHighlight';
import {
  HeartPulse,
  TrendingUp,
  MessageSquare,
  CheckCircle,
  Plus,
  Minus,
  Sparkles,
  Camera,
  ArrowRight,
} from 'lucide-react';

interface LandingScreenProps {
  onStartLogin?: () => void;
  onEnterPractice?: () => void;
}

const FAQS = [
  {
    q: 'How does the real-time pose tracking work?',
    a: "PhysioAlign uses Google MediaPipe directly in your browser. It accesses your webcam to track 33 key skeleton joint coordinates in real time, calculating joint angles to check your form. No video is ever sent to any server; it's private and runs local-first.",
  },
  {
    q: 'What does the AI Attending Coach do?',
    a: 'Once you complete a pose evaluation, your metrics (hold times, joint angles, deviations) are analyzed by Google Gemini AI. It acts as a clinical physical therapist, generating a structured report card, awarding a grade (A, B, C, or F), and providing safe anatomical alignment cues.',
  },
  {
    q: 'Who are the three specialized AI Yoga Coaches?',
    a: 'You can consult Zen Master Anya (for mindful breathing & slow alignment flows), Coach Rocky (for active core holding & muscle strength building), or Dr. Maya (a physical therapy specialist for joint modifications, stiffness recovery, and post-injury rehabilitation advice).',
  },
  {
    q: 'How does the Pain & Stiffness Tracker work?',
    a: "Before practicing, you can log how your body feels today on a scale of 1 to 10. PhysioAlign's AI decision engine automatically adapts your daily roadmap, recommending restorative holds and wellness habits if you feel stiff, or active pose challenges if you feel limber.",
  },
];

const FEATURES = [
  { icon: Camera, fill: 'var(--mint)', title: 'Joint tracking through your webcam', body: 'MediaPipe tracks 33 points on your body and checks joint angles and symmetry while you hold a pose. It runs in your browser, so the video stays on your device.' },
  { icon: HeartPulse, fill: 'var(--rose)', title: 'A daily pain and stiffness log', body: 'Log how your joints feel today on a 1 to 10 scale and the day’s stretches, cues and pose variations adapt to it.' },
  { icon: CheckCircle, fill: 'var(--butter)', title: 'A checklist for the day', body: 'Pose targets, water and breathing habits in one list, with a progress bar as you tick them off.' },
  { icon: Sparkles, fill: 'var(--peach)', title: 'A graded report after every hold', body: 'Gemini reads your hold time, scores and deviations, gives the session a grade and writes the cues to fix next time.' },
  { icon: MessageSquare, fill: 'var(--sky)', title: 'Three coaches to ask', body: 'Anya for breathing and alignment, Rocky for core strength, Dr. Maya for injury rehab and modifications.' },
  { icon: TrendingUp, fill: 'var(--cream-2)', title: 'Progress charts', body: 'See how your accuracy, hold times and individual poses change over time, session by session.' },
];


const PROBLEMS = [
  'A knee that drifts inward in Warrior II.',
  'Hips that sag halfway through a plank.',
  'A ten-second hold when you were asked for thirty.',
];

export function LandingScreen({ onStartLogin, onEnterPractice }: LandingScreenProps) {
  const { isSignedIn } = useAuth();
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const start = isSignedIn ? () => store.setScreen('dashboard') : () => onEnterPractice?.();
  const startLabel = isSignedIn ? 'Go to your dashboard' : 'Start a session';

  return (
    <div className="screen dots-bg landing">
      {isSignedIn ? (
        <TopBar here={0} steps={['Home']} />
      ) : (
        <header className="landing-header">
          <a href="#main" className="skip-link">Skip to content</a>
          <Wordmark size={28} />
          <button onClick={() => onStartLogin?.()} className="btn-plush primary sm">
            Sign in
          </button>
        </header>
      )}

      <main id="main" tabIndex={-1}>
        {/* hero: the first screen on its own */}
        <section className="l-hero" aria-labelledby="hero-title">
          <div className="l-wrap l-hero-grid">
            <div className="l-hero-copy enter">
              <h1 id="hero-title">Live posture coaching for home physio and yoga</h1>
              <p className="l-lead">
                Turn on your webcam and hold a pose. PhysioAlign tracks 33 points on your body and checks each joint
                angle while you hold it, then grades the session. The video never leaves your device.
              </p>
              <div className="l-actions">
                <button onClick={start} className="btn-plush primary tap l-cta">
                  {startLabel}
                  <ArrowRight size={18} aria-hidden="true" />
                </button>
                <a href="#features" className="btn-plush ghost tap">See what it does</a>
              </div>
            </div>
            <figure className="l-hero-shot plush enter">
              <img
                src="/preview-session.jpg"
                width={1600}
                height={920}
                // React 18 only passes the lowercase attribute through
                {...{ fetchpriority: 'high' }}
                alt="A PhysioAlign session: the camera view with the tracked skeleton, live alignment cues and joint angle readouts"
              />
            </figure>
          </div>
        </section>

        {/* problem statement */}
        <section className="l-section" aria-labelledby="problem-title">
          <div className="l-wrap l-split">
            <h2 id="problem-title">Home exercises drift when nobody is watching</h2>
            <div>
              <p className="l-body">
                Your physio shows you a pose once. At home, on your own, small errors creep in and nobody is there to
                catch them:
              </p>
              <ul className="l-problems">
                {PROBLEMS.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* the one scroll moment, as a slim band between the problem and the answer */}
        <section className="l-moment" aria-label="Privacy">
          <div className="l-wrap">
            <WordHighlight text="Your camera feed stays in this browser tab. PhysioAlign keeps the angles and scores from each session, never the video." />
          </div>
        </section>

        {/* solution overview */}
        <section className="l-section" id="features" aria-labelledby="features-title">
          <div className="l-wrap">
            <div className="l-head">
              <h2 id="features-title">What PhysioAlign does for you</h2>
              <p>Everything runs from one dashboard: practise, log how you feel, read your reports and ask a coach.</p>
            </div>
            <div className="l-features">
              {FEATURES.map(({ icon: Icon, fill, title, body }) => (
                <div key={title} className="plush l-feature">
                  <div className="l-feature-head">
                    {/* cream-2 is a ground colour, not an accent, so its icon takes the ink colour */}
                    <span className="l-icon" style={{ background: fill, color: fill === 'var(--cream-2)' ? 'var(--ink)' : undefined }} aria-hidden="true">
                      <Icon size={20} />
                    </span>
                    <h3>{title}</h3>
                  </div>
                  <p>{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>


        {/* call to action */}
        <section className="l-section l-final" aria-labelledby="cta-title">
          <div className="l-wrap">
            <div className="l-final-card">
              <div>
                <h2 id="cta-title">Pick a pose and turn on your camera</h2>
                <p>You need a webcam and enough room to step back until your knees, hips and shoulders are in frame.</p>
              </div>
              <button onClick={start} className="btn-plush primary tap l-cta">
                {startLabel}
                <ArrowRight size={18} aria-hidden="true" />
              </button>
            </div>
          </div>
        </section>

        <section className="l-faq" aria-labelledby="faq-title">
          <div className="l-wrap l-faq-inner">
            <div className="l-head">
              <h2 id="faq-title">Questions</h2>
              <p>About tracking, privacy, the reports and the coaches.</p>
            </div>
            <div className="l-faq-list">
              {FAQS.map((faq, idx) => {
                const isOpen = openFaq === idx;
                return (
                  <div key={faq.q} className="plush l-faq-item">
                    <button
                      onClick={() => setOpenFaq(isOpen ? null : idx)}
                      aria-expanded={isOpen}
                      aria-controls={`faq-${idx}`}
                      id={`faq-q-${idx}`}
                      className="l-faq-q"
                    >
                      <span>{faq.q}</span>
                      <span className={`l-faq-toggle${isOpen ? ' is-open' : ''}`} aria-hidden="true">
                        {isOpen ? <Minus size={14} /> : <Plus size={14} />}
                      </span>
                    </button>
                    {isOpen && (
                      <div id={`faq-${idx}`} role="region" aria-labelledby={`faq-q-${idx}`} className="l-faq-a">
                        {faq.a}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <span>© {new Date().getFullYear()} PhysioAlign</span>
      </footer>
    </div>
  );
}
