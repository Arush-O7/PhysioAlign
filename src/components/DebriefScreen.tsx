import { store, useActiveSession, useUserData } from '../game/store';
import { TopBar } from './primitives';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, ReferenceLine, CartesianGrid } from 'recharts';
import { AlertCircle, ArrowRight, Clock, Sparkles } from 'lucide-react';
import { escapeHtml } from '../utils/sanitize';
import { HOLD_SCORE_THRESHOLD } from '../game/types';

const formatDuration = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return mins ? `${mins}m ${secs}s` : `${secs}s`;
};

const renderCritique = (markdown: string) =>
  escapeHtml(markdown)
    .replace(/### (.*)/g, '<h3>$1</h3>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/^- (.*)$/gm, '<li>$1</li>')
    .replace(/(<li>[\s\S]*?<\/li>)(?!\s*<li>)/g, '<ul>$1</ul>')
    .replace(/\n{2,}/g, '</p><p>');

export function DebriefScreen() {
  const activeSession = useActiveSession();
  const userData = useUserData();

  if (!activeSession) {
    return (
      <div className="screen screen--centered">
        <div className="row row--sm muted">
          <span className="spinner" />
          Loading session report
        </div>
      </div>
    );
  }

  const chartData = activeSession.frameLogs.map((log, idx) => ({ second: idx + 1, score: log.score }));
  const status = activeSession.critiqueStatus;
  const isWaiting = status === 'saving' || status === 'pending';
  const hasFailed = status === 'unsaved' || status === 'failed';
  const holdShare = activeSession.durationSeconds
    ? Math.round((activeSession.holdTimeSeconds / activeSession.durationSeconds) * 100)
    : 0;

  return (
    <div className="screen">
      <TopBar here={3} steps={['Dashboard', 'Pose', 'Session', 'Report']} userName={userData?.name} showProfile={false} />

      <div className="page">
        <div className="container stack stack--lg fade-in">
          <div className="card card--raised">
            <div className="card__body row spread row--wrap" style={{ gap: 24 }}>
              <div className="row" style={{ gap: 16 }}>
                <div className={`grade grade--${activeSession.grade.toLowerCase()}`}>{activeSession.grade}</div>
                <div>
                  <h1 style={{ fontSize: 22 }}>{activeSession.poseName}</h1>
                  <p className="text-sm muted" style={{ marginTop: 4 }}>
                    {new Date(activeSession.date).toLocaleString(undefined, {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </p>
                </div>
              </div>

              <div className="row" style={{ gap: 32 }}>
                <div>
                  <div className="stat__label">Average score</div>
                  <div className="stat__value">{activeSession.averageScore}%</div>
                </div>
                <div>
                  <div className="stat__label">Hold time</div>
                  <div className="stat__value">
                    {activeSession.holdTimeSeconds}s <span className="text-sm muted numeric">({holdShare}%)</span>
                  </div>
                </div>
                <div>
                  <div className="stat__label">Session length</div>
                  <div className="stat__value">{formatDuration(activeSession.durationSeconds)}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid--main-aside">
            <div className="card">
              <div className="card__header">
                <span className="card__title">Accuracy over time</span>
                <span className="badge badge--outline">Hold threshold {HOLD_SCORE_THRESHOLD}%</span>
              </div>
              <div className="card__body">
                {chartData.length === 0 ? (
                  <div className="empty">No tracking data was recorded for this session.</div>
                ) : (
                  <div style={{ height: 240 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData} margin={{ top: 12, right: 12, left: -12, bottom: 0 }}>
                        <defs>
                          <linearGradient id="scoreFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="var(--brand-500)" stopOpacity={0.25} />
                            <stop offset="100%" stopColor="var(--brand-500)" stopOpacity={0.02} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid stroke="var(--border)" vertical={false} />
                        <XAxis
                          dataKey="second"
                          tickLine={false}
                          axisLine={{ stroke: 'var(--border)' }}
                          tickFormatter={(s) => `${s}s`}
                        />
                        <YAxis domain={[0, 105]} ticks={[0, 25, 50, 75, 100]} tickLine={false} axisLine={false} width={40} />
                        <Tooltip
                          cursor={{ stroke: 'var(--gray-300)' }}
                          formatter={(value: number) => [`${value}%`, 'Score']}
                          labelFormatter={(label) => `Second ${label}`}
                        />
                        <ReferenceLine
                          y={HOLD_SCORE_THRESHOLD}
                          stroke="var(--gray-400)"
                          strokeDasharray="4 4"
                          label={{ value: 'Hold threshold', position: 'insideTopRight', fill: 'var(--text-muted)', fontSize: 11 }}
                        />
                        <Area
                          type="monotone"
                          dataKey="score"
                          stroke="var(--brand-600)"
                          strokeWidth={2}
                          fill="url(#scoreFill)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </div>

            <div className="card">
              <div className="card__header">
                <span className="card__title">
                  <Sparkles size={15} className="muted" />
                  Coach report
                </span>
                {isWaiting && <span className="badge badge--brand">Generating</span>}
              </div>
              <div className="card__body">
                {isWaiting ? (
                  <div className="stack stack--sm">
                    <div className="row row--sm text-sm secondary">
                      <Clock size={15} />
                      {status === 'saving' ? 'Saving your session…' : 'Writing your report…'}
                    </div>
                    <div className="skeleton" style={{ height: 12, width: '92%' }} />
                    <div className="skeleton" style={{ height: 12, width: '78%' }} />
                    <div className="skeleton" style={{ height: 12, width: '85%' }} />
                    <p className="text-xs muted" style={{ marginTop: 4 }}>
                      You can leave this page — the report will be waiting in your history.
                    </p>
                  </div>
                ) : hasFailed ? (
                  <div className="stack stack--sm">
                    <div className="alert alert--warn">
                      <AlertCircle size={16} className="alert__icon" />
                      <span>
                        {status === 'unsaved'
                          ? "This session couldn't be saved."
                          : "The report couldn't be generated, but your session is saved."}
                      </span>
                    </div>
                    <button
                      className="btn btn--secondary btn--sm"
                      style={{ alignSelf: 'flex-start' }}
                      onClick={() =>
                        status === 'unsaved' ? store.completeActiveSession() : store.retryCritique(activeSession.id)
                      }
                    >
                      Try again
                    </button>
                  </div>
                ) : (
                  <div
                    className="prose"
                    dangerouslySetInnerHTML={{
                      __html: activeSession.aiCritique
                        ? `<p>${renderCritique(activeSession.aiCritique)}</p>`
                        : '<p>No report for this session.</p>',
                    }}
                  />
                )}
              </div>
            </div>
          </div>

          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button className="btn btn--primary btn--lg" onClick={() => store.cancelActiveSession()}>
              Back to dashboard
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
