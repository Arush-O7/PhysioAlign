import { useEffect, useRef, useState, useCallback } from 'react';
import { store, useActiveSession, useActivePoseId, useUserData } from '../game/store';
import { getPoseById, evaluatePose, PoseFeedback } from '../data/poses';
import { AIEngine } from './AIEngine';
import { playAudioCue, speakFeedback } from '../utils/audioFeedback';
import { Keypoint } from '../utils/angleCalculations';
import { TopBar } from './primitives';
import { AngleSmoother, Stabilizer } from '../utils/smoothing';
import { HOLD_SCORE_THRESHOLD } from '../game/types';
import { useAuth } from '../utils/auth';
import { AlertTriangle, CheckCircle2, Info, Pause, Play, Square, Target, X } from 'lucide-react';

const HOLD_OPTIONS = [15, 30, 45, 60];

export function SessionScreen() {
  const activePoseId = useActivePoseId();
  const activeSession = useActiveSession();
  const userData = useUserData();
  const pose = getPoseById(activePoseId || '');
  const { userId } = useAuth();

  const prescribedTargetHold =
    userData?.carePlan?.find((item) => item.poseId === activePoseId)?.targetHold ?? null;

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
  // see scripts/bench-smoothing.ts for how much these cut feedback flicker
  const smootherRef = useRef(new AngleSmoother());
  const stabilizerRef = useRef(
    new Stabilizer<PoseFeedback>((f) => `${f.severity}|${(f.corrections[0] || '').split(':')[0]}`, 250)
  );
  const poseDataRef = useRef<{ angles: Record<string, number>; feedbackMessage: string; score: number } | null>(null);

  useEffect(() => {
    if (pose) {
      store.startSession(pose.id, pose.name);
      setTargetReached(false);

      setCustomTargetHold(prescribedTargetHold || 30);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [activePoseId, prescribedTargetHold]);

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
          if (score >= HOLD_SCORE_THRESHOLD && lastStateSeverityRef.current !== 'success') {
            playAudioCue('success');
            lastStateSeverityRef.current = 'success';
          } else if (score < HOLD_SCORE_THRESHOLD && score >= 50 && lastStateSeverityRef.current !== 'warning') {
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

  const handlePoseDetected = useCallback(
    (data: { keypoints: Keypoint[]; angles: Record<string, number> }) => {
      if (!pose) return;

      const missingJoints: string[] = [];
      const indexMap: Record<string, number> = {
        LEFT_SHOULDER: 11, RIGHT_SHOULDER: 12,
        LEFT_ELBOW: 13, RIGHT_ELBOW: 14,
        LEFT_WRIST: 15, RIGHT_WRIST: 16,
        LEFT_HIP: 23, RIGHT_HIP: 24,
        LEFT_KNEE: 25, RIGHT_KNEE: 26,
        LEFT_ANKLE: 27, RIGHT_ANKLE: 28,
      };

      pose.visibilityRequirements.forEach((joint) => {
        const idx = indexMap[joint];
        if (data.keypoints[idx] && data.keypoints[idx].visibility < 0.55) {
          missingJoints.push(joint.toLowerCase().replace('_', ' '));
        }
      });

      if (missingJoints.length > 2) {
        setIsCalibrating(true);
        smootherRef.current.reset();
        stabilizerRef.current.reset();
        const calibrateFeedback: PoseFeedback = {
          score: 0,
          corrections: ['Step back so your full body is visible in the frame.'],
          feedback: 'Step back from the camera',
          severity: 'error',
          jointDeviations: {},
        };
        setFeedback(calibrateFeedback);
        poseDataRef.current = { angles: {}, feedbackMessage: 'Body out of frame', score: 0 };
        return;
      }

      setIsCalibrating(false);

      // score the smoothed angles, and only change the on-screen/spoken cue once
      // the new one has held for 250ms so it doesn't flicker at range boundaries
      const now = performance.now();
      const angles = smootherRef.current.smooth(data.angles, now);
      const live = evaluatePose(pose.id, angles);
      const evaluation = stabilizerRef.current.update(live, now);
      setFeedback(evaluation);

      poseDataRef.current = {
        angles,
        feedbackMessage: live.corrections[0] || 'Perfect Alignment',
        score: live.score,
      };

      // Voice feedback (throttled to 5s)
      if (now - lastAudioFeedbackTimeRef.current > 5000) {
        if (evaluation.severity !== 'success') {
          const errorCue = evaluation.corrections[0];
          if (errorCue) {
            // "Label: Adjust slightly. Current: 95°, ideal: ..." -> "Adjust slightly."
            const spoken = errorCue.slice(errorCue.indexOf(':') + 1).split(/\s*Current:/)[0].trim();
            speakFeedback(spoken || errorCue);
            lastAudioFeedbackTimeRef.current = now;
          }
        } else {
          if (Math.random() > 0.8) {
            speakFeedback('Great form, keep holding.');
            lastAudioFeedbackTimeRef.current = now;
          }
        }
      }
    },
    [pose]
  );

  const handlePoseLost = useCallback(() => {
    // otherwise the timer keeps logging the last good frame and hold time keeps going up
    poseDataRef.current = null;
    smootherRef.current.reset();
    stabilizerRef.current.reset();
    setIsCalibrating(true);
  }, []);

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
      await store.completeActiveSession();
    } catch (e) {
      console.error('[SessionScreen] Failed to complete session:', e);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleCancel = () => {
    if (window.confirm('Exit this session? Progress will be lost.')) {
      store.cancelActiveSession();
    }
  };

  if (!pose || !activeSession) {
    return (
      <div className="screen screen--centered">
        <div className="row row--sm muted">
          <span className="spinner" />
          Preparing session
        </div>
      </div>
    );
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const severity = isCalibrating ? 'neutral' : feedback?.severity ?? 'neutral';
  const feedbackIcon =
    severity === 'success' ? <CheckCircle2 size={17} /> : severity === 'error' ? <AlertTriangle size={17} /> : <Info size={17} />;
  const holdProgress = Math.min(100, Math.round((activeSession.holdTimeSeconds / customTargetHold) * 100));

  return (
    <div className="screen">
      <TopBar here={2} steps={['Dashboard', 'Pose', 'Session']} showProfile={false} />

      {targetReached && (
        <div className="session-toast pop-in" role="status">
          <span className="icon-tile" style={{ background: 'var(--success-100)', color: 'var(--success-700)' }}>
            <Target size={17} />
          </span>
          <div>
            <div className="text-sm semibold">Target hold reached</div>
            <div className="text-xs muted">
              {customTargetHold}s in good form. Keep going or finish to see your report.
            </div>
          </div>
          <button className="btn btn--icon" onClick={() => setTargetReached(false)} aria-label="Dismiss">
            <X size={15} />
          </button>
        </div>
      )}

      <div className="page">
        <div className="container container--wide">
          <div className="page-header">
            <div className="page-header__text">
              <div className="row row--sm" style={{ marginBottom: 4 }}>
                <h1 style={{ fontSize: 22 }}>{pose.name}</h1>
                <span className="badge">{pose.difficulty}</span>
                {prescribedTargetHold && <span className="badge badge--brand">Prescribed</span>}
              </div>
              <p className="page-subtitle">{pose.description}</p>
            </div>
            <button className="btn btn--ghost btn--sm" onClick={handleCancel}>
              Exit session
            </button>
          </div>

          <div className="grid grid--main-aside">
            <div className="stack">
              <AIEngine
                onPoseDetected={handlePoseDetected}
                onPoseLost={handlePoseLost}
                poseImage={pose.image}
                poseName={pose.name}
              />

              <div className="card">
                <div className="card__body row spread row--wrap" style={{ gap: 12 }}>
                  <div className="row row--sm">
                    {sessionActive ? (
                      <button className="btn btn--secondary" onClick={handlePause}>
                        <Pause size={15} />
                        Pause
                      </button>
                    ) : (
                      <button className="btn btn--primary" onClick={handleStart} disabled={isAnalyzing}>
                        <Play size={15} />
                        {activeSession.durationSeconds > 0 ? 'Resume' : 'Start session'}
                      </button>
                    )}
                    <button
                      className="btn btn--secondary"
                      onClick={handleFinish}
                      disabled={isAnalyzing || activeSession.durationSeconds === 0}
                    >
                      {isAnalyzing ? <span className="spinner" /> : <Square size={14} />}
                      Finish &amp; save
                    </button>
                  </div>

                  <div className="row" style={{ gap: 24 }}>
                    <div>
                      <div className="stat__label">Elapsed</div>
                      <div className="timer-value">{formatTime(activeSession.durationSeconds)}</div>
                    </div>
                    <div>
                      <div className="stat__label">Good form</div>
                      <div className="timer-value" style={{ color: 'var(--brand-700)' }}>
                        {activeSession.holdTimeSeconds}s
                      </div>
                    </div>
                    <div style={{ minWidth: 150 }}>
                      <div className="row spread" style={{ marginBottom: 6 }}>
                        <span className="stat__label" style={{ margin: 0 }}>
                          Target {customTargetHold}s
                        </span>
                        <span className="text-xs muted numeric">{holdProgress}%</span>
                      </div>
                      <div className="progress">
                        <div className="progress__bar" style={{ width: `${holdProgress}%` }} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="stack">
              <div className={`feedback feedback--${severity}`}>
                <span className="feedback__icon">{feedbackIcon}</span>
                <div>
                  <div className="feedback__title">
                    {isCalibrating ? 'Finding your position' : feedback?.feedback ?? 'Waiting for tracking'}
                  </div>
                  <div className="feedback__body">
                    {isCalibrating
                      ? 'Step back until your whole body is inside the frame.'
                      : feedback?.corrections[0] ??
                        (feedback?.severity === 'success'
                          ? 'Every tracked joint is inside its target range.'
                          : 'Waiting for the camera to pick you up.')}
                  </div>
                </div>
                {!isCalibrating && feedback && (
                  <span className="badge" style={{ marginLeft: 'auto' }}>
                    {feedback.score}%
                  </span>
                )}
              </div>

              <div className="card">
                <div className="card__header">
                  <span className="card__title">Joint angles</span>
                  <span className="text-xs muted">live</span>
                </div>
                <div className="card__body stack">
                  {Object.entries(pose.targetAngles).map(([joint, target]) => {
                    const deviation = feedback?.jointDeviations[joint];
                    const current = deviation?.current;
                    const hasError = deviation?.error ?? false;
                    const toPercent = (angle: number) => Math.max(0, Math.min(100, (angle / 180) * 100));
                    return (
                      <div className="meter" key={joint}>
                        <div className="meter__head">
                          <span className="secondary">{target!.label}</span>
                          <span className={`meter__value${hasError ? ' is-error' : ''}`}>
                            {current === undefined ? '—' : `${current}°`}
                            <span className="muted text-xs" style={{ fontWeight: 400, marginLeft: 6 }}>
                              {target!.min}–{target!.max}°
                            </span>
                          </span>
                        </div>
                        <div className="meter__track">
                          <div
                            className="meter__zone"
                            style={{
                              left: `${toPercent(target!.min)}%`,
                              width: `${toPercent(target!.max) - toPercent(target!.min)}%`,
                            }}
                          />
                          {current !== undefined && (
                            <div
                              className={`meter__needle${hasError ? ' is-error' : ''}`}
                              style={{ left: `${toPercent(current)}%` }}
                            />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="card">
                <div className="card__header">
                  <span className="card__title">Hold target</span>
                </div>
                <div className="card__body stack stack--sm">
                  <div className="segmented segmented--4" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
                    {HOLD_OPTIONS.map((seconds) => (
                      <button
                        key={seconds}
                        className={`segmented__item${customTargetHold === seconds ? ' is-selected' : ''}`}
                        onClick={() => setCustomTargetHold(seconds)}
                      >
                        {seconds}s
                      </button>
                    ))}
                  </div>
                  <p className="hint">
                    {prescribedTargetHold
                      ? `Your clinician prescribed ${prescribedTargetHold}s for this pose.`
                      : 'A voice cue plays when you reach the target in good form.'}
                  </p>
                </div>
              </div>

              <div className="card">
                <div className="card__header">
                  <span className="card__title">How to perform</span>
                </div>
                <div className="card__body">
                  <ol className="stack stack--sm text-sm secondary" style={{ margin: 0, paddingLeft: 18 }}>
                    {pose.instructions.map((step, idx) => (
                      <li key={idx}>{step}</li>
                    ))}
                  </ol>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
