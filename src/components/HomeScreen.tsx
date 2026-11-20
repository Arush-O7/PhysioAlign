import { store, useSessionHistory, useUserData, useActiveTab } from '../game/store';
import { useEffect, useState, useRef } from 'react';
import { useAuth } from '../utils/auth';
import { SessionData } from '../game/types';
import { POSES } from '../data/poses';
import { TopBar, Doodle, CuteFace, pressable } from './primitives';
import { useQueryParam } from '../game/router';
import {
  Award,
  Flame,
  Activity,
  Trash2,
  Plus,
  ChevronRight,
  MessageSquare,
  Send,
  TrendingUp,
  Sparkles,
  Clock,
  HeartPulse,
  Droplet,
  Coffee,
  CheckCircle
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from 'recharts';
import { askCoachQuestion } from '../utils/geminiService';

function relativeDate(ms: number): string {
  const diffMs = Date.now() - ms;
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
}

function StatCard({ title, value, icon, color }: StatCardProps) {
  return (
    <div
      className="plush"
      style={{
        background: 'var(--surface)',
        padding: '16px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16
      }}
    >
      <div>
        <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--ink-soft)' }}>
          {title}
        </span>
        <h2 style={{ fontSize: 32, fontWeight: 900, color: 'var(--ink)', marginTop: 4, lineHeight: 1 }}>
          {value}
        </h2>
      </div>
      <div style={{
        width: 44, height: 44, borderRadius: '50%', border: 'var(--bw) solid var(--line)',
        background: color, display: 'flex', alignItems: 'center', justifyItems: 'center',
        justifyContent: 'center', boxShadow: 'var(--plush-tiny)', color: 'var(--on-accent)', flexShrink: 0
      }} aria-hidden="true">
        {icon}
      </div>
    </div>
  );
}

interface Coach {
  id: string;
  name: string;
  role: string;
  color: string;
  avatarMood: 'happy' | 'neutral';
  skinColor: string;
  bio: string;
}

const COACHES: Coach[] = [
  {
    id: 'anya',
    name: 'Zen Master Anya',
    role: 'Breathing & Alignment',
    color: 'var(--mint)',
    avatarMood: 'happy',
    skinColor: '#FFD8B5',
    bio: 'Dedicated to inner calm, posture calibration, and slow, mindful flows. Ask me how to breathe properly or align your joints.'
  },
  {
    id: 'rocky',
    name: 'Coach Rocky',
    role: 'Core & Strength',
    color: 'var(--peach)',
    avatarMood: 'happy',
    skinColor: '#E0A899',
    bio: 'Energetic and supportive coach targeting posture holding, core strength, and muscle engagement.'
  },
  {
    id: 'maya',
    name: 'Dr. Maya',
    role: 'Rehab & Modification',
    color: 'var(--sky)',
    avatarMood: 'neutral',
    skinColor: '#FFEFD1',
    bio: 'Medical physical therapist helping you modify poses for injuries, joint tightness, and rehabilitation.'
  }
];

interface ChatMessage {
  sender: 'user' | 'coach';
  text: string;
  timestamp: number;
}

interface RoadmapItem {
  id: string;
  label: string;
  completed: boolean;
  type: 'pose' | 'habit';
  iconName: 'pose' | 'water' | 'breath' | 'warmth' | 'stretching';
}

export function HomeScreen() {
  const userData = useUserData();
  const history = useSessionHistory();
  const { userId } = useAuth();
  
  const activeTab = useActiveTab();
  const setActiveTab = (tab: 'dashboard' | 'trends' | 'consult') => store.setActiveTab(tab);

  const [painLevel, setPainLevel] = useState<number>(3);
  const [loggedPain, setLoggedPain] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('physioalign:logged_pain_today');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object' && parsed.date) {
          return new Date(parsed.date).toDateString() === new Date().toDateString();
        }
      }
    } catch (e) {
      console.error('Failed to parse logged pain status', e);
    }
    return false;
  });
  const [painRecommendation, setPainRecommendation] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('physioalign:logged_pain_today');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object' && parsed.recommendation) {
          return String(parsed.recommendation);
        }
      }
    } catch (e) {
      console.error('Failed to parse pain recommendation', e);
    }
    return '';
  });

  const [roadmap, setRoadmap] = useState<RoadmapItem[]>(() => {
    const defaultRoadmap: RoadmapItem[] = [
      { id: 'pose-tree', label: 'Practice Tree Pose (Vrksasana)', completed: false, type: 'pose', iconName: 'pose' },
      { id: 'pose-dog', label: 'Calibrate Downward Dog (Adho Mukha)', completed: false, type: 'pose', iconName: 'pose' },
      { id: 'water', label: 'Drink 8 glasses of water today', completed: false, type: 'habit', iconName: 'water' },
      { id: 'breath', label: 'Take a 5-min deep breathing break', completed: false, type: 'habit', iconName: 'breath' }
    ];
    try {
      const saved = localStorage.getItem('physioalign:daily_roadmap');
      if (saved) {
        const parsed = JSON.parse(saved);
        const savedDate = localStorage.getItem('physioalign:daily_roadmap_date');
        if (savedDate === new Date().toDateString() && Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch (e) {
      console.error('Failed to parse roadmap', e);
    }
    return defaultRoadmap;
  });


  const [coachParam, setCoachParam] = useQueryParam('coach');
  const selectedCoachId = COACHES.some((c) => c.id === coachParam) ? coachParam : 'anya';
  const setSelectedCoachId = (id: string) => setCoachParam(id === 'anya' ? '' : id);
  const [inputText, setInputText] = useState<string>('');
  const [isTyping, setIsTyping] = useState<boolean>(false);
  const [chats, setChats] = useState<Record<string, ChatMessage[]>>(() => {
    const defaultChats = {
      anya: [{ sender: 'coach', text: "Hello! I am Anya. Welcome to our sacred yoga space. Let's align your body and breath. How can I help you today?", timestamp: Date.now() }],
      rocky: [{ sender: 'coach', text: "Hey! Rocky here! Let's build strength and master your stability. What goals are we crushing today?", timestamp: Date.now() }],
      maya: [{ sender: 'coach', text: "Hello, I am Dr. Maya. I can help you safely modify postures to avoid injuries, release muscle stiffness, or assist in rehab. What questions do you have?", timestamp: Date.now() }]
    };
    try {
      const saved = localStorage.getItem('physioalign:coach_chats');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          return {
            anya: parsed.anya || defaultChats.anya,
            rocky: parsed.rocky || defaultChats.rocky,
            maya: parsed.maya || defaultChats.maya
          };
        }
      }
    } catch (e) {
      console.error('Failed to parse chats from localStorage', e);
    }
    return defaultChats;
  });

  const chatEndRef = useRef<HTMLDivElement>(null);


  useEffect(() => {
    if (activeTab === 'consult') {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chats, selectedCoachId, activeTab]);


  useEffect(() => {
    localStorage.setItem('physioalign:coach_chats', JSON.stringify(chats));
  }, [chats]);


  useEffect(() => {
    localStorage.setItem('physioalign:daily_roadmap', JSON.stringify(roadmap));
    localStorage.setItem('physioalign:daily_roadmap_date', new Date().toDateString());
  }, [roadmap]);


  useEffect(() => {
    if (userId) {
      store.syncHistory(userId);
    }
  }, [userId]);


  const count = history.length;
  
  const avgScore = count > 0 
    ? Math.round(history.reduce((sum, s) => sum + s.averageScore, 0) / count) 
    : 0;


  const computeStreak = (sessions: SessionData[]): number => {
    if (sessions.length === 0) return 0;
    // toISOString() is UTC, which puts early morning sessions on the wrong day
    const dates = new Set(sessions.map((s) => new Date(s.date).toDateString()));
    let streak = 0;
    const cursor = new Date();
    // haven't practised yet today, the streak from yesterday still counts
    if (!dates.has(cursor.toDateString())) {
      cursor.setDate(cursor.getDate() - 1);
    }
    for (;;) {
      const key = cursor.toDateString();
      if (dates.has(key)) {
        streak++;
        cursor.setDate(cursor.getDate() - 1);
      } else {
        break;
      }
    }
    return streak;
  };
  const streak = computeStreak(history);


  const getWeakestJoint = (sessions: SessionData[]): string => {
    if (sessions.length === 0) return 'None';
    const jointErrors: Record<string, number> = {};

    sessions.forEach((s) => {
      s.frameLogs.forEach((log) => {
        if (log.feedbackMessage && log.feedbackMessage.includes(':')) {
          const joint = log.feedbackMessage.split(':')[0].trim();
          jointErrors[joint] = (jointErrors[joint] || 0) + 1;
        }
      });
    });

    const entries = Object.entries(jointErrors);
    if (entries.length === 0) return 'Perfect Balance';
    
    entries.sort((a, b) => b[1] - a[1]);
    return entries[0][0];
  };
  const weakestArea = getWeakestJoint(history);

  const handleStartPractice = () => {
    store.setScreen('library');
  };

  const handleViewSession = (session: SessionData) => {
    store.viewSession(session);
  };

  const handleDeleteSession = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (userId && window.confirm('Are you sure you want to delete this session log?')) {
      await store.deleteSession(id, userId);
    }
  };


  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isTyping) return;

    const coach = COACHES.find(c => c.id === selectedCoachId);
    if (!coach || !userData) return;

    const userMsg: ChatMessage = {
      sender: 'user',
      text: inputText,
      timestamp: Date.now()
    };

    const currentCoachHistory = chats[selectedCoachId] || [];
    const updatedHistory = [...currentCoachHistory, userMsg];

    setChats(prev => ({
      ...prev,
      [selectedCoachId]: updatedHistory
    }));

    setInputText('');
    setIsTyping(true);

    try {
      const response = await askCoachQuestion(
        coach.id,
        currentCoachHistory.map(m => ({ sender: m.sender, text: m.text })),
        userMsg.text
      );

      const coachMsg: ChatMessage = {
        sender: 'coach',
        text: response,
        timestamp: Date.now()
      };

      setChats(prev => ({
        ...prev,
        [selectedCoachId]: [...updatedHistory, coachMsg]
      }));
    } catch (err) {
      console.error('Error generating chat response:', err);
    } finally {
      setIsTyping(false);
    }
  };


  const handleLogPain = () => {
    let rec = '';
    let updatedRoadmap: RoadmapItem[] = [];

    if (painLevel >= 7) {
      rec = "High stiffness logged. Dr. Maya recommends a restorative day: alignment modifications, joint warmth and gentle breathing. Skip heavy holds.";
      updatedRoadmap = [
        { id: 'pose-tree', label: 'Modify Tree Pose (Gentle chair-supported Vrksasana)', completed: false, type: 'pose', iconName: 'pose' },
        { id: 'water', label: 'Hydrate: Drink 10 glasses of water today', completed: false, type: 'habit', iconName: 'water' },
        { id: 'warmth', label: 'Apply light warmth/stretch to stiff joints', completed: false, type: 'habit', iconName: 'warmth' },
        { id: 'breath', label: 'Practice 10 counts of slow Pranayama breathing', completed: false, type: 'habit', iconName: 'breath' }
      ];
    } else if (painLevel >= 4) {
      rec = "Moderate stiffness logged. Zen Master Anya suggests full joint extensions and slow transitions, with basic alignment holds.";
      updatedRoadmap = [
        { id: 'pose-tree', label: 'Calibrate Tree Pose (Vrksasana)', completed: false, type: 'pose', iconName: 'pose' },
        { id: 'pose-warrior', label: 'Calibrate Warrior II (Virabhadrasana)', completed: false, type: 'pose', iconName: 'pose' },
        { id: 'water', label: 'Drink 8 glasses of water today', completed: false, type: 'habit', iconName: 'water' },
        { id: 'breath', label: 'Take a 5-min mindful breathing break', completed: false, type: 'habit', iconName: 'breath' }
      ];
    } else {
      rec = "Low fatigue — you are limber and stable today. Coach Rocky recommends pushing your hold durations on Downward Dog and Warrior II.";
      updatedRoadmap = [
        { id: 'pose-dog', label: 'Calibrate Downward Dog (Adho Mukha)', completed: false, type: 'pose', iconName: 'pose' },
        { id: 'pose-warrior', label: 'Challenge hold: Warrior II (Virabhadrasana)', completed: false, type: 'pose', iconName: 'pose' },
        { id: 'water', label: 'Drink 8 glasses of water today', completed: false, type: 'habit', iconName: 'water' },
        { id: 'stretching', label: 'Hold a posture for 60 seconds continuous', completed: false, type: 'habit', iconName: 'stretching' }
      ];
    }

    setPainRecommendation(rec);
    setLoggedPain(true);
    setRoadmap(updatedRoadmap);

    localStorage.setItem('physioalign:logged_pain_today', JSON.stringify({
      date: new Date().toISOString(),
      level: painLevel,
      recommendation: rec
    }));
  };

  const handleToggleRoadmapItem = (id: string) => {
    setRoadmap(prev => prev.map(item => 
      item.id === id ? { ...item, completed: !item.completed } : item
    ));
  };

  const activeCoach = COACHES.find(c => c.id === selectedCoachId) || COACHES[0];


  const trendData = [...history]
    .reverse()
    .map(s => ({
      date: new Date(s.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      score: s.averageScore,
      hold: s.holdTimeSeconds
    }));

  const poseSummaryMap: Record<string, { total: number; count: number }> = {};
  history.forEach(s => {
    if (!poseSummaryMap[s.poseName]) {
      poseSummaryMap[s.poseName] = { total: 0, count: 0 };
    }
    poseSummaryMap[s.poseName].total += s.averageScore;
    poseSummaryMap[s.poseName].count += 1;
  });

  const poseSummaryData = Object.entries(poseSummaryMap).map(([name, data]) => ({
    name,
    score: Math.round(data.total / data.count)
  }));

  const completedRoadmapCount = roadmap.filter(i => i.completed).length;
  const roadmapPercentage = roadmap.length > 0 ? Math.round((completedRoadmapCount / roadmap.length) * 100) : 0;

  return (
    <div className="screen" style={{ background: 'var(--cream)' }}>
      <TopBar here={0} steps={['Dashboard']} userName={userData?.name} />

      <main id="main" tabIndex={-1} style={{ maxWidth: 1024, margin: '24px auto', padding: '0 24px', display: 'flex', flexDirection: 'column', gap: 24 }}>
        

        <div className="plush" style={{ padding: '24px 28px', background: 'var(--surface)', position: 'relative', overflow: 'hidden' }}>
          
          <h1 style={{ fontSize: 36, color: 'var(--ink)' }}>
            Welcome back, {userData?.name || 'Friend'}!
          </h1>
          <p style={{ fontSize: 16, color: 'var(--ink-2)', marginTop: 6, fontWeight: 700, maxWidth: 640 }}>
            {count === 0 
              ? 'Ready to start your practice? Click below to select a yoga pose and calibrate your posture.'
              : 'Your practice history is logged below. Complete sessions regularly to build muscle memory and stability.'}
          </p>
          
          <button
            onClick={handleStartPractice}
            className="btn-plush primary tap"
            style={{ marginTop: 16 }}
          >
            <Plus size={16} /> Start a session
          </button>
        </div>


        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, borderBottom: 'var(--bw) solid var(--line)', paddingBottom: 12 }}>
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`btn-plush ${activeTab === 'dashboard' ? 'primary' : 'ghost'}`}
            style={{ padding: '8px 16px', fontSize: 14, borderRadius: 'var(--r-sm)' }}
          >
            <Activity size={16} style={{ marginRight: 6 }} />
            Evaluations
          </button>
          <button
            onClick={() => setActiveTab('trends')}
            className={`btn-plush ${activeTab === 'trends' ? 'mint' : 'ghost'}`}
            style={{ padding: '8px 16px', fontSize: 14, borderRadius: 'var(--r-sm)' }}
          >
            <TrendingUp size={16} style={{ marginRight: 6 }} />
            Analytics & Trends
          </button>
          <button
            onClick={() => setActiveTab('consult')}
            className={`btn-plush ${activeTab === 'consult' ? 'sky' : 'ghost'}`}
            style={{ padding: '8px 16px', fontSize: 14, borderRadius: 'var(--r-sm)' }}
          >
            <MessageSquare size={16} style={{ marginRight: 6 }} />
            AI Coach Consult
          </button>
        </div>



        {activeTab === 'dashboard' && (
          <div className="popin" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 20 }}>
              <StatCard title="Daily streak" value={`${streak} ${streak === 1 ? 'day' : 'days'}`} icon={<Flame size={20} />} color="var(--peach)" />
              <StatCard title="Sessions practised" value={count} icon={<Activity size={20} />} color="var(--sky)" />
              <StatCard title="Average score" value={`${avgScore}%`} icon={<Award size={20} />} color="var(--butter)" />
              <StatCard title="Focus area" value={weakestArea} icon={<Doodle kind="star" size={20} color="var(--on-accent)" />} color="var(--rose)" />
            </div>


            {(() => {
              const carePlan = userData?.carePlan ?? [];
              if (carePlan.length === 0) return null;
              
              return (
                <div className="plush" style={{ padding: '24px 28px', background: 'var(--surface)', display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div style={{ borderBottom: 'var(--bw) solid var(--line)', paddingBottom: 12, display: 'flex', alignItems: 'center', justifyItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                    <h2 style={{ fontSize: 22, color: 'var(--ink)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <HeartPulse size={24} style={{ color: 'var(--rose-text)' }} /> Prescribed Rehabilitation Plan
                    </h2>
                    <span style={{ fontSize: 12, fontWeight: 900, color: 'var(--ink-soft)', border: 'var(--bw) solid var(--line)' }} className="chip">
                      Assigned by your Doctor
                    </span>
                  </div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
                    {carePlan.map((planItem: any, index: number) => {
                      const poseConfig = POSES.find(p => p.id === planItem.poseId);
                      return (
                        <button
                          type="button"
                          key={index}
                          className="plush tap card-btn"
                          onClick={() => store.selectPose(planItem.poseId)}
                          style={{
                            background: 'var(--cream)',
                            padding: 16,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            cursor: 'pointer',
                            borderWidth: 'var(--bw)',
                            boxShadow: 'var(--plush-tiny)',
                            gap: 12
                          }}
                        >
                          <div>
                            <div style={{ fontSize: 16, fontWeight: 900, color: 'var(--ink)' }}>
                              {poseConfig?.name || planItem.poseId}
                            </div>
                            <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--ink-soft)', marginTop: 4 }}>
                              Goal hold: <span style={{ color: 'var(--peach-text)' }}>{planItem.targetHold}s</span> • {planItem.frequency}
                            </div>
                          </div>
                          <span className="btn-plush primary" style={{ fontSize: 11, padding: '4px 10px', borderWidth: 'var(--bw-thin)', borderRadius: 6, height: 'auto', margin: 0, flexShrink: 0 }}>
                            Start
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })()}


            <div className="layout-split" style={{ alignItems: 'start' }}>
              

              <div className="plush" style={{ padding: '24px 28px', background: 'var(--surface)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: 'var(--bw) solid var(--line)', paddingBottom: 12, marginBottom: 16 }}>
                  <h2 style={{ fontSize: 22, color: 'var(--ink)', margin: 0 }}>
                    Completed Evaluations
                  </h2>
                  <button
                    onClick={handleStartPractice}
                    className="btn-plush primary"
                    style={{ fontSize: 13, padding: '6px 12px', borderWidth: 'var(--bw-thin)', height: 'auto', display: 'inline-flex' }}
                  >
                    <Plus size={14} style={{ marginRight: 4 }} /> New Session
                  </button>
                </div>

                {count === 0 ? (
                  <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--ink-soft)' }}>
                    <div style={{ marginBottom: 12 }}>
                      <Doodle kind="star" size={48} color="var(--cream-2)" />
                    </div>
                    <p style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>No sessions logged yet.</p>
                    <p style={{ fontSize: 13, margin: '4px 0 0' }}>Your completed session reports will appear here.</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {history.map((session) => (
                      <div
                        key={session.id}
                        {...pressable(() => handleViewSession(session))}
                        aria-label={`Open the ${session.poseName} report from ${relativeDate(session.date)}`}
                        className="tap"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '14px 18px',
                          border: 'var(--bw) solid var(--line)',
                          borderRadius: 'var(--r-sm)',
                          background: 'var(--paper)',
                          boxShadow: 'var(--plush-tiny)',
                          cursor: 'pointer'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>

                          <div
                            className={`debrief-grade-badge ${session.grade.toLowerCase()}`}
                            style={{
                              width: 44,
                              height: 44,
                              fontSize: 22,
                              borderRadius: 10,
                              border: 'var(--bw) solid var(--line)',
                              transform: 'none',
                              flexShrink: 0
                            }}
                          >
                            {session.grade}
                          </div>

                          <div>
                            <h3 style={{ fontSize: 17, fontWeight: 800 }}>{session.poseName}</h3>
                            <div className="num" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', columnGap: 8, rowGap: 2, marginTop: 4, fontSize: 12, color: 'var(--ink-soft)', fontWeight: 700 }}>
                              <span style={{ whiteSpace: 'nowrap' }}>{relativeDate(session.date)}</span>
                              <span aria-hidden="true">•</span>
                              <span style={{ whiteSpace: 'nowrap' }}>Hold: {session.holdTimeSeconds}s</span>
                              <span aria-hidden="true">•</span>
                              <span style={{ whiteSpace: 'nowrap' }}>Score: {session.averageScore}%</span>
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                          <button
                            onClick={(e) => handleDeleteSession(session.id, e)}
                            style={{
                              background: 'transparent', border: 0, padding: 6, cursor: 'pointer',
                              color: 'var(--rose-text)'
                            }}
                            title="Delete log entry"
                            aria-label={`Delete the ${session.poseName} session`}
                          >
                            <Trash2 size={18} aria-hidden="true" />
                          </button>
                          <ChevronRight size={20} color="var(--line)" aria-hidden="true" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>


              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                

                <div className="plush" style={{ padding: 20, background: 'var(--surface)' }}>
                  <h3 style={{ fontSize: 18, fontWeight: 900, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <HeartPulse size={20} color="var(--rose-deep)" /> Daily Pain & Stiffness Log
                  </h3>
                  
                  {!loggedPain ? (
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-2)', lineHeight: 1.4, margin: '0 0 16px' }}>
                        How do your joints and muscles feel right now? Log today's fatigue index (1 is limber, 10 is stiff/painful) to adapt your exercises:
                      </p>
                      

                      <div style={{ display: 'flex', alignItems: 'center', gap: 14, margin: '20px 0' }}>
                        <span style={{ fontSize: 12, fontWeight: 900, color: 'var(--mint-text)' }}>1 (Limber)</span>
                        <input 
                          type="range" 
                          aria-label="How stiff or sore you feel today, from 1 (limber) to 10 (stiff)"
                          aria-valuetext={`${painLevel} out of 10`}
                          min="1" 
                          max="10" 
                          value={painLevel} 
                          onChange={(e) => setPainLevel(parseInt(e.target.value))}
                          style={{
                            flex: 1,
                            accentColor: 'var(--peach-deep)',
                            cursor: 'pointer'
                          }} 
                        />
                        <span style={{ fontSize: 12, fontWeight: 900, color: 'var(--rose-text)' }}>10 (Stiff)</span>
                      </div>
                      
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
                        <div style={{ fontSize: 14, fontWeight: 800 }}>
                          Selected Index: <span style={{ color: painLevel >= 7 ? 'var(--rose-text)' : painLevel >= 4 ? 'var(--butter-text)' : 'var(--mint-text)', fontSize: 18, fontWeight: 900 }}>{painLevel}</span>
                        </div>
                        <button
                          onClick={handleLogPain}
                          className="btn-plush primary"
                          style={{ fontSize: 12, padding: '8px 16px', borderRadius: 'var(--r-sm)', boxShadow: 'var(--plush-tiny)', height: 'auto' }}
                        >
                          Log Daily Index
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--cream-2)', padding: '12px 14px', borderRadius: 'var(--r-sm)', border: 'var(--bw) solid var(--line)' }}>
                        <CheckCircle size={18} color="var(--mint-deep)" />
                        <span style={{ fontSize: 13, fontWeight: 800 }}>Daily index logged successfully!</span>
                      </div>
                      <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-2)', lineHeight: 1.5, margin: 0 }}>
                        {painRecommendation}
                      </p>
                      <button
                        onClick={() => setLoggedPain(false)}
                        style={{
                          background: 'none', border: 0, textDecoration: 'underline', color: 'var(--ink-soft)',
                          fontSize: 11, fontWeight: 800, cursor: 'pointer', textAlign: 'left', width: 'fit-content'
                        }}
                      >
                        Log a different index
                      </button>
                    </div>
                  )}
                </div>


                <div className="plush" style={{ padding: 20, background: 'var(--surface)' }}>
                  <h3 style={{ fontSize: 18, fontWeight: 900, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <TrendingUp size={20} color="var(--mint-deep)" /> Today's Wellness Roadmap
                  </h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>

                    <div style={{ flex: 1, height: 10, background: 'var(--cream)', border: 'var(--bw) solid var(--line)', borderRadius: 'var(--r-pill)', overflow: 'hidden' }}>
                      <div style={{ width: `${roadmapPercentage}%`, height: '100%', background: 'var(--mint-deep)', transition: 'width 300ms ease' }} />
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--ink-2)' }}>{roadmapPercentage}%</span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {roadmap.map((item) => (
                      <button
                        type="button"
                        key={item.id}
                        onClick={() => handleToggleRoadmapItem(item.id)}
                        aria-pressed={item.completed}
                        className="card-btn"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                          padding: '10px 14px',
                          border: 'var(--bw) solid var(--line)',
                          borderRadius: 'var(--r-sm)',
                          background: item.completed ? 'var(--cream-2)' : 'var(--paper)',
                          cursor: 'pointer',
                          textDecoration: item.completed ? 'line-through' : 'none',
                          opacity: item.completed ? 0.75 : 1,
                          transition: 'background-color 150ms'
                        }}
                      >
                        <div style={{
                          width: 20,
                          height: 20,
                          borderRadius: '50%',
                          border: 'var(--bw) solid var(--line)',
                          background: item.completed ? 'var(--mint-deep)' : 'var(--surface)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          boxShadow: 'var(--sh-down-1)'
                        }}>
                          {item.completed && <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--surface)' }} />}
                        </div>
                        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>
                          {item.label}
                        </span>
                        <div style={{ marginLeft: 'auto', opacity: 0.6 }}>
                          {(() => {
                            switch (item.iconName) {
                              case 'pose':
                                return <Activity size={16} />;
                              case 'water':
                                return <Droplet size={16} />;
                              case 'breath':
                                return <Coffee size={16} />;
                              case 'warmth':
                                return <HeartPulse size={16} />;
                              case 'stretching':
                                return <Clock size={16} />;
                              default:
                                return <Activity size={16} />;
                            }
                          })()}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>


                <div className="plush" style={{ padding: 20, background: 'var(--surface)', display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{
                    border: 'var(--bw) solid var(--line)',
                    borderRadius: '50%',
                    overflow: 'hidden',
                    width: 44,
                    height: 44,
                    background: 'var(--surface)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <CuteFace size={54} mood={activeCoach.avatarMood} skin={activeCoach.skinColor} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <h4 style={{ fontSize: 14, fontWeight: 900, color: 'var(--ink)', margin: 0 }}>
                      Consult {activeCoach.name.split(' ').pop()}
                    </h4>
                    <p style={{ fontSize: 11, color: 'var(--ink-soft)', margin: '2px 0 0', lineHeight: 1.3, fontWeight: 700 }}>
                      Need help or pose modifications? Consult your active coach.
                    </p>
                  </div>
                  <button
                    onClick={() => setActiveTab('consult')}
                    aria-label={`Chat with ${activeCoach.name}`}
                    className="btn-plush primary"
                    style={{
                      width: 36,
                      height: 36,
                      padding: 0,
                      borderRadius: 'var(--r-sm)',
                      boxShadow: 'var(--plush-tiny)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <MessageSquare size={16} />
                  </button>
                </div>

              </div>

            </div>

          </div>
        )}

        {activeTab === 'trends' && (
          <div className="popin" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {count === 0 ? (
              <div className="plush" style={{ padding: '40px 28px', background: 'var(--surface)', textAlign: 'center' }}>
                <div style={{ marginBottom: 12 }}>
                  <Doodle kind="flower" size={48} color="var(--cream-2)" />
                </div>
                <h3 style={{ fontWeight: 800 }}>No Session Data Available</h3>
                <p style={{ color: 'var(--ink-2)', fontSize: 14, margin: '8px 0 0' }}>
                  Please complete at least one yoga pose session to generate analytics charts.
                </p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 24 }}>
                

                <div className="plush" style={{ background: 'var(--surface)', padding: 24 }}>
                  <h3 style={{ fontSize: 18, fontWeight: 900, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <TrendingUp size={18} color="var(--peach-deep)" /> Accuracy Progress (%)
                  </h3>
                  <div style={{ width: '100%', height: 260 }}>
                    <ResponsiveContainer>
                      <LineChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="color-mix(in srgb, var(--ink) 14%, transparent)" />
                        <XAxis dataKey="date" stroke="var(--ink-soft)" style={{ fontSize: 11, fontWeight: 700 }} />
                        <YAxis domain={[0, 100]} stroke="var(--ink-soft)" style={{ fontSize: 11, fontWeight: 700 }} />
                        <Tooltip
                          contentStyle={{
                            background: 'var(--surface)',
                            border: 'var(--bw) solid var(--line)',
                            borderRadius: '10px',
                            boxShadow: 'var(--plush-tiny)',
                            fontFamily: 'inherit',
                            fontWeight: 800
                          }}
                        />
                        <Line
                          type="monotone"
                          dataKey="score"
                          name="Accuracy"
                          stroke="var(--peach-deep)"
                          strokeWidth={4.5}
                          activeDot={{ r: 8, stroke: 'var(--line)', strokeWidth: 2 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>


                <div className="plush" style={{ background: 'var(--surface)', padding: 24 }}>
                  <h3 style={{ fontSize: 18, fontWeight: 900, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Clock size={18} color="var(--sky-deep)" /> Hold Duration (seconds)
                  </h3>
                  <div style={{ width: '100%', height: 260 }}>
                    <ResponsiveContainer>
                      <BarChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="color-mix(in srgb, var(--ink) 14%, transparent)" />
                        <XAxis dataKey="date" stroke="var(--ink-soft)" style={{ fontSize: 11, fontWeight: 700 }} />
                        <YAxis stroke="var(--ink-soft)" style={{ fontSize: 11, fontWeight: 700 }} />
                        <Tooltip
                          contentStyle={{
                            background: 'var(--surface)',
                            border: 'var(--bw) solid var(--line)',
                            borderRadius: '10px',
                            boxShadow: 'var(--plush-tiny)',
                            fontFamily: 'inherit',
                            fontWeight: 800
                          }}
                        />
                        <Bar
                          dataKey="hold"
                          name="Hold Time"
                          fill="var(--sky)"
                          stroke="var(--line)"
                          strokeWidth={2.5}
                          radius={[6, 6, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>


                <div className="plush" style={{ background: 'var(--surface)', padding: 24, gridColumn: '1 / -1' }}>
                  <h3 style={{ fontSize: 18, fontWeight: 900, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Award size={18} color="var(--butter-deep)" /> Average Accuracy by Yoga Pose
                  </h3>
                  <div style={{ width: '100%', height: 280 }}>
                    <ResponsiveContainer>
                      <BarChart data={poseSummaryData} margin={{ top: 10, right: 10, left: -20, bottom: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="color-mix(in srgb, var(--ink) 14%, transparent)" />
                        <XAxis dataKey="name" stroke="var(--ink-soft)" style={{ fontSize: 12, fontWeight: 800 }} />
                        <YAxis domain={[0, 100]} stroke="var(--ink-soft)" style={{ fontSize: 11, fontWeight: 700 }} />
                        <Tooltip
                          contentStyle={{
                            background: 'var(--surface)',
                            border: 'var(--bw) solid var(--line)',
                            borderRadius: '10px',
                            boxShadow: 'var(--plush-tiny)',
                            fontFamily: 'inherit',
                            fontWeight: 800
                          }}
                        />
                        <Bar
                          dataKey="score"
                          name="Avg Score"
                          fill="var(--butter)"
                          stroke="var(--line)"
                          strokeWidth={2.5}
                          radius={[8, 8, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

              </div>
            )}
          </div>
        )}

        {activeTab === 'consult' && (
          <div className="popin layout-sidebar" style={{ minHeight: 520 }}>
            

            <div className="plush" style={{ background: 'var(--surface)', padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <h3 style={{ fontSize: 18, fontWeight: 900, borderBottom: 'var(--bw) solid var(--line)', paddingBottom: 8, color: 'var(--ink)' }}>
                Yoga Instructors
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {COACHES.map((coach) => (
                  <button
                    type="button"
                    key={coach.id}
                    onClick={() => setSelectedCoachId(coach.id)}
                    aria-pressed={selectedCoachId === coach.id}
                    className="tap card-btn"
                    style={{
                      padding: 12,
                      border: 'var(--bw) solid var(--line)',
                      borderRadius: 'var(--r-sm)',
                      background: selectedCoachId === coach.id ? coach.color : 'var(--paper)',
                      color: selectedCoachId === coach.id ? 'var(--on-accent)' : 'var(--ink)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      boxShadow: selectedCoachId === coach.id ? 'none' : 'var(--plush-tiny)',
                      transform: selectedCoachId === coach.id ? 'translateY(2px)' : 'none'
                    }}
                  >
                    <div style={{
                      border: 'var(--bw) solid var(--line)',
                      borderRadius: '50%',
                      overflow: 'hidden',
                      width: 32,
                      height: 32,
                      background: 'var(--surface)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <CuteFace size={38} mood={coach.avatarMood} skin={coach.skinColor} />
                    </div>
                    <div>
                      <h4 style={{ fontSize: 14, fontWeight: 900, color: 'inherit', margin: 0 }}>
                        {coach.name.split(' ').pop()}
                      </h4>
                      <p style={{ fontSize: 12, fontWeight: 800, color: 'inherit', opacity: 0.8, margin: 0 }}>
                        {coach.role}
                      </p>
                    </div>
                  </button>
                ))}
              </div>

              <div style={{ marginTop: 'auto', background: 'var(--cream-2)', border: 'var(--bw) solid var(--line)', borderRadius: 'var(--r-sm)', padding: 12 }}>
                <p style={{ fontSize: 11, fontWeight: 800, color: 'var(--ink-2)', margin: 0 }}>
                  Active Coach:
                </p>
                <h4 style={{ fontSize: 13, fontWeight: 900, margin: '2px 0 4px' }}>
                  {activeCoach.name}
                </h4>
                <p style={{ fontSize: 11, color: 'var(--ink-soft)', margin: 0, lineHeight: 1.4 }}>
                  {activeCoach.bio}
                </p>
              </div>
            </div>


            <div className="plush" style={{ background: 'var(--surface)', display: 'flex', flexDirection: 'column', overflow: 'hidden', height: 520 }}>
              

              <div style={{
                padding: '16px 20px',
                borderBottom: 'var(--bw) solid var(--line)',
                background: activeCoach.color,
                color: 'var(--on-accent)',
                display: 'flex',
                alignItems: 'center',
                gap: 12
              }}>
                <div style={{
                  border: 'var(--bw) solid var(--line)',
                  borderRadius: '50%',
                  overflow: 'hidden',
                  width: 40,
                  height: 40,
                  background: 'var(--surface)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <CuteFace size={48} mood={activeCoach.avatarMood} skin={activeCoach.skinColor} />
                </div>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 900 }}>{activeCoach.name}</h3>
                  <p style={{ fontSize: 12, fontWeight: 800, opacity: 0.85, margin: 0 }}>
                    {activeCoach.role} • AI Assistant
                  </p>
                </div>
                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <button
                    onClick={() => {
                      if (window.confirm(`Clear chat history with ${activeCoach.name.split(' ').pop()}?`)) {
                        const defaultMsgs: Record<string, string> = {
                          anya: "Hello! I am Anya. Welcome to our sacred yoga space. Let's align your body and breath. How can I help you today?",
                          rocky: "Hey! Rocky here! Let's build strength and master your stability. What goals are we crushing today?",
                          maya: "Hello, I am Dr. Maya. I can help you safely modify postures to avoid injuries, release muscle stiffness, or assist in rehab. What questions do you have?"
                        };
                        setChats(prev => ({
                          ...prev,
                          [selectedCoachId]: [{ sender: 'coach', text: defaultMsgs[selectedCoachId], timestamp: Date.now() }]
                        }));
                      }
                    }}
                    style={{
                      background: 'transparent',
                      border: 0,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      color: 'inherit',
                      padding: 6,
                      opacity: 0.8
                    }}
                    title="Clear chat history"
                    aria-label="Clear chat history"
                    className="tap"
                  >
                    <Trash2 size={16} aria-hidden="true" />
                  </button>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span className="dot" style={{ background: 'currentColor', width: 6, height: 6 }} />
                    <span style={{ fontSize: 12, fontWeight: 800 }}>Online</span>
                  </div>
                </div>
              </div>


              <div style={{
                flex: 1,
                padding: 20,
                background: 'var(--paper)',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: 16
              }}>
                {(chats[selectedCoachId] || []).map((msg, index) => {
                  const isUser = msg.sender === 'user';
                  return (
                    <div
                      key={index}
                      style={{
                        alignSelf: isUser ? 'flex-end' : 'flex-start',
                        maxWidth: '75%',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: isUser ? 'flex-end' : 'flex-start'
                      }}
                    >
                      <div
                        style={{
                          background: isUser ? 'var(--butter)' : 'var(--surface)',
                          border: 'var(--bw) solid var(--line)',
                          borderRadius: isUser ? '16px 16px 2px 16px' : '16px 16px 16px 2px',
                          padding: '12px 16px',
                          boxShadow: 'var(--plush-tiny)',
                          color: isUser ? 'var(--on-accent)' : 'var(--ink)',
                          fontSize: 14,
                          fontWeight: 700,
                          lineHeight: 1.5,
                          whiteSpace: 'pre-wrap'
                        }}
                      >
                        {msg.text}
                      </div>
                      <span style={{ fontSize: 10, color: 'var(--ink-soft)', marginTop: 4, fontWeight: 800 }}>
                        {new Date(msg.timestamp).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  );
                })}

                {isTyping && (
                  <div style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{
                      background: 'var(--surface)',
                      border: 'var(--bw) solid var(--line)',
                      borderRadius: '12px 12px 12px 2px',
                      padding: '10px 16px',
                      boxShadow: 'var(--plush-tiny)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4
                    }}>
                      <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--ink-soft)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <Sparkles size={14} className="floaty" style={{ color: 'var(--peach-text)' }} />
                        {activeCoach.name.split(' ').pop()} is thinking…
                      </span>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>


              <form
                onSubmit={handleSendMessage}
                style={{
                  padding: '12px 16px',
                  borderTop: 'var(--bw) solid var(--line)',
                  background: 'var(--surface)',
                  display: 'flex',
                  gap: 12,
                  alignItems: 'center'
                }}
              >
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder={`Ask ${activeCoach.name.split(' ').pop()} a question…`}
                  aria-label={`Message ${activeCoach.name}`}
                  name="coach-message"
                  autoComplete="off"
                  disabled={isTyping}
                  style={{
                    flex: 1,
                    height: 44,
                    border: 'var(--bw) solid var(--line)',
                    borderRadius: 'var(--r-sm)',
                    padding: '0 16px',
                    fontFamily: 'inherit',
                    fontSize: 14,
                    fontWeight: 700,
                    color: 'var(--ink)',
                    boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.05)'
                  }}
                />
                <button
                  type="submit"
                  disabled={!inputText.trim() || isTyping}
                  aria-label="Send message"
                  className="btn-plush primary"
                  style={{
                    width: 44,
                    height: 44,
                    padding: 0,
                    borderRadius: 'var(--r-sm)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: 'var(--sh-down-3)'
                  }}
                >
                  <Send size={18} />
                </button>
              </form>

            </div>

          </div>
        )}

      </main>
    </div>
  );
}
