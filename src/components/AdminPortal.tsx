import { useState, useEffect } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { store, useUserData } from '../game/store';
import { TopBar, Doodle } from './primitives';
import { 
  Shield, 
  Database, 
  Trash2, 
  Activity, 
  User, 
  Stethoscope, 
  Cpu,
  Search
} from 'lucide-react';

interface SystemStats {
  totalUsers: number;
  patients: number;
  doctors: number;
  sessions: number;
  dbEngine: string;
  dbSize: string;
  uptime: string;
}

interface UserRow {
  clerk_id: string;
  name: string;
  email: string;
  age: number;
  experience: string;
  goal: string;
  role: 'patient' | 'doctor' | 'admin';
  doctor_id?: string | null;
}

export function AdminPortal() {
  const adminData = useUserData();
  const { userId } = useAuth();

  const [stats, setStats] = useState<SystemStats>({
    totalUsers: 0,
    patients: 0,
    doctors: 0,
    sessions: 0,
    dbEngine: 'SQLite (Local File)',
    dbSize: '0.00 MB',
    uptime: '0s'
  });
  const [users, setUsers] = useState<UserRow[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchAdminData = async () => {
    try {
      setLoading(true);
      const [statsRes, usersRes] = await Promise.all([
        fetch('/api/admin/stats'),
        fetch('/api/admin/users')
      ]);
      
      if (statsRes.ok && usersRes.ok) {
        const statsData = await statsRes.json();
        const usersData = await usersRes.json();
        setStats(statsData);
        setUsers(usersData);
      }
    } catch (e) {
      console.error('Failed to fetch administrator dashboard data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/admin/stats');
        if (res.ok) {
          const statsData = await res.json();
          setStats(statsData);
        }
      } catch (e) {}
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleChangeRole = async (clerkId: string, newRole: 'patient' | 'doctor' | 'admin') => {
    try {
      setUpdatingId(clerkId);
      const res = await fetch(`/api/admin/users/${clerkId}/role`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole })
      });
      if (res.ok) {
        if (clerkId === userId && store.getState().userData) {
          store.getState().userData!.role = newRole;
          store.setScreen(newRole === 'doctor' ? 'doctor' : newRole === 'admin' ? 'admin' : 'dashboard');
        }
        await fetchAdminData();
      } else {
        alert('Failed to update role');
      }
    } catch (e) {
      console.error(e);
      alert('Role change error');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleAssignDoctor = async (patientClerkId: string, doctorClerkId: string) => {
    try {
      setUpdatingId(patientClerkId);
      const res = await fetch(`/api/admin/users/${patientClerkId}/doctor`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ doctorId: doctorClerkId || null })
      });
      if (res.ok) {
        await fetchAdminData();
      } else {
        alert('Failed to assign doctor');
      }
    } catch (e) {
      console.error(e);
      alert('Error assigning doctor');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDeleteUser = async (clerkId: string, name: string) => {
    if (clerkId === userId) {
      alert('You cannot delete your own active admin account!');
      return;
    }
    if (!window.confirm(`Are you sure you want to permanently delete user "${name}"?\nThis will erase their profile and workout logs. This action is irreversible.`)) {
      return;
    }
    
    try {
      setUpdatingId(clerkId);
      const res = await fetch(`/api/admin/users/${clerkId}`, { method: 'DELETE' });
      if (res.ok) {
        await fetchAdminData();
      } else {
        alert('Failed to delete user');
      }
    } catch (e) {
      console.error(e);
      alert('Delete user error');
    } finally {
      setUpdatingId(null);
    }
  };

  const filteredUsers = users.filter(u => 
    u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (u.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.role.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="screen dots-bg" style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: 'var(--cream)' }}>
      <TopBar here={0} steps={['System Administrator Dashboard']} userName={adminData?.name} showProfile={true} />

      <main style={{ maxWidth: 1200, width: '100%', margin: '24px auto', padding: '0 24px', display: 'flex', flexDirection: 'column', gap: 24, flex: 1 }}>
        
        <div className="plush" style={{ padding: '24px 28px', background: 'white', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', right: 20, top: -10, opacity: 0.15 }} className="wobble">
            <Doodle kind="star" size={120} color="var(--peach)" />
          </div>
          
          <h1 style={{ fontSize: 36, color: 'var(--ink)' }}>
            System Access Control
          </h1>
          <p style={{ fontSize: 16, color: 'var(--ink-2)', marginTop: 6, fontWeight: 700, maxWidth: 640 }}>
            Supervisor Terminal. Configure system-wide access privileges, view database diagnostics, and manage tenant records.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 20 }}>
          
          <div className="plush" style={{ padding: '20px 22px', background: 'white', display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ background: 'var(--mint)', border: '2.5px solid var(--line)', padding: 12, borderRadius: 12, display: 'flex', color: 'var(--ink)' }}>
              <Database size={24} />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 900, color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>SQL Database Engine</div>
              <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--ink)', marginTop: 4 }}>{stats.dbEngine}</div>
            </div>
          </div>

          <div className="plush" style={{ padding: '20px 22px', background: 'white', display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ background: 'var(--butter)', border: '2.5px solid var(--line)', padding: 12, borderRadius: 12, display: 'flex', color: 'var(--ink)' }}>
              <Shield size={24} />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 900, color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Directory Database Size</div>
              <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--ink)', marginTop: 4 }}>{stats.dbSize}</div>
            </div>
          </div>

          <div className="plush" style={{ padding: '20px 22px', background: 'white', display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ background: 'var(--peach)', border: '2.5px solid var(--line)', padding: 12, borderRadius: 12, display: 'flex', color: 'var(--ink)' }}>
              <Activity size={24} />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 900, color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Workouts Logged</div>
              <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--ink)', marginTop: 4 }}>{stats.sessions} sessions</div>
            </div>
          </div>

          <div className="plush" style={{ padding: '20px 22px', background: 'white', display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ background: '#EAFCEF', border: '2.5px solid var(--line)', padding: 12, borderRadius: 12, display: 'flex', color: 'var(--ink)' }}>
              <Cpu size={24} style={{ color: '#10B981' }} />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 900, color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Process Uptime</div>
              <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--ink)', marginTop: 4 }}>{stats.uptime}</div>
            </div>
          </div>
        </div>

        <div className="plush" style={{ background: 'white', padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
            <div>
              <h3 style={{ fontSize: 20, fontWeight: 900, color: 'var(--ink)', margin: 0 }}>Registered User Accounts</h3>
              <p style={{ fontSize: 13, color: 'var(--ink-soft)', margin: '4px 0 0', fontWeight: 800 }}>
                Patients: {stats.patients} • Doctors: {stats.doctors} • Admins: {stats.totalUsers - stats.patients - stats.doctors}
              </p>
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
                placeholder="Search name, email, or role..."
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
              Loading user directory logs...
            </div>
          ) : filteredUsers.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', border: '3.5px dashed var(--line)', borderRadius: 16, fontSize: 14, fontWeight: 800, color: 'var(--ink-soft)' }}>
              No accounts match your query parameters.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14, textAlign: 'left', minWidth: 600 }}>
                <thead>
                  <tr style={{ borderBottom: '3px solid var(--line)', color: 'var(--ink-soft)', fontWeight: 900 }}>
                    <th style={{ padding: '12px 8px' }}>User Details</th>
                    <th style={{ padding: '12px 8px' }}>Clerk ID</th>
                    <th style={{ padding: '12px 8px' }}>Demographics</th>
                    <th style={{ padding: '12px 8px' }}>Access Role</th>
                    <th style={{ padding: '12px 8px' }}>Assigned Doctor</th>
                    <th style={{ padding: '12px 8px', textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map(u => (
                    <tr 
                      key={u.clerk_id}
                      style={{ 
                        borderBottom: '1.5px dashed var(--line)', 
                        fontWeight: 800, 
                        opacity: updatingId === u.clerk_id ? 0.5 : 1,
                        background: u.clerk_id === userId ? '#F6FFF8' : 'transparent'
                      }}
                    >
                      <td style={{ padding: '14px 8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{
                            width: 36,
                            height: 36,
                            borderRadius: '50%',
                            border: '2px solid var(--line)',
                            background: u.role === 'admin' ? 'var(--peach)' : u.role === 'doctor' ? 'var(--mint)' : 'white',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}>
                            {u.role === 'admin' ? <Shield size={16} /> : u.role === 'doctor' ? <Stethoscope size={16} /> : <User size={16} />}
                          </div>
                          <div>
                            <div style={{ color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: 6 }}>
                              {u.name}
                              {u.clerk_id === userId && (
                                <span style={{ fontSize: 9, background: 'var(--mint)', border: '1.5px solid var(--line)', padding: '1px 6px', borderRadius: 4, textTransform: 'uppercase' }}>You</span>
                              )}
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--ink-soft)', fontWeight: 700 }}>{u.email}</div>
                          </div>
                        </div>
                      </td>
                      
                      <td style={{ padding: '14px 8px', fontSize: 11, fontFamily: 'monospace', color: 'var(--ink-soft)' }}>
                        {u.clerk_id}
                      </td>

                      <td style={{ padding: '14px 8px', fontSize: 12, color: 'var(--ink-soft)' }}>
                        {u.role === 'patient' ? (
                          <span>{u.age} y/o • {u.experience} • {u.goal}</span>
                        ) : (
                          <span style={{ fontStyle: 'italic' }}>Staff profile</span>
                        )}
                      </td>

                      <td style={{ padding: '14px 8px' }}>
                        <select
                          value={u.role}
                          disabled={updatingId === u.clerk_id}
                          onChange={(e) => handleChangeRole(u.clerk_id, e.target.value as any)}
                          style={{
                            padding: '6px 10px',
                            border: '2px solid var(--line)',
                            borderRadius: 'var(--r-sm)',
                            background: u.role === 'admin' ? 'var(--peach)' : u.role === 'doctor' ? 'var(--mint)' : 'white',
                            fontFamily: 'inherit',
                            fontWeight: 800,
                            fontSize: 12,
                            cursor: 'pointer',
                            outline: 'none'
                          }}
                        >
                          <option value="patient">Patient</option>
                          <option value="doctor">Doctor</option>
                          <option value="admin">Admin</option>
                        </select>
                      </td>

                      <td style={{ padding: '14px 8px' }}>
                        {u.role === 'patient' ? (
                          <select
                            value={u.doctor_id || ''}
                            disabled={updatingId === u.clerk_id}
                            onChange={(e) => handleAssignDoctor(u.clerk_id, e.target.value)}
                            style={{
                              padding: '6px 10px',
                              border: '2px solid var(--line)',
                              borderRadius: 'var(--r-sm)',
                              background: 'white',
                              fontFamily: 'inherit',
                              fontWeight: 800,
                              fontSize: 12,
                              cursor: 'pointer',
                              outline: 'none'
                            }}
                          >
                            <option value="">No Doctor Assigned</option>
                            {users.filter(usr => usr.role === 'doctor').map(doc => (
                              <option key={doc.clerk_id} value={doc.clerk_id}>Dr. {doc.name}</option>
                            ))}
                          </select>
                        ) : (
                          <span style={{ fontSize: 12, color: 'var(--ink-soft)', fontStyle: 'italic' }}>Staff (N/A)</span>
                        )}
                      </td>

                      <td style={{ padding: '14px 8px', textAlign: 'center' }}>
                        <button
                          onClick={() => handleDeleteUser(u.clerk_id, u.name)}
                          disabled={updatingId === u.clerk_id || u.clerk_id === userId}
                          style={{
                            border: '2px solid var(--line)',
                            background: u.clerk_id === userId ? '#F1F5F9' : '#FFEAE6',
                            color: u.clerk_id === userId ? 'var(--ink-soft)' : '#FF6B4A',
                            padding: '8px',
                            borderRadius: 10,
                            cursor: u.clerk_id === userId ? 'not-allowed' : 'pointer',
                            display: 'inline-flex',
                            boxShadow: u.clerk_id === userId ? 'none' : '2px 2px 0 var(--line)',
                            transition: 'transform 0.1s'
                          }}
                          className={u.clerk_id === userId ? '' : 'tap'}
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
