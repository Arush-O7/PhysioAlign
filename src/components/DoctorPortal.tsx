import { useState, useEffect } from 'react';
import { useUser } from '../utils/auth';
import { useUserData } from '../game/store';
import { CarePlanItem, SessionData, UserData } from '../game/types';
import { TopBar, useDialog } from './primitives';
import { useQueryParam } from '../game/router';
import { POSES } from '../data/poses';
import { 
  Users, 
  TrendingUp, 
  X, 
  Clock, 
  Sparkles,
  HeartPulse,
  Search,
  Download,
  Plus,
  Trash2
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  XAxis, 
  YAxis, 
  Tooltip, 
  Area, 
  CartesianGrid 
} from 'recharts';
import { generateDoctorInsight } from '../utils/geminiService';
import { sanitizeHtml } from '../utils/sanitize';
import { apiFetch } from '../utils/api';

interface PatientRecord extends UserData {
  id: string;
  email: string;
  sessionCount: number;
  avgScore: number;
}

// names are often saved with the title already included, so don't add a second one
function formatClinicianName(name?: string | null) {
  const trimmed = (name || '').trim();
  if (!trimmed) return 'Doctor';
  return /^dr\.?\s/i.test(trimmed) ? trimmed : `Dr. ${trimmed}`;
}

export function DoctorPortal() {
  const doctorData = useUserData();
  const { user } = useUser();

  const [patients, setPatients] = useState<PatientRecord[]>([]);
  // search, filter and the open patient live in the address (?q=, ?view=all, ?patient=)
  const [searchTerm, setSearchTerm] = useQueryParam('q');
  const [viewParam, setViewParam] = useQueryParam('view');
  const [patientParam, setPatientParam] = useQueryParam('patient');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [loading, setLoading] = useState(true);
  
  const [selectedPatient, setSelectedPatient] = useState<PatientRecord | null>(null);
  const closePatient = () => {
    setSelectedPatient(null);
    setPatientParam('');
  };
  const drawerRef = useDialog(!!selectedPatient, closePatient);
  const [patientHistory, setPatientHistory] = useState<SessionData[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [selectedSession, setSelectedSession] = useState<SessionData | null>(null);

  const [aiReport, setAiReport] = useState('');
  const [generatingAi, setGeneratingAi] = useState(false);

  const activeFilterTab: 'my' | 'all' = viewParam === 'all' ? 'all' : 'my';
  const setActiveFilterTab = (tab: 'my' | 'all') => setViewParam(tab === 'all' ? 'all' : '');

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

  // follow the address: open the patient it names (a link, a reload, forward), close on back
  useEffect(() => {
    if (!patientParam) {
      if (selectedPatient) setSelectedPatient(null);
      return;
    }
    if (selectedPatient?.id === patientParam) return;
    const match = patients.find((p) => p.id === patientParam);
    if (match) handleSelectPatient(match, { fromUrl: true });
  }, [patientParam, patients]);

  const handleSelectPatient = async (patient: PatientRecord, opts?: { fromUrl?: boolean }) => {
    setSelectedPatient(patient);
    if (!opts?.fromUrl) setPatientParam(patient.id, { push: true });
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
      setAiReport('<p>Error generating report. Please check API Key and try again.</p>');
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
    const rows = history.map(s => [
      new Date(s.date).toLocaleDateString(),
      s.poseName,
      s.durationSeconds,
      s.holdTimeSeconds,
      s.averageScore,
      s.grade
    ]);
    const csvContent = [headers, ...rows].map(e => e.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Rehab_Report_${patientName.replace(/\s+/g, '_')}.csv`);
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
        body: JSON.stringify({ carePlan: updatedPlan })
      });
      if (res.ok) {
        const updatedUser = { ...selectedPatient, carePlan: updatedPlan };
        setSelectedPatient(updatedUser);
        setPatients(prev => prev.map(p => p.id === selectedPatient.id ? updatedUser : p));
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

  const filteredPatients = patients.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
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
  const attentionRequired = patients.filter(p => p.sessionCount > 0 && p.avgScore < 70).length;

  return (
    <div className="screen dots-bg" style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: 'var(--cream)' }}>
      <TopBar here={0} steps={['PT Clinic Dashboard']} userName={doctorData?.name} showProfile={true} />

      <main id="main" tabIndex={-1} style={{ maxWidth: 1200, width: '100%', margin: '24px auto', padding: '0 24px', display: 'flex', flexDirection: 'column', gap: 24, flex: 1 }}>
        
        <div className="plush" style={{ padding: '24px 28px', background: 'var(--surface)', position: 'relative', overflow: 'hidden' }}>
          
          <h1 style={{ fontSize: 36, color: 'var(--ink)' }}>
            Welcome, {formatClinicianName(doctorData?.name || user?.firstName)}!
          </h1>
          <p style={{ fontSize: 16, color: 'var(--ink-2)', marginTop: 6, fontWeight: 700, maxWidth: 640 }}>
            PhysioAlign Clinician Portal. Monitor patient range-of-motion compliance, track biomechanical hold alignments, and generate AI assessment insights.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 20 }}>
          
          <div className="plush" style={{ padding: '20px 22px', background: 'var(--surface)', display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ background: 'var(--mint)', border: 'var(--bw) solid var(--line)', padding: 12, borderRadius: 12, display: 'flex', color: 'var(--on-accent)' }}>
              <Users size={24} />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 900, color: 'var(--ink-soft)' }}>Total patients</div>
              <div style={{ fontSize: 28, fontWeight: 900, color: 'var(--ink)', marginTop: 2 }}>{totalPatientsCount}</div>
            </div>
          </div>

          <div className="plush" style={{ padding: '20px 22px', background: 'var(--surface)', display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ background: 'var(--butter)', border: 'var(--bw) solid var(--line)', padding: 12, borderRadius: 12, display: 'flex', color: 'var(--on-accent)' }}>
              <Clock size={24} />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 900, color: 'var(--ink-soft)' }}>Average sessions</div>
              <div style={{ fontSize: 28, fontWeight: 900, color: 'var(--ink)', marginTop: 2 }}>{avgAdherence} workouts</div>
            </div>
          </div>

          <div className="plush" style={{ padding: '20px 22px', background: 'var(--surface)', display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ background: 'var(--peach)', border: 'var(--bw) solid var(--line)', padding: 12, borderRadius: 12, display: 'flex', color: 'var(--on-accent)' }}>
              <TrendingUp size={24} />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 900, color: 'var(--ink-soft)' }}>Average ROM accuracy</div>
              <div style={{ fontSize: 28, fontWeight: 900, color: 'var(--ink)', marginTop: 2 }}>{avgAccuracy}%</div>
            </div>
          </div>

          <div className="plush" style={{ padding: '20px 22px', background: 'var(--surface)', display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ background: attentionRequired > 0 ? 'var(--rose)' : 'var(--mint)', border: 'var(--bw) solid var(--line)', padding: 12, borderRadius: 12, display: 'flex', color: 'var(--on-accent)' }}>
              <HeartPulse size={24} aria-hidden="true" />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 900, color: 'var(--ink-soft)' }}>Needs attention</div>
              <div style={{ fontSize: 28, fontWeight: 900, color: attentionRequired > 0 ? 'var(--rose-text)' : 'var(--ink)', marginTop: 2 }}>{attentionRequired} patient(s)</div>
            </div>
          </div>
        </div>

        <div className="plush" style={{ background: 'var(--surface)', padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
              <h3 style={{ fontSize: 20, fontWeight: 900, color: 'var(--ink)', margin: 0 }}>Active Recovery Registrants</h3>
              {doctorData?.role === 'admin' && (
              <div style={{ display: 'flex', background: 'var(--cream)', border: 'var(--bw) solid var(--line)', borderRadius: 10, padding: 3 }}>
                <button
                  onClick={() => setActiveFilterTab('my')}
                  style={{
                    background: activeFilterTab === 'my' ? 'var(--mint)' : 'transparent',
                    border: activeFilterTab === 'my' ? 'var(--bw-thin) solid var(--line)' : '2px solid transparent',
                    borderRadius: 6,
                    padding: '4px 12px',
                    fontSize: 12,
                    fontWeight: 900,
                    color: activeFilterTab === 'my' ? 'var(--on-accent)' : 'var(--ink)',
                    cursor: 'pointer',
                    boxShadow: activeFilterTab === 'my' ? 'var(--sh-diag-1h)' : 'none',
                    transition: 'transform 100ms ease, box-shadow 100ms ease, background-color 100ms ease'
                  }}
                >
                  My Patients
                </button>
                <button
                  onClick={() => setActiveFilterTab('all')}
                  style={{
                    background: activeFilterTab === 'all' ? 'var(--mint)' : 'transparent',
                    border: activeFilterTab === 'all' ? 'var(--bw-thin) solid var(--line)' : '2px solid transparent',
                    borderRadius: 6,
                    padding: '4px 12px',
                    fontSize: 12,
                    fontWeight: 900,
                    color: activeFilterTab === 'all' ? 'var(--on-accent)' : 'var(--ink)',
                    cursor: 'pointer',
                    boxShadow: activeFilterTab === 'all' ? 'var(--sh-diag-1h)' : 'none',
                    transition: 'transform 100ms ease, box-shadow 100ms ease, background-color 100ms ease'
                  }}
                >
                  All Patients
                </button>
              </div>
              )}
            </div>
            <div style={{ position: 'relative', width: '100%', maxWidth: 320 }}>
              <Search 
                size={18} 
                style={{ 
                  position: 'absolute', 
                  left: 14, 
                  top: '50%', 
                  transform: 'translateY(-50%)', 
                  color: 'var(--ink-soft)',
                  strokeWidth: 3,
                  pointerEvents: 'none'
                }} 
              />
              <input
                type="search"
                name="patient-search"
                aria-label="Search patients"
                autoComplete="off"
                spellCheck={false}
                placeholder="Search patients…"
                onFocus={() => setIsSearchFocused(true)}
                onBlur={() => setIsSearchFocused(false)}
                style={{
                  width: '100%',
                  padding: '10px 14px 10px 42px',
                  border: 'var(--bw) solid var(--line)',
                  borderRadius: 12,
                  fontSize: 14,
                  fontFamily: 'inherit',
                  fontWeight: 800,
                  color: 'var(--ink)',
                  boxShadow: isSearchFocused ? 'var(--sh-diag-5)' : 'var(--sh-diag-3)',
                  background: 'var(--surface)',
                  transform: isSearchFocused ? 'translate(-2px, -2px)' : 'none',
                  transition: 'transform 100ms ease, box-shadow 100ms ease, background-color 100ms ease'
                }}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px 0', fontSize: 15, fontWeight: 800, color: 'var(--ink-soft)' }}>
              Loading registered patient data…
            </div>
          ) : filteredPatients.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', border: 'var(--bw-thick) dashed var(--line)', borderRadius: 16, fontSize: 14, fontWeight: 800, color: 'var(--ink-soft)' }}>
              No registered patients match your search.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20 }}>
              {filteredPatients.map(p => (
                <button
                  type="button"
                  key={p.id}
                  onClick={() => handleSelectPatient(p)}
                  className="tap card-btn"
                  style={{
                    padding: '20px 22px',
                    background: 'var(--surface)',
                    border: 'var(--bw) solid var(--line)',
                    borderRadius: 'var(--r-md)',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    boxShadow: 'var(--plush-sm)',
                    gap: 12
                  }}
                >
                  <div>
                    <h4 style={{ fontSize: 18, color: 'var(--ink)', margin: 0, fontWeight: 900 }}>{p.name}</h4>
                    <p style={{ fontSize: 12, color: 'var(--ink-soft)', margin: '4px 0 0', fontWeight: 800 }}>
                      Goal: {p.goal} • {p.age} y/o
                    </p>
                  </div>
                  
                  <div style={{ borderTop: 'var(--bw-thin) dashed var(--line)', paddingTop: 10, display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 800 }}>
                    <div>
                      <span style={{ color: 'var(--ink-soft)' }}>Sessions:</span>{' '}
                      <span style={{ color: 'var(--ink)' }}>{p.sessionCount}</span>
                    </div>
                    <div>
                      <span style={{ color: 'var(--ink-soft)' }}>ROM Rating:</span>{' '}
                      <span style={{ color: p.avgScore < 70 && p.sessionCount > 0 ? 'var(--rose-text)' : 'var(--mint-text)' }}>
                        {p.sessionCount > 0 ? `${p.avgScore}%` : 'N/A'}
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </main>

      {selectedPatient && (
        <div onClick={(e) => e.target === e.currentTarget && closePatient()} style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(43, 30, 22, 0.4)',
          zIndex: 100,
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'stretch',
          overscrollBehavior: 'contain'
        }}>
          <div
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="patient-drawer-title"
            tabIndex={-1}
            className="slide-in-right"
            style={{
            width: '100%',
            maxWidth: 680,
            background: 'var(--cream)',
            borderLeft: 'var(--bw) solid var(--line)',
            padding: '32px 28px',
            display: 'flex',
            flexDirection: 'column',
            gap: 24,
            overflowY: 'auto',
            overscrollBehavior: 'contain',
            boxShadow: 'var(--sh-drawer)'
          }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: 'var(--bw-thin) dashed var(--line)', paddingBottom: 16 }}>
              <div>
                <h2 id="patient-drawer-title" style={{ fontSize: 26, color: 'var(--ink)', margin: 0 }}>{selectedPatient.name}</h2>
                <p style={{ fontSize: 13, color: 'var(--ink-soft)', margin: '4px 0 0', fontWeight: 800 }}>
                  Access Profile: {selectedPatient.email} • {selectedPatient.age} years old
                </p>
              </div>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <button
                  onClick={() => handleExportCSV(selectedPatient.name, patientHistory)}
                  className="tap btn-plush ghost"
                  style={{
                    fontSize: '12px',
                    padding: '8px 12px',
                    borderRadius: 'var(--r-sm)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    boxShadow: 'var(--sh-diag-2)'
                  }}
                  title="Export workout logs to CSV"
                >
                  <Download size={14} /> Export CSV
                </button>
                <button 
                  onClick={closePatient}
                  aria-label="Close patient details"
                  style={{
                    border: 'var(--bw) solid var(--line)',
                    background: 'var(--surface)',
                    borderRadius: 12,
                    padding: 8,
                    cursor: 'pointer',
                    display: 'flex',
                    boxShadow: 'var(--sh-diag-2)'
                  }}
                >
                  <X size={20} aria-hidden="true" />
                </button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div className="plush" style={{ padding: '12px 16px', background: 'var(--surface)', fontSize: 13 }}>
                <span style={{ display: 'block', fontWeight: 900, color: 'var(--ink-soft)', fontSize: 10 }}>Experience level</span>
                <span style={{ fontWeight: 800, color: 'var(--ink)', textTransform: 'capitalize' }}>{selectedPatient.experience}</span>
              </div>
              <div className="plush" style={{ padding: '12px 16px', background: 'var(--surface)', fontSize: 13 }}>
                <span style={{ display: 'block', fontWeight: 900, color: 'var(--ink-soft)', fontSize: 10 }}>Wellness goal</span>
                <span style={{ fontWeight: 800, color: 'var(--ink)', textTransform: 'capitalize' }}>{selectedPatient.goal}</span>
              </div>
            </div>

            {(() => {
              const currentCarePlan = selectedPatient.carePlan ?? [];
              return (
                <div className="plush" style={{ background: 'var(--surface)', padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <h4 style={{ fontSize: 16, fontWeight: 900, color: 'var(--ink)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <HeartPulse size={18} style={{ color: 'var(--rose-text)' }} /> Rehabilitative Care Plan
                  </h4>
                  
                  {currentCarePlan.length === 0 ? (
                    <p style={{ fontSize: 13, color: 'var(--ink-soft)', margin: 0, fontWeight: 700 }}>
                      No active rehabilitation plan prescribed. Define one below.
                    </p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {currentCarePlan.map((planItem: any, index: number) => {
                        const poseConfig = POSES.find(p => p.id === planItem.poseId);
                        return (
                          <div 
                            key={index}
                            style={{ 
                              display: 'flex', 
                              alignItems: 'center', 
                              justifyContent: 'space-between', 
                              padding: '10px 14px', 
                              border: 'var(--bw) solid var(--line)', 
                              borderRadius: 8, 
                              background: 'var(--cream)' 
                            }}
                          >
                            <div>
                              <div style={{ fontSize: 14, fontWeight: 900, color: 'var(--ink)' }}>
                                {poseConfig?.name || planItem.poseId}
                              </div>
                              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-soft)', marginTop: 2 }}>
                                Target Hold: <span style={{ color: 'var(--peach-text)' }}>{planItem.targetHold}s</span> • Frequency: {planItem.frequency}
                              </div>
                            </div>
                            <button
                              disabled={isUpdatingCarePlan}
                              aria-label={`Remove ${poseConfig?.name || planItem.poseId} from the plan`}
                              onClick={() => {
                                const newPlan = currentCarePlan.filter((_, idx) => idx !== index);
                                handleSaveCarePlan(newPlan);
                              }}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: 'var(--rose-text)',
                                cursor: 'pointer',
                                display: 'flex',
                                padding: 4
                              }}
                              title="Remove prescription"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div 
                    style={{ 
                      marginTop: 8,
                      padding: '14px 16px',
                      border: 'var(--bw) dashed var(--line)',
                      borderRadius: 12,
                      background: 'var(--paper)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 12
                    }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 900, color: 'var(--ink)' }}>Prescribe Pose</div>
                    
                    <div className="layout-plan-row">
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <label htmlFor="plan-pose" style={{ fontSize: 12, fontWeight: 800, color: 'var(--ink-2)' }}>Pose</label>
                        <select
                          id="plan-pose"
                          value={prescribingPose}
                          onChange={(e) => setPrescribingPose(e.target.value)}
                          style={{
                            padding: '6px 8px',
                            border: 'var(--bw) solid var(--line)',
                            borderRadius: 6,
                            background: 'var(--surface)',
                            color: 'var(--ink)',
                            fontSize: 13,
                            fontWeight: 800,
                            fontFamily: 'inherit',
                          }}
                        >
                          <option value="">Choose a pose</option>
                          {POSES.map(p => (
                            <option key={p.id} value={p.id}>{p.name.split(' (')[0]}</option>
                          ))}
                        </select>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <label htmlFor="plan-hold" style={{ fontSize: 12, fontWeight: 800, color: 'var(--ink-2)' }}>Target hold</label>
                        <select
                          id="plan-hold"
                          value={prescribingHold}
                          onChange={(e) => setPrescribingHold(parseInt(e.target.value))}
                          style={{
                            padding: '6px 8px',
                            border: 'var(--bw) solid var(--line)',
                            borderRadius: 6,
                            background: 'var(--surface)',
                            color: 'var(--ink)',
                            fontSize: 13,
                            fontWeight: 800,
                            fontFamily: 'inherit',
                          }}
                        >
                          {[5, 10, 15, 20, 30, 45, 60].map(s => (
                            <option key={s} value={s}>{s}s</option>
                          ))}
                        </select>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <label htmlFor="plan-frequency" style={{ fontSize: 12, fontWeight: 800, color: 'var(--ink-2)' }}>Frequency</label>
                        <select
                          id="plan-frequency"
                          value={prescribingFreq}
                          onChange={(e) => setPrescribingFreq(e.target.value)}
                          style={{
                            padding: '6px 8px',
                            border: 'var(--bw) solid var(--line)',
                            borderRadius: 6,
                            background: 'var(--surface)',
                            color: 'var(--ink)',
                            fontSize: 13,
                            fontWeight: 800,
                            fontFamily: 'inherit',
                          }}
                        >
                          {['Daily', '3x a week', '2x a week', 'Weekly', 'Every other day'].map(f => (
                            <option key={f} value={f}>{f}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <button
                      disabled={isUpdatingCarePlan || !prescribingPose}
                      onClick={() => {
                        if (!prescribingPose) return;
                        if (currentCarePlan.some((item: any) => item.poseId === prescribingPose)) {
                          alert('This pose is already in the care plan!');
                          return;
                        }
                        const newPlan = [
                          ...currentCarePlan,
                          { poseId: prescribingPose, targetHold: prescribingHold, frequency: prescribingFreq }
                        ];
                        handleSaveCarePlan(newPlan);
                        setPrescribingPose('');
                      }}
                      className="tap btn-plush primary"
                      style={{
                        padding: '8px 12px',
                        fontSize: 12,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        margin: '4px 0 0',
                        boxShadow: 'var(--sh-diag-2)'
                      }}
                    >
                      <Plus size={14} /> Add Prescription
                    </button>
                  </div>
                </div>
              );
            })()}

            <div className="plush" style={{ background: 'var(--surface)', padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h4 style={{ fontSize: 16, fontWeight: 900, color: 'var(--ink)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Sparkles size={18} style={{ color: 'var(--peach-text)' }} /> Clinician Clinical Insight
                </h4>
                <button
                  onClick={handleGenerateAiInsight}
                  disabled={generatingAi || historyLoading || patientHistory.length === 0}
                  className="btn-plush primary"
                  style={{ fontSize: 12, padding: '8px 14px', borderRadius: 8, margin: 0 }}
                >
                  {generatingAi ? 'Analyzing Metrics…' : 'Generate AIPT Report'}
                </button>
              </div>

              {generatingAi ? (
                <div style={{ textAlign: 'center', padding: '24px 0', fontSize: 13, fontWeight: 800, color: 'var(--ink-soft)' }}>
                  Attending Grader AI is compiling range-of-motion metrics…
                </div>
              ) : aiReport ? (
                <div 
                  className="ai-critique-rendered"
                  style={{ 
                    fontSize: 14, 
                    lineHeight: 1.6, 
                    color: 'var(--ink-2)', 
                    maxHeight: 280, 
                    overflowY: 'auto', 
                    border: 'var(--bw) solid var(--line)', 
                    borderRadius: 12, 
                    padding: 16, 
                    background: 'var(--paper)'
                  }}
                  dangerouslySetInnerHTML={{ __html: aiReport }}
                />
              ) : (
                <p style={{ fontSize: 13, color: 'var(--ink-soft)', margin: 0, fontWeight: 700 }}>
                  Generate an AI-driven clinical physical therapy assessment summarizing this patient's joint angle holding trends.
                </p>
              )}
            </div>

            {patientHistory.length > 0 && selectedSession && (
              <div className="plush" style={{ background: 'var(--surface)', padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                <h4 style={{ fontSize: 16, fontWeight: 900, color: 'var(--ink)', margin: 0 }}>
                  Rehabilitation Performance Trend ({selectedSession.poseName})
                </h4>
                
                <div style={{ height: 180, width: '100%', fontSize: 11, fontWeight: 700 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={selectedSession.frameLogs.map((log, index) => ({
                        frame: index + 1,
                        score: log.score
                      }))}
                      margin={{ top: 5, right: 5, left: -25, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="color-mix(in srgb, var(--ink) 14%, transparent)" />
                      <XAxis dataKey="frame" />
                      <YAxis domain={[0, 100]} />
                      <Tooltip />
                      <Area 
                        type="monotone" 
                        dataKey="score" 
                        stroke="var(--line)" 
                        fill="var(--mint)" 
                        strokeWidth={3} 
                        fillOpacity={0.8}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 800 }}>
                  <span style={{ color: 'var(--ink-soft)' }}>Practice Date: {new Date(selectedSession.date).toLocaleDateString()}</span>
                  <span style={{ color: 'var(--ink)' }}>Hold Efficiency: {selectedSession.holdTimeSeconds}s / {selectedSession.durationSeconds}s</span>
                </div>
              </div>
            )}

            <div className="plush" style={{ background: 'var(--surface)', padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <h4 style={{ fontSize: 16, fontWeight: 900, color: 'var(--ink)', margin: 0 }}>Workout Practice Records</h4>
              
              {historyLoading ? (
                <div style={{ textAlign: 'center', padding: '20px 0', fontSize: 13, fontWeight: 800, color: 'var(--ink-soft)' }}>
                  Loading sessions…
                </div>
              ) : patientHistory.length === 0 ? (
                <p style={{ fontSize: 13, color: 'var(--ink-soft)', margin: 0, fontWeight: 700 }}>
                  This patient has not completed any training sessions yet.
                </p>
              ) : (
                <div style={{ maxHeight: 220, overflowY: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
                    <thead>
                      <tr style={{ borderBottom: 'var(--bw) solid var(--line)', color: 'var(--ink-soft)', fontWeight: 900 }}>
                        <th style={{ padding: '8px 4px' }}>Date</th>
                        <th style={{ padding: '8px 4px' }}>Pose</th>
                        <th style={{ padding: '8px 4px' }}>Duration</th>
                        <th style={{ padding: '8px 4px' }}>Hold</th>
                        <th style={{ padding: '8px 4px' }}>Score</th>
                        <th style={{ padding: '8px 4px' }}>Grade</th>
                      </tr>
                    </thead>
                    <tbody>
                      {patientHistory.map(s => (
                        <tr 
                          key={s.id} 
                          onClick={() => setSelectedSession(s)}
                          style={{ 
                            borderBottom: 'var(--bw-thin) dashed var(--line)', 
                            fontWeight: 800, 
                            cursor: 'pointer',
                            background: selectedSession?.id === s.id ? 'var(--cream)' : 'transparent'
                          }}
                        >
                          <td style={{ padding: '10px 4px' }}>{new Date(s.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</td>
                          <td style={{ padding: '10px 4px', color: 'var(--ink)' }}>{s.poseName}</td>
                          <td style={{ padding: '10px 4px' }}>{s.durationSeconds}s</td>
                          <td style={{ padding: '10px 4px' }}>{s.holdTimeSeconds}s</td>
                          <td style={{ padding: '10px 4px' }}>{s.averageScore}%</td>
                          <td style={{ padding: '10px 4px' }}>
                            <span style={{
                              background: s.grade === 'A' ? 'var(--mint)' : s.grade === 'B' ? 'var(--butter)' : 'var(--rose)',
                              color: 'var(--on-accent)',
                              padding: '2px 8px',
                              borderRadius: 6,
                              border: 'var(--bw) solid var(--line)',
                              fontSize: 11
                            }}>
                              {s.grade}
                            </span>
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
      )}
    </div>
  );
}
