import { useState, useEffect } from 'react';
import { useUser } from '../utils/auth';
import { useUserData } from '../game/store';
import { SessionData, UserData } from '../game/types';
import { TopBar, Doodle } from './primitives';
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

interface PatientRecord extends UserData {
  clerk_id: string;
  email: string;
  sessionCount: number;
  avgScore: number;
}

export function DoctorPortal() {
  const doctorData = useUserData();
  const { user } = useUser();

  const [patients, setPatients] = useState<PatientRecord[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
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
      const res = await fetch('/api/doctor/patients');
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
      const res = await fetch(`/api/doctor/patients/${patient.clerk_id}/history`);
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
      const insight = await generateDoctorInsight(selectedPatient, patientHistory);
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

  const handleSaveCarePlan = async (updatedPlan: any[]) => {
    if (!selectedPatient) return;
    try {
      setIsUpdatingCarePlan(true);
      const res = await fetch(`/api/doctor/patients/${selectedPatient.clerk_id}/care-plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ carePlan: updatedPlan })
      });
      if (res.ok) {
        const updatedUser = { ...selectedPatient, care_plan: JSON.stringify(updatedPlan) };
        setSelectedPatient(updatedUser);
        setPatients(prev => prev.map(p => p.clerk_id === selectedPatient.clerk_id ? updatedUser : p));
      } else {
        alert('Failed to save care plan');
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
    const matchesTab = activeFilterTab === 'all' || p.doctor_id === user?.id;
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

      <main style={{ maxWidth: 1200, width: '100%', margin: '24px auto', padding: '0 24px', display: 'flex', flexDirection: 'column', gap: 24, flex: 1 }}>
        
        <div className="plush" style={{ padding: '24px 28px', background: 'white', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', right: 20, top: -10, opacity: 0.15 }} className="wobble">
            <Doodle kind="flower" size={120} color="var(--mint)" />
          </div>
          
          <h1 style={{ fontSize: 36, color: 'var(--ink)' }}>
            Welcome, Dr. {doctorData?.name || user?.firstName || 'Practitioner'}!
          </h1>
          <p style={{ fontSize: 16, color: 'var(--ink-2)', marginTop: 6, fontWeight: 700, maxWidth: 640 }}>
            PhysioAlign Clinician Portal. Monitor patient range-of-motion compliance, track biomechanical hold alignments, and generate AI assessment insights.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 20 }}>
          
          <div className="plush" style={{ padding: '20px 22px', background: 'white', display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ background: 'var(--mint)', border: '2.5px solid var(--line)', padding: 12, borderRadius: 12, display: 'flex', color: 'var(--ink)' }}>
              <Users size={24} />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 900, color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Patients</div>
              <div style={{ fontSize: 28, fontWeight: 900, color: 'var(--ink)', marginTop: 2 }}>{totalPatientsCount}</div>
            </div>
          </div>

          <div className="plush" style={{ padding: '20px 22px', background: 'white', display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ background: 'var(--butter)', border: '2.5px solid var(--line)', padding: 12, borderRadius: 12, display: 'flex', color: 'var(--ink)' }}>
              <Clock size={24} />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 900, color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Avg. Sessions</div>
              <div style={{ fontSize: 28, fontWeight: 900, color: 'var(--ink)', marginTop: 2 }}>{avgAdherence} workouts</div>
            </div>
          </div>

          <div className="plush" style={{ padding: '20px 22px', background: 'white', display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ background: 'var(--peach)', border: '2.5px solid var(--line)', padding: 12, borderRadius: 12, display: 'flex', color: 'var(--ink)' }}>
              <TrendingUp size={24} />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 900, color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Avg. ROM Accuracy</div>
              <div style={{ fontSize: 28, fontWeight: 900, color: 'var(--ink)', marginTop: 2 }}>{avgAccuracy}%</div>
            </div>
          </div>

          <div className="plush" style={{ padding: '20px 22px', background: 'white', display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ background: attentionRequired > 0 ? '#FFEAE6' : '#EAFCEF', border: '2.5px solid var(--line)', padding: 12, borderRadius: 12, display: 'flex', color: 'var(--ink)' }}>
              <HeartPulse size={24} style={{ color: attentionRequired > 0 ? '#FF6B4A' : '#10B981' }} />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 900, color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Attention Alerts</div>
              <div style={{ fontSize: 28, fontWeight: 900, color: attentionRequired > 0 ? '#FF6B4A' : 'var(--ink)', marginTop: 2 }}>{attentionRequired} patient(s)</div>
            </div>
          </div>
        </div>

        <div className="plush" style={{ background: 'white', padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
              <h3 style={{ fontSize: 20, fontWeight: 900, color: 'var(--ink)', margin: 0 }}>Active Recovery Registrants</h3>
              <div style={{ display: 'flex', background: 'var(--cream)', border: '2.5px solid var(--line)', borderRadius: 10, padding: 3 }}>
                <button
                  onClick={() => setActiveFilterTab('my')}
                  style={{
                    background: activeFilterTab === 'my' ? 'var(--mint)' : 'transparent',
                    border: activeFilterTab === 'my' ? '2px solid var(--line)' : '2px solid transparent',
                    borderRadius: 6,
                    padding: '4px 12px',
                    fontSize: 12,
                    fontWeight: 900,
                    color: 'var(--ink)',
                    cursor: 'pointer',
                    boxShadow: activeFilterTab === 'my' ? '1.5px 1.5px 0 var(--line)' : 'none',
                    transition: 'all 0.1s ease'
                  }}
                >
                  My Patients
                </button>
                <button
                  onClick={() => setActiveFilterTab('all')}
                  style={{
                    background: activeFilterTab === 'all' ? 'var(--mint)' : 'transparent',
                    border: activeFilterTab === 'all' ? '2px solid var(--line)' : '2px solid transparent',
                    borderRadius: 6,
                    padding: '4px 12px',
                    fontSize: 12,
                    fontWeight: 900,
                    color: 'var(--ink)',
                    cursor: 'pointer',
                    boxShadow: activeFilterTab === 'all' ? '1.5px 1.5px 0 var(--line)' : 'none',
                    transition: 'all 0.1s ease'
                  }}
                >
                  All Patients
                </button>
              </div>
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
                type="text"
                placeholder="Search patient database..."
                onFocus={() => setIsSearchFocused(true)}
                onBlur={() => setIsSearchFocused(false)}
                style={{
                  width: '100%',
                  padding: '10px 14px 10px 42px',
                  border: '3px solid var(--line)',
                  borderRadius: 12,
                  fontSize: 14,
                  fontFamily: 'inherit',
                  fontWeight: 800,
                  color: 'var(--ink)',
                  outline: 'none',
                  boxShadow: isSearchFocused ? '5px 5px 0 var(--line)' : '3px 3px 0 var(--line)',
                  background: 'white',
                  transform: isSearchFocused ? 'translate(-2px, -2px)' : 'none',
                  transition: 'all 0.1s ease'
                }}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px 0', fontSize: 15, fontWeight: 800, color: 'var(--ink-soft)' }}>
              Loading registered patient data...
            </div>
          ) : filteredPatients.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', border: '3.5px dashed var(--line)', borderRadius: 16, fontSize: 14, fontWeight: 800, color: 'var(--ink-soft)' }}>
              No registered patients match your search.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20 }}>
              {filteredPatients.map(p => (
                <div 
                  key={p.clerk_id}
                  onClick={() => handleSelectPatient(p)}
                  className="plush-card tap"
                  style={{
                    padding: '20px 22px',
                    background: 'white',
                    border: '3px solid var(--line)',
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
                    <p style={{ fontSize: 12, color: 'var(--ink-soft)', margin: '4px 0 0', fontWeight: 800, textTransform: 'uppercase' }}>
                      Goal: {p.goal} • {p.age} y/o
                    </p>
                  </div>
                  
                  <div style={{ borderTop: '2px dashed var(--line)', paddingTop: 10, display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 800 }}>
                    <div>
                      <span style={{ color: 'var(--ink-soft)' }}>Sessions:</span>{' '}
                      <span style={{ color: 'var(--ink)' }}>{p.sessionCount}</span>
                    </div>
                    <div>
                      <span style={{ color: 'var(--ink-soft)' }}>ROM Rating:</span>{' '}
                      <span style={{ color: p.avgScore < 70 && p.sessionCount > 0 ? '#FF6B4A' : '#10B981' }}>
                        {p.sessionCount > 0 ? `${p.avgScore}%` : 'N/A'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {selectedPatient && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(43, 30, 22, 0.4)',
          zIndex: 100,
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'stretch'
        }}>
          <div style={{ flex: 1 }} onClick={() => setSelectedPatient(null)} />
          
          <div className="slide-in-right" style={{
            width: '100%',
            maxWidth: 680,
            background: 'var(--cream)',
            borderLeft: '4px solid var(--line)',
            padding: '32px 28px',
            display: 'flex',
            flexDirection: 'column',
            gap: 24,
            overflowY: 'auto',
            boxShadow: '-10px 0 0 rgba(43, 30, 22, 0.1)'
          }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '3.5px dashed var(--line)', paddingBottom: 16 }}>
              <div>
                <h2 style={{ fontSize: 26, color: 'var(--ink)', margin: 0 }}>{selectedPatient.name}</h2>
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
                    boxShadow: '2px 2px 0 var(--line)'
                  }}
                  title="Export workout logs to CSV"
                >
                  <Download size={14} /> Export CSV
                </button>
                <button 
                  onClick={() => setSelectedPatient(null)}
                  style={{
                    border: '3px solid var(--line)',
                    background: 'white',
                    borderRadius: 12,
                    padding: 8,
                    cursor: 'pointer',
                    display: 'flex',
                    boxShadow: '2px 2px 0 var(--line)'
                  }}
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div className="plush" style={{ padding: '12px 16px', background: 'white', fontSize: 13 }}>
                <span style={{ display: 'block', fontWeight: 900, color: 'var(--ink-soft)', textTransform: 'uppercase', fontSize: 10 }}>Experience Level</span>
                <span style={{ fontWeight: 800, color: 'var(--ink)', textTransform: 'capitalize' }}>{selectedPatient.experience}</span>
              </div>
              <div className="plush" style={{ padding: '12px 16px', background: 'white', fontSize: 13 }}>
                <span style={{ display: 'block', fontWeight: 900, color: 'var(--ink-soft)', textTransform: 'uppercase', fontSize: 10 }}>Wellness Goal</span>
                <span style={{ fontWeight: 800, color: 'var(--ink)', textTransform: 'capitalize' }}>{selectedPatient.goal}</span>
              </div>
            </div>

            {(() => {
              let currentCarePlan: any[] = [];
              try {
                if (selectedPatient.care_plan) {
                  currentCarePlan = JSON.parse(selectedPatient.care_plan);
                }
              } catch (e) {
                console.error('Failed to parse care plan', e);
              }
              return (
                <div className="plush" style={{ background: 'white', padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <h4 style={{ fontSize: 16, fontWeight: 900, color: 'var(--ink)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <HeartPulse size={18} style={{ color: 'var(--rose-deep)' }} /> Rehabilitative Care Plan
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
                              border: '2px solid var(--line)', 
                              borderRadius: 8, 
                              background: 'var(--cream)' 
                            }}
                          >
                            <div>
                              <div style={{ fontSize: 14, fontWeight: 900, color: 'var(--ink)' }}>
                                {poseConfig?.name || planItem.poseId}
                              </div>
                              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-soft)', marginTop: 2 }}>
                                Target Hold: <span style={{ color: 'var(--peach-deep)' }}>{planItem.targetHold}s</span> • Frequency: {planItem.frequency}
                              </div>
                            </div>
                            <button
                              disabled={isUpdatingCarePlan}
                              onClick={() => {
                                const newPlan = currentCarePlan.filter((_, idx) => idx !== index);
                                handleSaveCarePlan(newPlan);
                              }}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: 'var(--rose-deep)',
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
                      border: '2.5px dashed var(--line)',
                      borderRadius: 12,
                      background: 'var(--paper)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 12
                    }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 900, color: 'var(--ink)' }}>Prescribe Pose</div>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr 1.8fr', gap: 10 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <label style={{ fontSize: 10, fontWeight: 800, color: 'var(--ink-soft)' }}>Select Pose</label>
                        <select
                          value={prescribingPose}
                          onChange={(e) => setPrescribingPose(e.target.value)}
                          style={{
                            padding: '6px 8px',
                            border: '2px solid var(--line)',
                            borderRadius: 6,
                            background: 'white',
                            fontSize: 12,
                            fontWeight: 800,
                            fontFamily: 'inherit',
                            outline: 'none'
                          }}
                        >
                          <option value="">-- Select Pose --</option>
                          {POSES.map(p => (
                            <option key={p.id} value={p.id}>{p.name.split(' (')[0]}</option>
                          ))}
                        </select>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <label style={{ fontSize: 10, fontWeight: 800, color: 'var(--ink-soft)' }}>Target Hold</label>
                        <select
                          value={prescribingHold}
                          onChange={(e) => setPrescribingHold(parseInt(e.target.value))}
                          style={{
                            padding: '6px 8px',
                            border: '2px solid var(--line)',
                            borderRadius: 6,
                            background: 'white',
                            fontSize: 12,
                            fontWeight: 800,
                            fontFamily: 'inherit',
                            outline: 'none'
                          }}
                        >
                          {[5, 10, 15, 20, 30, 45, 60].map(s => (
                            <option key={s} value={s}>{s}s</option>
                          ))}
                        </select>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <label style={{ fontSize: 10, fontWeight: 800, color: 'var(--ink-soft)' }}>Frequency</label>
                        <select
                          value={prescribingFreq}
                          onChange={(e) => setPrescribingFreq(e.target.value)}
                          style={{
                            padding: '6px 8px',
                            border: '2px solid var(--line)',
                            borderRadius: 6,
                            background: 'white',
                            fontSize: 12,
                            fontWeight: 800,
                            fontFamily: 'inherit',
                            outline: 'none'
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
                        boxShadow: '2px 2px 0 var(--line)'
                      }}
                    >
                      <Plus size={14} /> Add Prescription
                    </button>
                  </div>
                </div>
              );
            })()}

            <div className="plush" style={{ background: 'white', padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h4 style={{ fontSize: 16, fontWeight: 900, color: 'var(--ink)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Sparkles size={18} style={{ color: 'var(--peach-deep)' }} /> Clinician Clinical Insight
                </h4>
                <button
                  onClick={handleGenerateAiInsight}
                  disabled={generatingAi || historyLoading || patientHistory.length === 0}
                  className="btn-plush primary"
                  style={{ fontSize: 12, padding: '8px 14px', borderRadius: 8, margin: 0 }}
                >
                  {generatingAi ? 'Analyzing Metrics...' : 'Generate AIPT Report'}
                </button>
              </div>

              {generatingAi ? (
                <div style={{ textAlign: 'center', padding: '24px 0', fontSize: 13, fontWeight: 800, color: 'var(--ink-soft)' }}>
                  Attending Grader AI is compiling range-of-motion metrics...
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
                    border: '2.5px solid var(--line)', 
                    borderRadius: 12, 
                    padding: 16, 
                    background: '#FDFBF7'
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
              <div className="plush" style={{ background: 'white', padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
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
                      <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
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

            <div className="plush" style={{ background: 'white', padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <h4 style={{ fontSize: 16, fontWeight: 900, color: 'var(--ink)', margin: 0 }}>Workout Practice Records</h4>
              
              {historyLoading ? (
                <div style={{ textAlign: 'center', padding: '20px 0', fontSize: 13, fontWeight: 800, color: 'var(--ink-soft)' }}>
                  Loading sessions...
                </div>
              ) : patientHistory.length === 0 ? (
                <p style={{ fontSize: 13, color: 'var(--ink-soft)', margin: 0, fontWeight: 700 }}>
                  This patient has not completed any training sessions yet.
                </p>
              ) : (
                <div style={{ maxHeight: 220, overflowY: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
                    <thead>
                      <tr style={{ borderBottom: '2.5px solid var(--line)', color: 'var(--ink-soft)', fontWeight: 900 }}>
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
                            borderBottom: '1.5px dashed var(--line)', 
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
                              background: s.grade === 'A' ? 'var(--mint)' : s.grade === 'B' ? 'var(--butter)' : '#FFEAE6',
                              padding: '2px 8px',
                              borderRadius: 6,
                              border: '1.5px solid var(--line)',
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
