import { store, useActiveSession, useUserData } from '../game/store';
import { TopBar, Doodle } from './primitives';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, ReferenceLine, CartesianGrid } from 'recharts';
import { Activity, Clock, ArrowRight } from 'lucide-react';
import { escapeHtml } from '../utils/sanitize';
import { HOLD_SCORE_THRESHOLD } from '../game/types';

export function DebriefScreen() {
  const activeSession = useActiveSession();
  const userData = useUserData();

  if (!activeSession) {
    return (
      <div className="screen dots-bg" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <h3>Loading Debrief Report...</h3>
      </div>
    );
  }

  // Prep chart data
  const chartData = activeSession.frameLogs.map((log, idx) => ({
    second: idx + 1,
    score: log.score,
  }));

  const handleReturn = () => {
    store.cancelActiveSession(); // Resets activeSession and sends user to dashboard
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  return (
    <div className="screen" style={{ background: 'var(--cream)' }}>
      <TopBar here={3} steps={['Dashboard', 'Pose Select', 'Evaluation', 'Debrief Grader']} userName={userData?.name} />

      <main style={{ maxWidth: 1024, margin: '28px auto', padding: '0 24px', display: 'flex', flexDirection: 'column', gap: 24 }} className="popin">
        
        {/* Grader Header Card */}
        <div className="plush" style={{ padding: '28px 24px', background: 'white', display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            {/* Cartoon Grade Badge */}
            <div className={`debrief-grade-badge ${activeSession.grade.toLowerCase()}`}>
              {activeSession.grade}
            </div>

            <div>
              <span className="chip butter" style={{ fontSize: 11 }}>OSCE Evaluation Complete</span>
              <h1 style={{ fontSize: 32, color: 'var(--ink)', marginTop: 6 }}>
                {activeSession.poseName} Grader Report
              </h1>
              <p style={{ fontSize: 14, color: 'var(--ink-soft)', fontWeight: 700, margin: '4px 0 0' }}>
                Evaluated on {new Date(activeSession.date).toLocaleString()}
              </p>
            </div>
          </div>

          {/* Quick Metrics columns */}
          <div style={{ display: 'flex', gap: 24 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center', color: 'var(--ink-soft)' }}>
                <Activity size={14} />
                <span style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase' }}>Avg Score</span>
              </div>
              <h2 style={{ fontSize: 24, fontWeight: 900, marginTop: 4 }}>{activeSession.averageScore}%</h2>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center', color: 'var(--ink-soft)' }}>
                <Clock size={14} />
                <span style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase' }}>Hold Time</span>
              </div>
              <h2 style={{ fontSize: 24, fontWeight: 900, marginTop: 4, color: 'var(--mint-deep)' }}>{activeSession.holdTimeSeconds}s</h2>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center', color: 'var(--ink-soft)' }}>
                <Clock size={14} />
                <span style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase' }}>Total Time</span>
              </div>
              <h2 style={{ fontSize: 24, fontWeight: 900, marginTop: 4 }}>{formatDuration(activeSession.durationSeconds)}</h2>
            </div>
          </div>
        </div>

        {/* Biomechanical Hold Graph Card (Recharts) */}
        <div className="plush" style={{ padding: '24px 28px', background: 'white' }}>
          <h3 style={{ fontSize: 18, fontWeight: 800, borderBottom: '2.5px solid var(--line)', paddingBottom: 10, marginBottom: 16 }}>
            Alignment Accuracy Over Time
          </h3>

          <div style={{ width: '100%', height: 200, fontFamily: 'inherit' }}>
            {chartData.length === 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--ink-soft)' }}>
                No tracking data logged to generate chart.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="scoreColor" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--mint-deep)" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="var(--mint-deep)" stopOpacity={0.1}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(43,30,22,0.1)" />
                  <XAxis dataKey="second" stroke="var(--ink-soft)" style={{ fontSize: 11, fontWeight: 700 }} tickFormatter={(s) => `${s}s`} />
                  <YAxis domain={[0, 100]} stroke="var(--ink-soft)" style={{ fontSize: 11, fontWeight: 700 }} />
                  <Tooltip
                    contentStyle={{
                      background: 'var(--paper)',
                      border: '2px solid var(--line)',
                      borderRadius: 'var(--r-sm)',
                      fontWeight: 700,
                      color: 'var(--ink)'
                    }}
                  />
                  <ReferenceLine y={HOLD_SCORE_THRESHOLD} stroke="var(--peach-deep)" strokeDasharray="5 5" label={{ value: `Hold Threshold (${HOLD_SCORE_THRESHOLD}%)`, position: 'top', fill: 'var(--ink-soft)', fontSize: 10, fontWeight: 800 }} />
                  <Area type="monotone" dataKey="score" stroke="var(--line)" strokeWidth={3} fillOpacity={1} fill="url(#scoreColor)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Attending Coach Critique Markdown card */}
        <div className="debrief-report paper">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, borderBottom: '2.5px solid var(--line)', paddingBottom: 10, marginBottom: 14 }}>
            <Doodle kind="star" size={24} color="var(--butter)" />
            <h3 style={{ fontSize: 20, fontWeight: 900 }}>AI Attending Grader Critique</h3>
          </div>

          {activeSession.aiCritique === 'Generating...' ? (
            <div style={{ padding: '32px 16px', textAlign: 'center' }}>
              <div className="breathe" style={{ display: 'inline-block', marginBottom: 12 }}>
                <Clock size={36} className="floaty" style={{ color: 'var(--peach-deep)' }} />
              </div>
              <p style={{ fontSize: 15, fontWeight: 800, color: 'var(--ink)' }}>
                Attending Coach is analyzing your joint coordinates...
              </p>
              <p style={{ fontSize: 12, color: 'var(--ink-soft)', fontWeight: 700, marginTop: 4 }}>
                Reviewing skeletal data and generating clinical feedback. This will take a few seconds.
              </p>
            </div>
          ) : (
            <div className="ai-critique-content" dangerouslySetInnerHTML={{
              __html: activeSession.aiCritique 
                // Convert simple markdown elements returned from Gemini into HTML tags:
                ? escapeHtml(activeSession.aiCritique)
                    .replace(/### (.*)/g, '<h3 style="font-size: 18px; font-weight: 800; color: var(--ink); margin: 18px 0 8px; border-bottom: 2px dashed var(--line); padding-bottom: 4px;">$1</h3>')
                    .replace(/\*\*(.*?)\*\*/g, '<strong style="color: var(--ink); font-weight: 800;">$1</strong>')
                    .replace(/\*(.*?)\*/g, '<em style="color: var(--ink-soft); font-style: italic;">$1</em>')
                    .replace(/- (.*)/g, '<li style="margin-left: 20px; margin-bottom: 4px; font-weight: 700; list-style-type: square;">$1</li>')
                    .replace(/\n\n/g, '<p style="margin-bottom: 12px; font-weight: 700;"></p>')
                : '<p>Grader report failed to compile.</p>'
            }} />
          )}
        </div>

        {/* Action button */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
          <button
            onClick={handleReturn}
            className="btn-plush primary popin"
            style={{ fontSize: 18, padding: '14px 44px', gap: 10 }}
          >
            Save Practice & Return <ArrowRight size={18} />
          </button>
        </div>

      </main>
    </div>
  );
}
