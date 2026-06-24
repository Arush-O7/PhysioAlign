import { useEffect, useRef, useState, useCallback } from 'react';
import { store, useActiveSession, useActivePoseId, useUserData } from '../game/store';
import { getPoseById, evaluatePose, PoseFeedback } from '../data/poses';
import { AIEngine } from './AIEngine';
import { playAudioCue, speakFeedback } from '../utils/audioFeedback';
import { Keypoint } from '../utils/angleCalculations';
import { TopBar } from './primitives';
import { useAuth } from '../utils/auth';
import { Play, Pause, Square, AlertCircle, CheckCircle, HeartPulse } from 'lucide-react';

export function SessionScreen() {
  const activePoseId = useActivePoseId();
  const activeSession = useActiveSession();
  const userData = useUserData();
  const pose = getPoseById(activePoseId || '');
  const { userId } = useAuth();

  let prescribedTargetHold: number | null = null;
  if (userData?.care_plan && activePoseId) {
    try {
      const plan = JSON.parse(userData.care_plan);
      const match = plan.find((item: any) => item.poseId === activePoseId);
      if (match) {
        prescribedTargetHold = match.targetHold;
      }
    } catch (e) {
      console.error('Failed to parse care plan in session screen', e);
    }
  }

  const [sessionActive, setSessionActive] = useState(false);
  const [feedback, setFeedback] = useState<PoseFeedback | null>(null);
  const [isCalibrating, setIsCalibrating] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [customTargetHold, setCustomTargetHold] = useState<number>(() => {
    return prescribedTargetHold || 30;
  });
  const [targetReached, setTargetReached] = useState(false);
  
  const timerRef = useRef<any>(null);
  const lastAudioFeedbackTimeRef = useRef(0);
  const lastStateSeverityRef = useRef<'success' | 'warning' | 'error'>('error');
  const poseDataRef = useRef<{ angles: Record<string, number>; feedbackMessage: string; score: number } | null>(null);

  useEffect(() => {
    if (pose) {
      store.startSession(pose.id, pose.name);
      setTargetReached(false);
      
      // Calculate prescribed hold for the new pose
      let newPrescribed: number | null = null;
      if (userData?.care_plan) {
        try {
          const plan = JSON.parse(userData.care_plan);
          const match = plan.find((item: any) => item.poseId === pose.id);
          if (match) {
            newPrescribed = match.targetHold;
          }
        } catch (e) {
          console.error('Failed to parse care plan in session screen', e);
        }
      }
      setCustomTargetHold(newPrescribed || 30);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [activePoseId, userData?.care_plan]);

  useEffect(() => {
    if (sessionActive) {
      timerRef.current = setInterval(() => {
        const currentData = poseDataRef.current;
        if (currentData) {
          store.updateSessionLogs({
            timestamp: Date.now(),
            score: currentData.score,
            angles: currentData.angles,
            feedbackMessage: currentData.feedbackMessage,
          });


          const score = currentData.score;
          if (score >= 75 && lastStateSeverityRef.current !== 'success') {
            playAudioCue('success');
            lastStateSeverityRef.current = 'success';
          } else if (score < 75 && score >= 50 && lastStateSeverityRef.current !== 'warning') {
            playAudioCue('info');
            lastStateSeverityRef.current = 'warning';
          } else if (score < 50 && lastStateSeverityRef.current !== 'error') {
            playAudioCue('warning');
            lastStateSeverityRef.current = 'error';
          }
        } else {
          store.updateSessionLogs({
            timestamp: Date.now(),
            score: 0,
            angles: {},
            feedbackMessage: 'Step back into camera frame',
          });
        }
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [sessionActive]);

  useEffect(() => {
    if (activeSession && activeSession.holdTimeSeconds >= customTargetHold && !targetReached && sessionActive) {
      setTargetReached(true);
      playAudioCue('success');
      speakFeedback('Target reached! Great job! You can now exit or keep holding.');
    }
  }, [activeSession?.holdTimeSeconds, customTargetHold, targetReached, sessionActive]);

  useEffect(() => {
    if (activeSession && activeSession.holdTimeSeconds < customTargetHold) {
      setTargetReached(false);
    }
  }, [activeSession?.holdTimeSeconds, customTargetHold]);

  const handlePoseDetected = useCallback((data: { keypoints: Keypoint[]; angles: Record<string, number> }) => {
    if (!pose) return;

    const missingJoints: string[] = [];
    const indexMap: Record<string, number> = {
      LEFT_SHOULDER: 11, RIGHT_SHOULDER: 12,
      LEFT_ELBOW: 13, RIGHT_ELBOW: 14,
      LEFT_WRIST: 15, RIGHT_WRIST: 16,
      LEFT_HIP: 23, RIGHT_HIP: 24,
      LEFT_KNEE: 25, RIGHT_KNEE: 26,
      LEFT_ANKLE: 27, RIGHT_ANKLE: 28
    };

    pose.visibilityRequirements.forEach(joint => {
      const idx = indexMap[joint];
      if (data.keypoints[idx] && data.keypoints[idx].visibility < 0.55) {
        missingJoints.push(joint.toLowerCase().replace('_', ' '));
      }
    });

    if (missingJoints.length > 2) {
      setIsCalibrating(true);
      const calibrateFeedback: PoseFeedback = {
        score: 0,
        corrections: ['Step back so your full body is visible in the frame.'],
        feedback: 'Positioning: Step back.',
        severity: 'error',
        jointDeviations: {}
      };
      setFeedback(calibrateFeedback);
      poseDataRef.current = { angles: {}, feedbackMessage: 'Body out of frame', score: 0 };
      return;
    }

    setIsCalibrating(false);


    const evaluation = evaluatePose(pose.id, data.angles);
    setFeedback(evaluation);


    poseDataRef.current = {
      angles: data.angles,
      feedbackMessage: evaluation.corrections[0] || 'Perfect Alignment',
      score: evaluation.score
    };

    // Voice feedback (throttled to 5s)
    const now = Date.now();
    if (now - lastAudioFeedbackTimeRef.current > 5000) {
      if (evaluation.severity !== 'success') {
        const errorCue = evaluation.corrections[0];
        if (errorCue) {
          speakFeedback(errorCue.split(':')[1] || errorCue);
          lastAudioFeedbackTimeRef.current = now;
        }
      } else {

        if (Math.random() > 0.8) {
          speakFeedback('Great form, keep holding.');
          lastAudioFeedbackTimeRef.current = now;
        }
      }
    }
  }, [pose]);

  const handleStart = () => {
    setSessionActive(true);
    speakFeedback('Starting practice. Align your joints.');
  };

  const handlePause = () => {
    setSessionActive(false);
    speakFeedback('Session paused.');
  };

  const handleFinish = async () => {
    setSessionActive(false);
    if (!activeSession || !userId) return;

    setIsAnalyzing(true);
    speakFeedback('Saving posture metrics. Preparing report.');

    try {
      await store.completeActiveSession(userId);
    } catch (e) {
      console.error('[SessionScreen] Failed to complete session:', e);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleCancel = () => {
    if (window.confirm('Are you sure you want to exit? Session progress will be lost.')) {
      store.cancelActiveSession();
    }
  };

  if (!pose || !activeSession) {
    return (
      <div className="screen dots-bg" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <h3>Initializing Session...</h3>
      </div>
    );
  }


  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="screen" style={{ background: 'var(--cream)', minHeight: '100vh' }}>
      <TopBar here={2} steps={['Dashboard', 'Pose Select', 'Evaluation']} showProfile={false} />

      {targetReached && (
        <div style={{
          position: 'fixed',
          top: '24px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 1000,
          background: 'var(--mint)',
          border: '3px solid var(--line)',
          borderRadius: 'var(--r-md)',
          boxShadow: 'var(--plush-sm)',
          padding: '16px 24px',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          animation: 'pop-in 400ms cubic-bezier(.5,1.7,.4,1) forwards',
        }}>
          <CheckCircle size={24} color="var(--ink)" />
          <div>
            <h4 style={{ fontWeight: 900, fontSize: 16, color: 'var(--ink)' }}>Target Hold Reached!</h4>
            <p style={{ fontWeight: 700, fontSize: 13, margin: '2px 0 0', color: 'var(--ink-2)', opacity: 0.9 }}>
              Excellent alignment. You held the posture for {customTargetHold} seconds.
            </p>
          </div>
          <button 
            onClick={() => setTargetReached(false)} 
            className="btn-plush ghost tap" 
            style={{ padding: '6px 12px', fontSize: 12, border: '2px solid var(--line)', boxShadow: 'none' }}
          >
            Dismiss
          </button>
        </div>
      )}

      {isAnalyzing && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
          background: 'rgba(255, 250, 240, 0.95)', zIndex: 100,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          textAlign: 'center', padding: 24
        }}>
          <div className="breathe" style={{ marginBottom: 16 }}>
            <HeartPulse size={64} className="floaty" color="var(--peach-deep)" />
          </div>
          <h2 style={{ fontSize: 26, fontWeight: 900 }}>AI Attending Grader analyzing...</h2>
          <p style={{ fontSize: 15, color: 'var(--ink-2)', fontWeight: 700, marginTop: 6, maxWidth: 360 }}>
            Analyzing joint deviations, hold consistency, and assembling your anatomical critique report.
          </p>
        </div>
      )}

      <main style={{ maxWidth: 1200, margin: '24px auto', padding: '0 24px', display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 24 }}>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <AIEngine onPoseDetected={handlePoseDetected} poseImage={pose.image} poseName={pose.name} />

          <div className="plush" style={{ padding: 18, background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ display: 'flex', gap: 12 }}>
              {!sessionActive ? (
                <button onClick={handleStart} className="btn-plush mint" style={{ padding: '8px 16px', fontSize: 15 }}>
                  <Play size={16} /> Start Hold
                </button>
              ) : (
                <button onClick={handlePause} className="btn-plush ghost" style={{ padding: '8px 16px', fontSize: 15 }}>
                  <Pause size={16} /> Pause
                </button>
              )}
              
              <button
                onClick={handleFinish}
                disabled={activeSession.frameLogs.length === 0}
                className="btn-plush primary"
                style={{ padding: '8px 16px', fontSize: 15 }}
              >
                <Square size={14} /> Finish & Grade
              </button>
            </div>

            <button onClick={handleCancel} className="btn-plush ghost" style={{ padding: '8px 16px', fontSize: 14, color: 'var(--rose-deep)' }}>
              Exit Practice
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          
          <div className="plush-lg" style={{ padding: 20, background: 'white', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, textAlign: 'center' }}>
            <div style={{ borderRight: '3.5px dashed var(--line)' }}>
              <span style={{ fontSize: 11, fontWeight: 900, color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Practice Duration
              </span>
              <h2 style={{ fontSize: 36, fontWeight: 900, color: 'var(--ink)', marginTop: 4 }}>
                {formatTime(activeSession.durationSeconds)}
              </h2>
            </div>
            <div>
              <span style={{ fontSize: 11, fontWeight: 900, color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Correct Posture Hold
              </span>
              <h2 style={{ fontSize: 36, fontWeight: 900, color: 'var(--mint-deep)', marginTop: 4, marginBottom: 4 }}>
                {activeSession.holdTimeSeconds}s
              </h2>
              <div style={{ fontSize: 11, fontWeight: 800, color: prescribedTargetHold && prescribedTargetHold === customTargetHold ? 'var(--rose-deep)' : 'var(--peach-deep)' }}>
                Goal: {customTargetHold}s {prescribedTargetHold && prescribedTargetHold === customTargetHold ? '(Prescribed)' : '(Custom)'}
              </div>
            </div>
          </div>

          {!sessionActive && activeSession.durationSeconds === 0 && (
            <div className="plush popin" style={{ padding: 20, background: 'var(--cream-2)' }}>
              <h3 style={{ fontSize: 15, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8, color: 'var(--ink)' }}>
                🎯 Target Hold Goal
              </h3>
              <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-soft)', marginBottom: 14 }}>
                Adjust how long you want to hold this posture. A voice cue will trigger when you reach this target.
              </p>
              
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
                <button 
                  onClick={() => setCustomTargetHold(prev => Math.max(5, prev - 5))}
                  className="btn-plush ghost tap"
                  style={{ padding: 0, width: 40, height: 40, borderRadius: 10, fontSize: 18 }}
                  type="button"
                >
                  -
                </button>
                <div style={{ textAlign: 'center', flex: 1 }}>
                  <span style={{ fontSize: 24, fontWeight: 900, color: 'var(--ink)' }}>{customTargetHold}</span>
                  <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--ink-soft)', marginLeft: 4 }}>seconds</span>
                </div>
                <button 
                  onClick={() => setCustomTargetHold(prev => Math.min(300, prev + 5))}
                  className="btn-plush ghost tap"
                  style={{ padding: 0, width: 40, height: 40, borderRadius: 10, fontSize: 18 }}
                  type="button"
                >
                  +
                </button>
              </div>

              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {[10, 20, 30, 45, 60, 90].map(seconds => (
                  <button
                    key={seconds}
                    onClick={() => setCustomTargetHold(seconds)}
                    className={`chip tap ${customTargetHold === seconds ? 'peach' : ''}`}
                    style={{ border: '2px solid var(--line)', padding: '4px 10px', fontSize: 12, fontWeight: 800 }}
                    type="button"
                  >
                    {seconds}s
                  </button>
                ))}
              </div>
            </div>
          )}


          <div className="plush" style={{
            padding: 20,
            background: isCalibrating ? 'var(--cream-2)' : feedback?.severity === 'error' ? 'var(--rose)' : feedback?.severity === 'warning' ? 'var(--butter)' : 'var(--mint)',
            minHeight: 120,
            transition: 'background 300ms ease'
          }}>
            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ marginTop: 2 }}>
                {feedback?.severity === 'success' ? (
                  <CheckCircle size={22} color="var(--ink)" />
                ) : (
                  <AlertCircle size={22} color="var(--ink)" />
                )}
              </div>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  {isCalibrating ? 'Calibrating Position' : feedback?.severity === 'success' ? 'Perfect Alignment!' : 'Adjustment Cues'}
                </h3>
                <p style={{ fontSize: 14, fontWeight: 700, marginTop: 4, lineHeight: 1.4 }}>
                  {isCalibrating 
                    ? 'Align your full body in the webcam frame. Move back until your knees, hips, and shoulders are in view.' 
                    : feedback?.feedback}
                </p>
                {feedback && feedback.corrections.length > 0 && (
                  <ul style={{ margin: '8px 0 0', paddingLeft: 16, fontSize: 13, fontWeight: 700 }}>
                    {feedback.corrections.map((corr, idx) => (
                      <li key={idx} style={{ marginBottom: 4 }}>{corr}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>


          <div className="plush" style={{ padding: 20, background: 'white' }}>
            <div style={{ display: 'flex', gap: 16, alignItems: 'center', borderBottom: '2.5px solid var(--line)', paddingBottom: 12, marginBottom: 12 }}>
              <div style={{
                width: 70,
                height: 70,
                flexShrink: 0,
                borderRadius: 8,
                border: '2px solid var(--line)',
                background: 'var(--cream)',
                overflow: 'hidden',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <img
                  src={pose.image}
                  alt={pose.name}
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                />
              </div>
              <div>
                <h3 style={{ fontSize: 17, fontWeight: 900, color: 'var(--ink)' }}>{pose.name} Reference</h3>
                <p style={{ fontSize: 12, color: 'var(--ink-soft)', fontWeight: 800, textTransform: 'uppercase', marginTop: 2 }}>
                  Difficulty: {pose.difficulty}
                </p>
              </div>
            </div>

            <div>
              <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                How to Perform
              </span>
              <ol style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: 13, color: 'var(--ink)', fontWeight: 700, lineHeight: 1.4 }}>
                {pose.instructions.map((inst, idx) => (
                  <li key={idx} style={{ marginBottom: 6 }}>{inst}</li>
                ))}
              </ol>
            </div>
          </div>


          <div className="plush" style={{ padding: 20, background: 'white' }}>
            <h3 style={{ fontSize: 16, fontWeight: 800, borderBottom: '2.5px solid var(--line)', paddingBottom: 8, marginBottom: 12 }}>
              Joint Angle Calibrator
            </h3>

            {isCalibrating ? (
              <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--ink-soft)' }}>
                <p style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>Awaiting pose tracking data...</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {Object.entries(pose.targetAngles).map(([jointKey, target]) => {
                  const dev = feedback?.jointDeviations[jointKey];
                  const currentAngle = dev ? dev.current : 0;
                  const isError = dev ? dev.error : true;


                  const progressPct = Math.min(100, Math.max(0, (currentAngle / 180) * 100));

                  return (
                    <div key={jointKey}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 800, marginBottom: 4 }}>
                        <span style={{ color: 'var(--ink)' }}>{target.label}</span>
                        <span style={{ color: isError ? 'var(--rose-deep)' : 'var(--mint-deep)' }}>
                          {currentAngle}° <span style={{ fontSize: 11, color: 'var(--ink-soft)' }}>(Ideal: {target.min}°-{target.max}°)</span>
                        </span>
                      </div>
                      

                      <div style={{
                        height: 12,
                        background: 'var(--cream)',
                        border: '2px solid var(--line)',
                        borderRadius: 'var(--r-pill)',
                        overflow: 'hidden',
                        position: 'relative'
                      }}>
                        <div style={{
                          width: `${progressPct}%`,
                          height: '100%',
                          background: isError ? 'var(--rose-deep)' : 'var(--mint-deep)',
                          transition: 'width 200ms ease, background-color 200ms'
                        }} />


                        <div style={{
                          position: 'absolute',
                          left: `${(target.min / 180) * 100}%`,
                          width: `${((target.max - target.min) / 180) * 100}%`,
                          height: '100%',
                          top: 0,
                          borderLeft: '1.5px dashed var(--line)',
                          borderRight: '1.5px dashed var(--line)',
                          background: 'rgba(0, 0, 0, 0.05)',
                          pointerEvents: 'none'
                        }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
