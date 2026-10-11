import { store, useSessionHistory, useUserData, useActiveTab } from '../game/store';
import { useEffect, useState, useRef } from 'react';
import { useAuth } from '../utils/auth';
import { SessionData } from '../game/types';
import { TopBar } from './primitives';
import {
  Activity,
  Award,
  ChevronRight,
  Crosshair,
  Flame,
  HeartPulse,
  Plus,
  RotateCcw,
  Send,
  Trash2,
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
  CartesianGrid,
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

interface Coach {
  id: string;
  name: string;
  role: string;
  bio: string;
}

const COACHES: Coach[] = [
  {
    id: 'anya',
    name: 'Anya',
    role: 'Breathing & alignment',
    bio: 'Slow, mindful flows. Ask about breathing technique or how to line a pose up.',
  },
  {
    id: 'rocky',
    name: 'Rocky',
    role: 'Strength & holds',
    bio: 'Core engagement and longer holds. Ask how to build up to harder poses.',
  },
  {
    id: 'maya',
    name: 'Dr. Maya',
    role: 'Rehab & modifications',
    bio: 'Physical therapy focus. Ask how to adapt a pose around stiffness or an injury.',
  },
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

const TABS = [
  { id: 'dashboard', label: 'Overview' },
  { id: 'trends', label: 'Trends' },
  { id: 'consult', label: 'Coaches' },
] as const;

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
      { id: 'pose-tree', label: 'Practise Tree Pose', completed: false, type: 'pose', iconName: 'pose' },
      { id: 'pose-dog', label: 'Practise Downward Dog', completed: false, type: 'pose', iconName: 'pose' },
      { id: 'water', label: 'Drink 8 glasses of water', completed: false, type: 'habit', iconName: 'water' },
      { id: 'breath', label: 'Take a 5 minute breathing break', completed: false, type: 'habit', iconName: 'breath' },
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

  const [selectedCoachId, setSelectedCoachId] = useState<string>('anya');
  const [inputText, setInputText] = useState<string>('');
  const [isTyping, setIsTyping] = useState<boolean>(false);
  const [chats, setChats] = useState<Record<string, ChatMessage[]>>(() => {
    const defaultChats = {
      anya: [{ sender: 'coach', text: "Hi, I'm Anya. Tell me which pose you're working on and how it feels, and we'll look at your breathing and alignment.", timestamp: Date.now() }],
      rocky: [{ sender: 'coach', text: "Rocky here. Want longer holds or more control? Tell me where you're losing the pose and we'll build from there.", timestamp: Date.now() }],
      maya: [{ sender: 'coach', text: "I'm Dr. Maya. If something feels stiff or sore, describe it and I'll suggest a safe modification.", timestamp: Date.now() }],
    };
    try {
      const saved = localStorage.getItem('physioalign:coach_chats');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          return {
            anya: parsed.anya || defaultChats.anya,
            rocky: parsed.rocky || defaultChats.rocky,
            maya: parsed.maya || defaultChats.maya,
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

  const avgScore = count > 0 ? Math.round(history.reduce((sum, s) => sum + s.averageScore, 0) / count) : 0;

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
    if (sessions.length === 0) return '—';
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
    if (entries.length === 0) return 'All in range';

    entries.sort((a, b) => b[1] - a[1]);
    return entries[0][0];
  };
  const weakestArea = getWeakestJoint(history);

  const handleStartPractice = () => {
    store.setScreen('library');
  };

  const handleViewSession = (session: SessionData) => {
    store.getState().activeSession = session;
    store.setScreen('debrief');
  };

  const handleDeleteSession = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (userId && window.confirm('Delete this session? This cannot be undone.')) {
      await store.deleteSession(id, userId);
    }
  };

  const handleResetProfile = () => {
    if (!userId) return;
    if (window.confirm('Reset your profile? This deletes your profile details and every saved session.')) {
      store.resetOnboarding(userId);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isTyping) return;

    const coach = COACHES.find((c) => c.id === selectedCoachId);
    if (!coach || !userData) return;

    const userMsg: ChatMessage = {
      sender: 'user',
      text: inputText,
      timestamp: Date.now(),
    };

    const currentCoachHistory = chats[selectedCoachId] || [];
    const updatedHistory = [...currentCoachHistory, userMsg];

    setChats((prev) => ({
      ...prev,
      [selectedCoachId]: updatedHistory,
    }));

    setInputText('');
    setIsTyping(true);

    try {
      const response = await askCoachQuestion(
        coach.id,
        currentCoachHistory.map((m) => ({ sender: m.sender, text: m.text })),
        userMsg.text
      );

      const coachMsg: ChatMessage = {
        sender: 'coach',
        text: response,
        timestamp: Date.now(),
      };

      setChats((prev) => ({
        ...prev,
        [selectedCoachId]: [...updatedHistory, coachMsg],
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
      rec = 'High stiffness logged. Keep today restorative: gentle range of motion, supported poses and slow breathing. Skip long holds.';
      updatedRoadmap = [
        { id: 'pose-tree', label: 'Tree Pose with a chair for support', completed: false, type: 'pose', iconName: 'pose' },
        { id: 'water', label: 'Drink 10 glasses of water', completed: false, type: 'habit', iconName: 'water' },
        { id: 'warmth', label: 'Warm the stiff joints before moving', completed: false, type: 'habit', iconName: 'warmth' },
        { id: 'breath', label: '10 slow breathing counts', completed: false, type: 'habit', iconName: 'breath' },
      ];
    } else if (painLevel >= 4) {
      rec = 'Moderate stiffness logged. Work on full extensions and slow transitions rather than depth or duration.';
      updatedRoadmap = [
        { id: 'pose-tree', label: 'Practise Tree Pose', completed: false, type: 'pose', iconName: 'pose' },
        { id: 'pose-warrior', label: 'Practise Warrior II', completed: false, type: 'pose', iconName: 'pose' },
        { id: 'water', label: 'Drink 8 glasses of water', completed: false, type: 'habit', iconName: 'water' },
        { id: 'breath', label: 'Take a 5 minute breathing break', completed: false, type: 'habit', iconName: 'breath' },
      ];
    } else {
      rec = 'Feeling limber. Good day to push your hold times and work on the poses you usually cut short.';
      updatedRoadmap = [
        { id: 'pose-dog', label: 'Practise Downward Dog', completed: false, type: 'pose', iconName: 'pose' },
        { id: 'pose-warrior', label: 'Longer hold: Warrior II', completed: false, type: 'pose', iconName: 'pose' },
        { id: 'water', label: 'Drink 8 glasses of water', completed: false, type: 'habit', iconName: 'water' },
        { id: 'stretching', label: 'Hold one pose for 60 seconds', completed: false, type: 'habit', iconName: 'stretching' },
      ];
    }

    setPainRecommendation(rec);
    setLoggedPain(true);
    setRoadmap(updatedRoadmap);

    localStorage.setItem(
      'physioalign:logged_pain_today',
      JSON.stringify({
        date: new Date().toISOString(),
        level: painLevel,
        recommendation: rec,
      })
    );
  };

  const handleToggleRoadmapItem = (id: string) => {
    setRoadmap((prev) => prev.map((item) => (item.id === id ? { ...item, completed: !item.completed } : item)));
  };

  const activeCoach = COACHES.find((c) => c.id === selectedCoachId) || COACHES[0];

  const trendData = [...history]
    .reverse()
    .map((s) => ({
      date: new Date(s.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      score: s.averageScore,
      hold: s.holdTimeSeconds,
    }));

  const poseSummaryMap: Record<string, { total: number; count: number }> = {};
  history.forEach((s) => {
    if (!poseSummaryMap[s.poseName]) {
      poseSummaryMap[s.poseName] = { total: 0, count: 0 };
    }
    poseSummaryMap[s.poseName].total += s.averageScore;
    poseSummaryMap[s.poseName].count += 1;
  });

  const poseSummaryData = Object.entries(poseSummaryMap).map(([name, data]) => ({
    name: name.replace(/\s*\(.*\)$/, ''),
    score: Math.round(data.total / data.count),
  }));

  const completedRoadmapCount = roadmap.filter((i) => i.completed).length;
  const roadmapPercentage = roadmap.length > 0 ? Math.round((completedRoadmapCount / roadmap.length) * 100) : 0;
  const carePlan = userData?.carePlan ?? [];
  const firstName = (userData?.name || '').split(' ')[0];

  return (
    <div className="screen">
      <TopBar here={0} steps={['Dashboard']} userName={userData?.name} />

      <div className="page">
        <div className="container container--wide stack stack--lg">
          <div className="page-header">
            <div className="page-header__text">
              <h1>{firstName ? `Welcome back, ${firstName}` : 'Dashboard'}</h1>
              <p className="page-subtitle">
                {count === 0
                  ? 'Run your first session to start tracking accuracy and hold times.'
                  : `${count} session${count === 1 ? '' : 's'} recorded. Keep your streak going.`}
              </p>
            </div>
            <button className="btn btn--primary" onClick={handleStartPractice}>
              <Plus size={16} />
              New session
            </button>
          </div>

          <div className="tabs" role="tablist">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                role="tab"
                aria-selected={activeTab === tab.id}
                className={`tab${activeTab === tab.id ? ' is-active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === 'dashboard' && (
            <div className="stack stack--lg fade-in">
              <div className="grid grid--4">
                <div className="stat">
                  <div>
                    <div className="stat__label">Daily streak</div>
                    <div className="stat__value">
                      {streak} <span className="text-sm muted">{streak === 1 ? 'day' : 'days'}</span>
                    </div>
                  </div>
                  <span className="stat__icon">
                    <Flame size={17} />
                  </span>
                </div>
                <div className="stat">
                  <div>
                    <div className="stat__label">Sessions</div>
                    <div className="stat__value">{count}</div>
                  </div>
                  <span className="stat__icon stat__icon--neutral">
                    <Activity size={17} />
                  </span>
                </div>
                <div className="stat">
                  <div>
                    <div className="stat__label">Average score</div>
                    <div className="stat__value">{avgScore}%</div>
                  </div>
                  <span className="stat__icon">
                    <Award size={17} />
                  </span>
                </div>
                <div className="stat">
                  <div>
                    <div className="stat__label">Needs attention</div>
                    <div className="stat__value" style={{ fontSize: 17, lineHeight: 1.4 }}>
                      {weakestArea}
                    </div>
                  </div>
                  <span className="stat__icon stat__icon--warn">
                    <Crosshair size={17} />
                  </span>
                </div>
              </div>

              <div className="grid grid--main-aside">
                <div className="stack">
                  {carePlan.length > 0 && (
                    <div className="card">
                      <div className="card__header">
                        <span className="card__title">
                          <HeartPulse size={15} className="muted" />
                          Prescribed plan
                        </span>
                        <span className="badge badge--brand">From your clinician</span>
                      </div>
                      <div className="card__body stack stack--sm">
                        {carePlan.map((item, idx) => (
                          <div key={idx} className="list-row" onClick={() => store.selectPose(item.poseId)}>
                            <div className="list-row__main">
                              <div className="list-row__title">{item.poseName || item.poseId}</div>
                              <div className="list-row__meta">
                                Hold {item.targetHold}s{item.frequency ? ` · ${item.frequency}` : ''}
                              </div>
                            </div>
                            <ChevronRight size={16} className="muted" />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="card">
                    <div className="card__header">
                      <span className="card__title">Recent sessions</span>
                      {count > 0 && <span className="text-xs muted">{count} total</span>}
                    </div>
                    <div className="card__body stack stack--sm">
                      {count === 0 ? (
                        <div className="empty">
                          <span className="empty__icon">
                            <Activity size={18} />
                          </span>
                          No sessions yet.
                          <button className="btn btn--secondary btn--sm" onClick={handleStartPractice}>
                            Start your first session
                          </button>
                        </div>
                      ) : (
                        history.slice(0, 8).map((session) => (
                          <div key={session.id} className="list-row" onClick={() => handleViewSession(session)}>
                            <div className={`grade grade--sm grade--${session.grade.toLowerCase()}`}>{session.grade}</div>
                            <div className="list-row__main">
                              <div className="list-row__title">{session.poseName}</div>
                              <div className="list-row__meta numeric">
                                {relativeDate(session.date)} · hold {session.holdTimeSeconds}s · {session.averageScore}%
                              </div>
                            </div>
                            <button
                              className="btn btn--icon is-danger"
                              onClick={(e) => handleDeleteSession(session.id, e)}
                              aria-label={`Delete ${session.poseName} session`}
                            >
                              <Trash2 size={15} />
                            </button>
                            <ChevronRight size={16} className="muted" />
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                <div className="stack">
                  <div className="card">
                    <div className="card__header">
                      <span className="card__title">Today's check-in</span>
                    </div>
                    <div className="card__body stack stack--sm">
                      {loggedPain ? (
                        <>
                          <div className="alert alert--neutral">{painRecommendation}</div>
                          <button className="btn btn--ghost btn--sm" onClick={() => setLoggedPain(false)}>
                            Log again
                          </button>
                        </>
                      ) : (
                        <>
                          <p className="text-sm secondary">
                            How stiff or sore do your joints feel right now? Your plan adapts to the answer.
                          </p>
                          <input
                            className="range"
                            type="range"
                            min={1}
                            max={10}
                            value={painLevel}
                            onChange={(e) => setPainLevel(Number(e.target.value))}
                            aria-label="Stiffness level"
                          />
                          <div className="row spread text-xs muted">
                            <span>1 · limber</span>
                            <span className="semibold" style={{ color: 'var(--text)' }}>
                              {painLevel}
                            </span>
                            <span>10 · very stiff</span>
                          </div>
                          <button className="btn btn--secondary btn--sm" onClick={handleLogPain}>
                            Save check-in
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="card">
                    <div className="card__header">
                      <span className="card__title">Today's plan</span>
                      <span className="text-xs muted numeric">{roadmapPercentage}%</span>
                    </div>
                    <div className="card__body stack stack--sm">
                      <div className="progress">
                        <div className="progress__bar" style={{ width: `${roadmapPercentage}%` }} />
                      </div>
                      {roadmap.map((item) => (
                        <button
                          key={item.id}
                          className={`task${item.completed ? ' is-done' : ''}`}
                          onClick={() => handleToggleRoadmapItem(item.id)}
                        >
                          <span className="task__check">✓</span>
                          <span className="task__label">{item.label}</span>
                          {item.type === 'pose' && <span className="badge badge--outline">Pose</span>}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="card">
                    <div className="card__body stack stack--sm">
                      <span className="card__title">Profile</span>
                      <p className="text-sm muted">
                        {userData?.age ? `${userData.age} years old · ` : ''}
                        {userData?.experience} · goal: {userData?.goal}
                      </p>
                      <div className="row row--sm">
                        <button className="btn btn--secondary btn--sm" onClick={() => store.setScreen('onboarding')}>
                          Edit profile
                        </button>
                        <button className="btn btn--danger btn--sm" onClick={handleResetProfile}>
                          <RotateCcw size={14} />
                          Reset
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'trends' && (
            <div className="stack stack--lg fade-in">
              {count === 0 ? (
                <div className="card">
                  <div className="empty">
                    <span className="empty__icon">
                      <Activity size={18} />
                    </span>
                    Trends appear once you've completed a session.
                    <button className="btn btn--secondary btn--sm" onClick={handleStartPractice}>
                      Start a session
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid--2">
                  <div className="card">
                    <div className="card__header">
                      <span className="card__title">Accuracy over time</span>
                    </div>
                    <div className="card__body" style={{ height: 280 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={trendData} margin={{ top: 12, right: 12, left: -12, bottom: 0 }}>
                          <CartesianGrid stroke="var(--border)" vertical={false} />
                          <XAxis dataKey="date" tickLine={false} axisLine={{ stroke: 'var(--border)' }} />
                          <YAxis domain={[0, 105]} ticks={[0, 25, 50, 75, 100]} tickLine={false} axisLine={false} width={40} />
                          <Tooltip formatter={(value: number) => [`${value}%`, 'Score']} />
                          <Line
                            type="monotone"
                            dataKey="score"
                            stroke="var(--brand-600)"
                            strokeWidth={2}
                            dot={{ r: 3, fill: 'var(--brand-600)', strokeWidth: 0 }}
                            activeDot={{ r: 5 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="card">
                    <div className="card__header">
                      <span className="card__title">Average score by pose</span>
                    </div>
                    <div className="card__body" style={{ height: 280 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={poseSummaryData} margin={{ top: 12, right: 12, left: -12, bottom: 0 }}>
                          <CartesianGrid stroke="var(--border)" vertical={false} />
                          <XAxis dataKey="name" tickLine={false} axisLine={{ stroke: 'var(--border)' }} interval={0} angle={-12} textAnchor="end" height={54} />
                          <YAxis domain={[0, 105]} ticks={[0, 25, 50, 75, 100]} tickLine={false} axisLine={false} width={40} />
                          <Tooltip formatter={(value: number) => [`${value}%`, 'Average']} cursor={{ fill: 'var(--gray-100)' }} />
                          <Bar dataKey="score" fill="var(--brand-500)" radius={[4, 4, 0, 0]} maxBarSize={48} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="card" style={{ gridColumn: '1 / -1' }}>
                    <div className="card__header">
                      <span className="card__title">All sessions</span>
                    </div>
                    <div className="table-wrap">
                      <table className="table">
                        <thead>
                          <tr>
                            <th>Date</th>
                            <th>Pose</th>
                            <th>Hold</th>
                            <th>Duration</th>
                            <th>Score</th>
                            <th>Grade</th>
                          </tr>
                        </thead>
                        <tbody>
                          {history.map((session) => (
                            <tr key={session.id} onClick={() => handleViewSession(session)} style={{ cursor: 'pointer' }}>
                              <td className="numeric muted">
                                {new Date(session.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                              </td>
                              <td className="semibold">{session.poseName}</td>
                              <td className="numeric">{session.holdTimeSeconds}s</td>
                              <td className="numeric">{session.durationSeconds}s</td>
                              <td className="numeric">{session.averageScore}%</td>
                              <td>
                                <span className={`badge ${session.grade === 'A' ? 'badge--success' : session.grade === 'F' ? 'badge--danger' : 'badge--outline'}`}>
                                  {session.grade}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'consult' && (
            <div className="grid fade-in" style={{ gridTemplateColumns: 'minmax(0, 280px) minmax(0, 1fr)', alignItems: 'start' }}>
              <div className="card">
                <div className="card__header">
                  <span className="card__title">Coaches</span>
                </div>
                <div className="card__body stack stack--sm">
                  {COACHES.map((coach) => (
                    <button
                      key={coach.id}
                      className={`list-row${selectedCoachId === coach.id ? ' is-selected' : ''}`}
                      onClick={() => setSelectedCoachId(coach.id)}
                    >
                      <span className="avatar">
                        <span className="avatar-initials">{coach.name[0]}</span>
                      </span>
                      <div className="list-row__main">
                        <div className="list-row__title">{coach.name}</div>
                        <div className="list-row__meta">{coach.role}</div>
                      </div>
                    </button>
                  ))}
                  <p className="hint" style={{ marginTop: 4 }}>
                    {activeCoach.bio}
                  </p>
                </div>
              </div>

              <div className="card" style={{ display: 'flex', flexDirection: 'column', height: 'min(72vh, 680px)' }}>
                <div className="card__header">
                  <span className="card__title">
                    <span className="avatar">
                      <span className="avatar-initials">{activeCoach.name[0]}</span>
                    </span>
                    {activeCoach.name}
                  </span>
                  <button
                    className="btn btn--ghost btn--sm"
                    onClick={() =>
                      setChats((prev) => ({ ...prev, [selectedCoachId]: prev[selectedCoachId].slice(0, 1) }))
                    }
                  >
                    Clear chat
                  </button>
                </div>

                <div className="chat" style={{ flex: 1 }}>
                  {(chats[selectedCoachId] || []).map((message, idx) => (
                    <div key={idx} className={`bubble bubble--${message.sender}`}>
                      {message.text}
                    </div>
                  ))}
                  {isTyping && (
                    <div className="bubble bubble--coach row row--sm muted">
                      <span className="spinner" />
                      Thinking
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>

                <form className="card__footer row row--sm" onSubmit={handleSendMessage}>
                  <input
                    className="input"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder={`Ask ${activeCoach.name} about your practice…`}
                    maxLength={2000}
                  />
                  <button className="btn btn--primary" type="submit" disabled={isTyping || !inputText.trim()}>
                    <Send size={15} />
                    Send
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
