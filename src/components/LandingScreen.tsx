import { useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { Wordmark, TopBar, PhysioLogo } from './primitives';
import { store } from '../game/store';
import { 
  HeartPulse, 
  TrendingUp, 
  MessageSquare, 
  CheckCircle, 
  Plus,
  Minus,
  Sparkles,
  Camera
} from 'lucide-react';

interface LandingScreenProps {
  onStartLogin?: () => void;
  onEnterPractice?: () => void;
}

export function LandingScreen({ onStartLogin, onEnterPractice }: LandingScreenProps) {
  const { isSignedIn } = useAuth();
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const faqs = [
    {
      q: "How does the real-time pose tracking work?",
      a: "PhysioAlign uses Google MediaPipe directly in your browser. It accesses your webcam to track 33 key skeleton joint coordinates in real-time, calculating joint angles to check your form. No video is ever sent to any server—it's 100% private and runs local-first."
    },
    {
      q: "What does the AI Attending Coach do?",
      a: "Once you complete a pose evaluation, your metrics (hold times, joint angles, deviations) are analyzed by Google Gemini AI. It acts as a clinical physical therapist, generating a structured report card, awarding a grade (A, B, C, or F), and providing safe anatomical alignment cues."
    },
    {
      q: "Who are the three specialized AI Yoga Coaches?",
      a: "You can consult Zen Master Anya (for mindful breathing & slow alignment flows), Coach Rocky (for active core holding & muscle strength building), or Dr. Maya (a physical therapy specialist for joint modifications, stiffness recovery, and post-injury rehabilitation advice)."
    },
    {
      q: "How does the Pain & Stiffness Tracker work?",
      a: "Before practicing, you can log how your body feels today on a scale of 1 to 10. PhysioAlign's AI decision engine automatically adapts your daily roadmap—recommending restorative holds and wellness habits if you feel stiff, or active pose challenges if you feel limber."
    }
  ];

  const toggleFaq = (idx: number) => {
    setOpenFaq(openFaq === idx ? null : idx);
  };

  return (
    <div className="screen dots-bg" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      
      {/* Top Header Row */}
      {isSignedIn ? (
        <TopBar here={0} steps={['Home']} />
      ) : (
        <header style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 32px',
          borderBottom: '3.5px solid var(--line)',
          background: 'white',
          position: 'sticky',
          top: 0,
          zIndex: 100
        }}>
          <Wordmark size={32} />
          <button
            onClick={() => onStartLogin?.()}
            className="btn-plush primary"
            style={{
              fontSize: '15px',
              padding: '10px 20px',
              borderRadius: 'var(--r-pill)',
              boxShadow: '0 3px 0 var(--line)'
            }}
          >
            Get Started
          </button>
        </header>
      )}

      {/* Main Content */}
      <main style={{
        flex: 1,
        maxWidth: 1100,
        width: '100%',
        margin: '0 auto',
        padding: '48px 24px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 64
      }}>
        
        {/* Hero Section */}
        <section style={{
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 24,
          maxWidth: 760
        }} className="popin">
          
          <div className="floaty" style={{ display: 'inline-block' }}>
            <PhysioLogo size={120} />
          </div>

          <h1 style={{
            fontSize: 'clamp(2.5rem, 5vw, 4.2rem)',
            fontWeight: 900,
            color: 'var(--ink)',
            lineHeight: 1.1,
            marginTop: 8
          }}>
            AI Rehab & Posture <br/>
            <span style={{
              color: 'var(--peach-deep)',
              position: 'relative',
              display: 'inline-block'
            }}>
              Yoga Trainer
              <span style={{
                position: 'absolute',
                bottom: -8,
                left: 0,
                width: '100%',
                height: 6,
                background: 'var(--butter)',
                borderRadius: 4,
                zIndex: -1
              }} />
            </span>
          </h1>

          <p style={{
            fontSize: '18px',
            fontWeight: 800,
            color: 'var(--ink-2)',
            lineHeight: 1.5,
            maxWidth: 640
          }}>
            PhysioAlign is an interactive wellness platform combining local-first computer vision posture tracking, daily pain/fatigue logs, adaptive routines, and multi-agent AI clinical coaching.
          </p>

          <button
            onClick={isSignedIn ? () => store.setScreen('dashboard') : () => onEnterPractice?.()}
            className="btn-plush primary tap wobble"
            style={{
              fontSize: '22px',
              padding: '18px 42px',
              marginTop: 12
            }}
          >
            {isSignedIn ? 'Go to Dashboard ➔' : 'Enter Practice Suite ➔'}
          </button>
        </section>

        {/* Dynamic Features Showcase Grid */}
        <section style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 28 }}>
          <h2 style={{ fontSize: 28, fontWeight: 900, textAlign: 'center', color: 'var(--ink)' }}>
            Recovery & Training Features
          </h2>
          
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: 24
          }}>
            {/* 1. Computer Vision */}
            <div className="plush tap" style={{ background: 'white', padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--mint)', border: '2px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--plush-tiny)' }}>
                <Camera size={20} color="var(--ink)" />
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 900 }}>Webcam Joint Calibration</h3>
              <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink-2)', lineHeight: 1.5, margin: 0 }}>
                Client-side MediaPipe tracks 33 anatomical keypoints to check joint extensions, angles, and symmetry in real time. Private, local, and secure.
              </p>
            </div>

            {/* 2. Pain Tracker */}
            <div className="plush tap" style={{ background: 'white', padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--rose)', border: '2px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--plush-tiny)' }}>
                <HeartPulse size={20} color="var(--ink)" />
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 900 }}>Daily Pain & Stiffness Log</h3>
              <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink-2)', lineHeight: 1.5, margin: 0 }}>
                Adapt your workout to how your joints feel today. Log your daily stiffness index (1-10) to generate custom stretches, wellness cues, and joint variations.
              </p>
            </div>

            {/* 3. Daily Habits */}
            <div className="plush tap" style={{ background: 'white', padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--butter)', border: '2px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--plush-tiny)' }}>
                <CheckCircle size={20} color="var(--ink)" />
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 900 }}>Today's Wellness Roadmap</h3>
              <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink-2)', lineHeight: 1.5, margin: 0 }}>
                A dynamic daily checklist linking pose practice targets, water hydration goals, and mindful breathing habits, keeping you motivated with progress bars.
              </p>
            </div>

            {/* 4. AI Grader */}
            <div className="plush tap" style={{ background: 'white', padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--peach)', border: '2px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--plush-tiny)' }}>
                <Sparkles size={20} color="var(--ink)" />
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 900 }}>Attending Coach AI Grader</h3>
              <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink-2)', lineHeight: 1.5, margin: 0 }}>
                Gemini AI reviews your hold statistics, average scores, and deviations to award an OSCE-grade and output clinical cue corrections.
              </p>
            </div>

            {/* 5. Specialized AI Coaches */}
            <div className="plush tap" style={{ background: 'white', padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--sky)', border: '2px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--plush-tiny)' }}>
                <MessageSquare size={20} color="var(--ink)" />
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 900 }}>Multi-Coach Chat consult</h3>
              <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink-2)', lineHeight: 1.5, margin: 0 }}>
                Chat directly with specialized AI yoga instructors: Anya (Zen Alignment), Rocky (Core & Strength), or Dr. Maya (Injury Rehab & Modifications).
              </p>
            </div>

            {/* 6. Analytics Trends */}
            <div className="plush tap" style={{ background: 'white', padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--cream-2)', border: '2px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--plush-tiny)' }}>
                <TrendingUp size={20} color="var(--ink)" />
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 900 }}>Rehab Analytics & Charts</h3>
              <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink-2)', lineHeight: 1.5, margin: 0 }}>
                Visualize your performance over time using responsive neobrutalist line and bar charts tracking average accuracy, hold times, and pose-by-pose statistics.
              </p>
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 28 }}>
          <h2 style={{ fontSize: 28, fontWeight: 900, textAlign: 'center', color: 'var(--ink)' }}>
            How PhysioAlign Works
          </h2>
          
          <div style={{
            display: 'flex',
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 24,
            justifyContent: 'center'
          }}>
            {/* Step 1 */}
            <div className="plush" style={{ background: 'white', padding: 24, flex: '1 1 280px', maxWidth: 320, position: 'relative' }}>
              <div style={{
                position: 'absolute', top: -16, left: -16, width: 40, height: 40, borderRadius: '50%',
                border: '3.5px solid var(--line)', background: 'var(--butter)', display: 'flex',
                alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 900,
                boxShadow: '0 2px 0 var(--line)'
              }}>1</div>
              <h3 style={{ fontSize: 18, fontWeight: 900, marginTop: 8 }}>Log Daily Index</h3>
              <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-2)', lineHeight: 1.5, marginTop: 8, margin: 0 }}>
                Select how your muscles and joints feel today. Receive an updated wellness checklist customized to your flexibility and stiffness.
              </p>
            </div>

            {/* Step 2 */}
            <div className="plush" style={{ background: 'white', padding: 24, flex: '1 1 280px', maxWidth: 320, position: 'relative' }}>
              <div style={{
                position: 'absolute', top: -16, left: -16, width: 40, height: 40, borderRadius: '50%',
                border: '3.5px solid var(--line)', background: 'var(--mint)', display: 'flex',
                alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 900,
                boxShadow: '0 2px 0 var(--line)'
              }}>2</div>
              <h3 style={{ fontSize: 18, fontWeight: 900, marginTop: 8 }}>Calibrate & Hold</h3>
              <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-2)', lineHeight: 1.5, marginTop: 8, margin: 0 }}>
                Select a pose and start holding. PhysioAlign tracks joint angles, playing dynamic audio/speech alerts to adjust your shoulders, hips, or legs.
              </p>
            </div>

            {/* Step 3 */}
            <div className="plush" style={{ background: 'white', padding: 24, flex: '1 1 280px', maxWidth: 320, position: 'relative' }}>
              <div style={{
                position: 'absolute', top: -16, left: -16, width: 40, height: 40, borderRadius: '50%',
                border: '3.5px solid var(--line)', background: 'var(--sky)', display: 'flex',
                alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 900,
                boxShadow: '0 2px 0 var(--line)'
              }}>3</div>
              <h3 style={{ fontSize: 18, fontWeight: 900, marginTop: 8 }}>Consult & Track</h3>
              <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-2)', lineHeight: 1.5, marginTop: 8, margin: 0 }}>
                Receive your Gemini-powered clinical report. Chat with AI instructors to adjust poses, and review your progress over time in interactive charts.
              </p>
            </div>
          </div>
        </section>

        {/* Interactive FAQ Section */}
        <section style={{ width: '100%', maxWidth: 760, display: 'flex', flexDirection: 'column', gap: 24 }}>
          <h2 style={{ fontSize: 28, fontWeight: 900, textAlign: 'center', color: 'var(--ink)', marginBottom: 8 }}>
            Frequently Asked Questions
          </h2>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {faqs.map((faq, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div
                  key={idx}
                  className="plush"
                  style={{
                    background: 'white',
                    overflow: 'hidden',
                    transition: 'all 200ms ease'
                  }}
                >
                  <button
                    onClick={() => toggleFaq(idx)}
                    style={{
                      width: '100%',
                      padding: '18px 24px',
                      background: 'none',
                      border: 0,
                      textAlign: 'left',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      color: 'var(--ink)',
                      fontFamily: 'inherit',
                      fontSize: '16px',
                      fontWeight: 800
                    }}
                  >
                    <span>{faq.q}</span>
                    <div style={{
                      width: 24, height: 24, borderRadius: 6, border: '2px solid var(--line)',
                      background: isOpen ? 'var(--butter)' : 'var(--cream)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      boxShadow: isOpen ? 'none' : '0 1.5px 0 var(--line)',
                      transform: isOpen ? 'translateY(1px)' : 'none'
                    }}>
                      {isOpen ? <Minus size={14} /> : <Plus size={14} />}
                    </div>
                  </button>
                  
                  {isOpen && (
                    <div style={{
                      padding: '0 24px 20px',
                      fontSize: '14px',
                      fontWeight: 700,
                      color: 'var(--ink-2)',
                      lineHeight: 1.6,
                      borderTop: '2px dashed var(--line)',
                      paddingTop: 16
                    }}>
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

      </main>

      {/* Footer */}
      <footer style={{
        padding: '24px 32px',
        borderTop: '3.5px solid var(--line)',
        background: 'var(--cream-2)',
        textAlign: 'center',
        fontWeight: 800,
        color: 'var(--ink-2)',
        fontSize: '14px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        flexWrap: 'wrap'
      }}>
        <span>Secured by</span>
        <span style={{
          background: 'white',
          padding: '4px 10px',
          borderRadius: 8,
          border: '2px solid var(--line)',
          fontWeight: 900,
          color: 'var(--ink)',
          fontSize: 12,
          boxShadow: 'var(--plush-tiny)'
        }}>Clerk</span>
        <span>| Created for interactive wellness and posture alignment.</span>
      </footer>

    </div>
  );
}
