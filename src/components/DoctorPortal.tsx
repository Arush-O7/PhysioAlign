import { useState, useEffect } from 'react';
import { useUser } from '../utils/auth';
import { useUserData } from '../game/store';
import { CarePlanItem, SessionData, UserData } from '../game/types';
import { TopBar } from './primitives';
import { POSES } from '../data/poses';
import { AlertTriangle, Download, Plus, Search, Sparkles, Trash2, Users, X } from 'lucide-react';
import { ResponsiveContainer, AreaChart, XAxis, YAxis, Tooltip, Area, CartesianGrid } from 'recharts';
import { generateDoctorInsight } from '../utils/geminiService';
import { sanitizeHtml } from '../utils/sanitize';
import { apiFetch } from '../utils/api';

interface PatientRecord extends UserData {
  id: string;
  email: string;
  sessionCount: number;
  avgScore: number;
}

const FREQUENCIES = ['Daily', '3× per week', 'Weekly'];

export function DoctorPortal() {
  const doctorData = useUserData();
  const { user } = useUser();

  const [patients, setPatients] = useState<PatientRecord[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  const [selectedPatient, setSelectedPatient] = useState<PatientRecord | null>(null);
  const [patientHistory, setPatientHistory] = useState<SessionData[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [selectedSession, setSelectedSession] = useState<SessionData | null>(null);

  const [aiReport, setAiReport] = useState('');
  const [generatingAi, setGeneratingAi] = useState(false);

  const [activeFilterTab, setActiveFilterTab] = useState<'my' | 'all'>('my');

  const [prescribingPose, setPrescribingPose] = useState<string>('');
  const [prescribingHold, setPrescribingHold] = useState<number>(15);
  const [prescribingFreq, setPrescribingFreq] = useState<string>('Daily');
  const [isUpdatingCarePlan, setIsUpdatingCarePlan] = useState(false);

  const fetchPatients = async () => {
    try {
      setLoading(true);
      const res = await apiFetch('/api/doctor/patients');
      if (res.ok) {
        const data = await res.json();
        setPatients(data);
      }
    } catch (e) {
      console.error('Failed to load doctor patients:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPatients();
  }, []);

  const handleSelectPatient = async (patient: PatientRecord) => {
    setSelectedPatient(patient);
    setPatientHistory([]);
    setSelectedSession(null);
    setAiReport('');
    try {
      setHistoryLoading(true);
      const res = await apiFetch(`/api/doctor/patients/${patient.id}/sessions`);
      if (res.ok) {
        const data = await res.json();
        setPatientHistory(data);
        if (data.length > 0) {
          setSelectedSession(data[0]);
        }
      }
    } catch (e) {
      console.error('Failed to load patient history:', e);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleGenerateAiInsight = async () => {
    if (!selectedPatient) return;
    setGeneratingAi(true);
    setAiReport('');
    try {
      const insight = await generateDoctorInsight(selectedPatient);
      // gemini sometimes wraps the html in a code fence even when told not to
      setAiReport(sanitizeHtml(insight.replace(/^\s*```(?:html)?\s*|\s*```\s*$/g, '')));
    } catch (e) {
      console.error(e);
      setAiReport('<p>Could not generate the report. Please try again.</p>');
    } finally {
      setGeneratingAi(false);
    }
  };

  const handleExportCSV = (patientName: string, history: SessionData[]) => {
    if (!history || history.length === 0) {
      alert('No session history available to export.');
      return;
    }
    const headers = ['Date', 'Pose Name', 'Duration (s)', 'Hold Time (s)', 'Average Score (%)', 'Grade'];
    const rows = history.map((s) => [
      new Date(s.date).toLocaleDateString(),
      s.poseName,
      s.durationSeconds,
      s.holdTimeSeconds,
      s.averageScore,
      s.grade,
    ]);
    const csvContent = [headers, ...rows].map((e) => e.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `physioalign_${patientName.replace(/\s+/g, '_').toLowerCase()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSaveCarePlan = async (updatedPlan: CarePlanItem[]) => {
    if (!selectedPatient) return;
    try {
      setIsUpdatingCarePlan(true);
      const res = await apiFetch(`/api/doctor/patients/${selectedPatient.id}/care-plan`, {
        method: 'PUT',
        body: JSON.stringify({ carePlan: updatedPlan }),
      });
      if (res.ok) {
        const updatedUser = { ...selectedPatient, carePlan: updatedPlan };
        setSelectedPatient(updatedUser);
        setPatients((prev) => prev.map((p) => (p.id === selectedPatient.id ? updatedUser : p)));
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || 'Failed to save care plan');
      }
    } catch (e) {
      console.error(e);
      alert('Error saving care plan');
    } finally {
      setIsUpdatingCarePlan(false);
    }
  };

  const filteredPatients = patients.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.email || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesTab = activeFilterTab === 'all' || p.doctorId === user?.id;
    return matchesSearch && matchesTab;
  });

  const totalPatientsCount = patients.length;
  const avgAdherence = totalPatientsCount > 0
    ? Math.round(patients.reduce((sum, p) => sum + p.sessionCount, 0) / totalPatientsCount)
    : 0;
  const avgAccuracy = totalPatientsCount > 0
    ? Math.round(patients.reduce((sum, p) => sum + p.avgScore, 0) / totalPatientsCount)
    : 0;
  const attentionRequired = patients.filter((p) => p.sessionCount > 0 && p.avgScore < 70).length;

  const currentCarePlan = selectedPatient?.carePlan ?? [];
  const isAdmin = doctorData?.role === 'admin';

  return (
    <div className="screen">
      <TopBar here={0} steps={['Clinician portal']} userName={doctorData?.name} />

      <div className="page">
        <div className="container container--wide stack stack--lg">
          <div className="page-header">
            <div className="page-header__text">
              <h1>Clinician portal</h1>
              <p className="page-subtitle">
                Review your patients' sessions, prescribe poses and keep an eye on who needs attention.
              </p>
            </div>
          </div>

          <div className="grid grid--4">
            <div className="stat">
              <div>
                <div className="stat__label">Patients</div>
                <div className="stat__value">{totalPatientsCount}</div>
              </div>
              <span className="stat__icon">
                <Users size={17} />
              </span>
            </div>
            <div className="stat">
              <div>
                <div className="stat__label">Avg sessions each</div>
                <div className="stat__value">{avgAdherence}</div>
              </div>
            </div>
            <div className="stat">
              <div>
                <div className="stat__label">Avg accuracy</div>
                <div className="stat__value">{avgAccuracy}%</div>
              </div>
            </div>
            <div className="stat">
              <div>
                <div className="stat__label">Needs attention</div>
                <div className="stat__value" style={{ color: attentionRequired ? 'var(--danger-600)' : undefined }}>
                  {attentionRequired}
                </div>
                <div className="stat__meta">scoring under 70%</div>
              </div>
              <span className={`stat__icon ${attentionRequired ? 'stat__icon--danger' : 'stat__icon--neutral'}`}>
                <AlertTriangle size={17} />
              </span>
            </div>
          </div>

          <div className="card">
            <div className="card__header">
              <span className="card__title">Patients</span>
              <div className="row row--sm">
                {isAdmin && (
                  <div className="tabs">
                    <button className={`tab${activeFilterTab === 'my' ? ' is-active' : ''}`} onClick={() => setActiveFilterTab('my')}>
                      Mine
                    </button>
                    <button className={`tab${activeFilterTab === 'all' ? ' is-active' : ''}`} onClick={() => setActiveFilterTab('all')}>
                      All
                    </button>
                  </div>
                )}
                <div className="input-group" style={{ width: 240 }}>
                  <span className="input-group__icon">
                    <Search size={15} />
                  </span>
                  <input
                    className="input"
                    placeholder="Search name or email"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {loading ? (
              <div className="card__body stack stack--sm">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="skeleton" style={{ height: 44 }} />
                ))}
              </div>
            ) : filteredPatients.length === 0 ? (
              <div className="empty">
                <span className="empty__icon">
                  <Users size={18} />
                </span>
                {patients.length === 0
                  ? 'No patients assigned to you yet. An administrator assigns patients to clinicians.'
                  : 'No patients match your search.'}
              </div>
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Patient</th>
                      <th>Goal</th>
                      <th>Sessions</th>
                      <th>Avg score</th>
                      <th>Care plan</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPatients.map((patient) => (
                      <tr key={patient.id} onClick={() => handleSelectPatient(patient)} style={{ cursor: 'pointer' }}>
                        <td>
                          <div className="row row--sm">
                            <span className="avatar">
                              <span className="avatar-initials">{patient.name?.[0]?.toUpperCase() || '?'}</span>
                            </span>
                            <div>
                              <div className="semibold">{patient.name}</div>
                              <div className="text-xs muted">{patient.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="secondary" style={{ textTransform: 'capitalize' }}>
                          {patient.goal || '—'}
                        </td>
                        <td className="numeric">{patient.sessionCount}</td>
                        <td>
                          <span
                            className={`badge ${
                              patient.sessionCount === 0 ? '' : patient.avgScore >= 80 ? 'badge--success' : patient.avgScore >= 70 ? 'badge--warn' : 'badge--danger'
                            }`}
                          >
                            {patient.sessionCount === 0 ? 'No data' : `${patient.avgScore}%`}
                          </span>
                        </td>
                        <td className="numeric muted">{patient.carePlan?.length || 0} pose(s)</td>
                        <td style={{ textAlign: 'right' }}>
                          <span className="btn btn--secondary btn--sm">Open</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {selectedPatient && (
        <div className="overlay" onClick={() => setSelectedPatient(null)}>
          <aside className="drawer" onClick={(e) => e.stopPropagation()} aria-label={`${selectedPatient.name} details`}>
            <div className="drawer__header">
              <div className="row">
                <span className="avatar avatar--lg">
                  <span className="avatar-initials">{selectedPatient.name?.[0]?.toUpperCase() || '?'}</span>
                </span>
                <div>
                  <h2>{selectedPatient.name}</h2>
                  <p className="text-sm muted">
                    {selectedPatient.email}
                    {selectedPatient.age ? ` · ${selectedPatient.age} years` : ''}
                    {selectedPatient.experience ? ` · ${selectedPatient.experience}` : ''}
                  </p>
                </div>
              </div>
              <div className="row row--sm">
                <button className="btn btn--secondary btn--sm" onClick={() => handleExportCSV(selectedPatient.name, patientHistory)}>
                  <Download size={14} />
                  Export CSV
                </button>
                <button className="btn btn--icon" onClick={() => setSelectedPatient(null)} aria-label="Close">
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="drawer__body">
              <div className="card">
                <div className="card__header">
                  <span className="card__title">Care plan</span>
                  {isUpdatingCarePlan && <span className="spinner" />}
                </div>
                <div className="card__body stack stack--sm">
                  {currentCarePlan.length === 0 ? (
                    <p className="text-sm muted">No poses prescribed yet.</p>
                  ) : (
                    currentCarePlan.map((item, index) => (
                      <div key={index} className="list-row" style={{ cursor: 'default' }}>
                        <div className="list-row__main">
                          <div className="list-row__title">{item.poseName || item.poseId}</div>
                          <div className="list-row__meta">
                            Hold {item.targetHold}s{item.frequency ? ` · ${item.frequency}` : ''}
                          </div>
                        </div>
                        <button
                          className="btn btn--icon is-danger"
                          disabled={isUpdatingCarePlan}
                          onClick={() => handleSaveCarePlan(currentCarePlan.filter((_, idx) => idx !== index))}
                          aria-label="Remove prescription"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    ))
                  )}

                  <div className="divider" style={{ margin: '4px 0' }} />

                  <div className="row row--sm row--wrap" style={{ alignItems: 'flex-end' }}>
                    <div className="field" style={{ flex: 2, minWidth: 180 }}>
                      <label className="label text-xs" htmlFor="prescribe-pose">
                        Pose
                      </label>
                      <select
                        id="prescribe-pose"
                        className="select"
                        value={prescribingPose}
                        onChange={(e) => setPrescribingPose(e.target.value)}
                      >
                        <option value="">Select a pose</option>
                        {POSES.map((pose) => (
                          <option key={pose.id} value={pose.id}>
                            {pose.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="field" style={{ width: 110 }}>
                      <label className="label text-xs" htmlFor="prescribe-hold">
                        Hold
                      </label>
                      <select
                        id="prescribe-hold"
                        className="select"
                        value={prescribingHold}
                        onChange={(e) => setPrescribingHold(Number(e.target.value))}
                      >
                        {[15, 30, 45, 60].map((seconds) => (
                          <option key={seconds} value={seconds}>
                            {seconds}s
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="field" style={{ width: 140 }}>
                      <label className="label text-xs" htmlFor="prescribe-freq">
                        Frequency
                      </label>
                      <select
                        id="prescribe-freq"
                        className="select"
                        value={prescribingFreq}
                        onChange={(e) => setPrescribingFreq(e.target.value)}
                      >
                        {FREQUENCIES.map((freq) => (
                          <option key={freq} value={freq}>
                            {freq}
                          </option>
                        ))}
                      </select>
                    </div>
                    <button
                      className="btn btn--secondary"
                      disabled={!prescribingPose || isUpdatingCarePlan}
                      onClick={() => {
                        if (!prescribingPose) return;
                        if (currentCarePlan.some((item) => item.poseId === prescribingPose)) {
                          alert('That pose is already in the care plan.');
                          return;
                        }
                        const pose = POSES.find((p) => p.id === prescribingPose);
                        handleSaveCarePlan([
                          ...currentCarePlan,
                          {
                            poseId: prescribingPose,
                            poseName: pose?.name,
                            targetHold: prescribingHold,
                            frequency: prescribingFreq,
                          },
                        ]);
                        setPrescribingPose('');
                      }}
                    >
                      <Plus size={15} />
                      Add
                    </button>
                  </div>
                </div>
              </div>

              <div className="card">
                <div className="card__header">
                  <span className="card__title">
                    <Sparkles size={15} className="muted" />
                    Clinical summary
                  </span>
                  <button className="btn btn--secondary btn--sm" onClick={handleGenerateAiInsight} disabled={generatingAi}>
                    {generatingAi && <span className="spinner" />}
                    {aiReport ? 'Regenerate' : 'Generate'}
                  </button>
                </div>
                <div className="card__body">
                  {generatingAi ? (
                    <div className="stack stack--sm">
                      <div className="skeleton" style={{ height: 12, width: '90%' }} />
                      <div className="skeleton" style={{ height: 12, width: '80%' }} />
                      <div className="skeleton" style={{ height: 12, width: '86%' }} />
                    </div>
                  ) : aiReport ? (
                    <div className="prose" dangerouslySetInnerHTML={{ __html: aiReport }} />
                  ) : (
                    <p className="text-sm muted">
                      Generate a short written summary of this patient's recent sessions and a suggested progression.
                    </p>
                  )}
                </div>
              </div>

              <div className="card">
                <div className="card__header">
                  <span className="card__title">Session history</span>
                  <span className="text-xs muted">{patientHistory.length} total</span>
                </div>

                {historyLoading ? (
                  <div className="card__body stack stack--sm">
                    <div className="skeleton" style={{ height: 40 }} />
                    <div className="skeleton" style={{ height: 40 }} />
                  </div>
                ) : patientHistory.length === 0 ? (
                  <div className="empty">This patient hasn't completed a session yet.</div>
                ) : (
                  <>
                    {selectedSession && selectedSession.frameLogs.length > 0 && (
                      <div className="card__body" style={{ paddingBottom: 0 }}>
                        <div className="row spread" style={{ marginBottom: 8 }}>
                          <span className="overline">{selectedSession.poseName} · score per second</span>
                          <span className="text-xs muted numeric">
                            {new Date(selectedSession.date).toLocaleDateString()}
                          </span>
                        </div>
                        <div style={{ height: 180 }}>
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart
                              data={selectedSession.frameLogs.map((log, index) => ({ frame: index + 1, score: log.score }))}
                              margin={{ top: 12, right: 12, left: -12, bottom: 0 }}
                            >
                              <defs>
                                <linearGradient id="patientScore" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%" stopColor="var(--brand-500)" stopOpacity={0.25} />
                                  <stop offset="100%" stopColor="var(--brand-500)" stopOpacity={0.02} />
                                </linearGradient>
                              </defs>
                              <CartesianGrid stroke="var(--border)" vertical={false} />
                              <XAxis dataKey="frame" tickLine={false} axisLine={{ stroke: 'var(--border)' }} />
                              <YAxis domain={[0, 105]} ticks={[0, 25, 50, 75, 100]} tickLine={false} axisLine={false} width={40} />
                              <Tooltip formatter={(value: number) => [`${value}%`, 'Score']} />
                              <Area type="monotone" dataKey="score" stroke="var(--brand-600)" strokeWidth={2} fill="url(#patientScore)" />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    )}

                    <div className="table-wrap">
                      <table className="table">
                        <thead>
                          <tr>
                            <th>Date</th>
                            <th>Pose</th>
                            <th>Hold</th>
                            <th>Score</th>
                            <th>Grade</th>
                          </tr>
                        </thead>
                        <tbody>
                          {patientHistory.map((session) => (
                            <tr
                              key={session.id}
                              onClick={() => setSelectedSession(session)}
                              className={selectedSession?.id === session.id ? 'is-self' : ''}
                              style={{ cursor: 'pointer' }}
                            >
                              <td className="numeric muted">
                                {new Date(session.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                              </td>
                              <td className="semibold">{session.poseName}</td>
                              <td className="numeric">{session.holdTimeSeconds}s</td>
                              <td className="numeric">{session.averageScore}%</td>
                              <td>
                                <span
                                  className={`badge ${
                                    session.grade === 'A' ? 'badge--success' : session.grade === 'F' ? 'badge--danger' : 'badge--outline'
                                  }`}
                                >
                                  {session.grade}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
