import { useState, useEffect } from 'react';
import { useAuth } from '../utils/auth';
import { apiFetch } from '../utils/api';
import { store, useUserData } from '../game/store';
import { TopBar } from './primitives';
import { Activity, Clock, Database, Search, Shield, Stethoscope, Trash2, User, Users } from 'lucide-react';

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
  id: string;
  name: string;
  email: string;
  age: number;
  experience: string;
  goal: string;
  role: 'patient' | 'doctor' | 'admin';
  doctorId?: string | null;
  approved?: boolean;
}

const ROLE_ICON = {
  admin: Shield,
  doctor: Stethoscope,
  patient: User,
} as const;

export function AdminPortal() {
  const adminData = useUserData();
  const { userId } = useAuth();

  const [stats, setStats] = useState<SystemStats>({
    totalUsers: 0,
    patients: 0,
    doctors: 0,
    sessions: 0,
    dbEngine: 'PostgreSQL',
    dbSize: '—',
    uptime: '0s',
  });
  const [users, setUsers] = useState<UserRow[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchAdminData = async () => {
    try {
      setLoading(true);
      const [statsRes, usersRes] = await Promise.all([apiFetch('/api/admin/stats'), apiFetch('/api/admin/users')]);

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
        const res = await apiFetch('/api/admin/stats');
        if (res.ok) {
          const statsData = await res.json();
          setStats(statsData);
        }
      } catch (e) {}
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleChangeRole = async (targetId: string, newRole: 'patient' | 'doctor' | 'admin') => {
    try {
      setUpdatingId(targetId);
      const res = await apiFetch(`/api/admin/users/${targetId}/role`, {
        method: 'PUT',
        body: JSON.stringify({ role: newRole }),
      });
      if (res.ok) {
        const currentUser = store.getState().userData;
        if (targetId === userId && currentUser) {
          store.setUserData({ ...currentUser, role: newRole });
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

  const handleApproveDoctor = async (targetId: string) => {
    try {
      setUpdatingId(targetId);
      const res = await apiFetch(`/api/admin/users/${targetId}/approve`, { method: 'POST' });
      if (res.ok) {
        await fetchAdminData();
      } else {
        alert('Failed to approve clinician');
      }
    } catch (e) {
      console.error(e);
      alert('Error approving clinician');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleAssignDoctor = async (patientId: string, doctorId: string) => {
    try {
      setUpdatingId(patientId);
      const res = await apiFetch(`/api/admin/users/${patientId}/doctor`, {
        method: 'PUT',
        body: JSON.stringify({ doctorId: doctorId || null }),
      });
      if (res.ok) {
        await fetchAdminData();
      } else {
        alert('Failed to assign clinician');
      }
    } catch (e) {
      console.error(e);
      alert('Error assigning clinician');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDeleteUser = async (targetId: string, name: string) => {
    if (targetId === userId) {
      alert("You can't delete your own account.");
      return;
    }
    if (!window.confirm(`Delete "${name}"? Their profile and every session they recorded will be removed. This cannot be undone.`)) {
      return;
    }

    try {
      setUpdatingId(targetId);
      const res = await apiFetch(`/api/admin/users/${targetId}`, { method: 'DELETE' });
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

  const filteredUsers = users.filter(
    (u) =>
      u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.role.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const pendingDoctors = users.filter((u) => u.role === 'doctor' && u.approved === false).length;
  const approvedDoctors = users.filter((u) => u.role === 'doctor' && u.approved !== false);

  return (
    <div className="screen">
      <TopBar here={0} steps={['Administration']} userName={adminData?.name} />

      <div className="page">
        <div className="container container--wide stack stack--lg">
          <div className="page-header">
            <div className="page-header__text">
              <h1>Administration</h1>
              <p className="page-subtitle">Manage accounts, approve clinicians and assign patients to them.</p>
            </div>
            <div className="row row--sm text-xs muted">
              <Database size={14} />
              {stats.dbEngine} · {stats.dbSize} · up {stats.uptime}
            </div>
          </div>

          {pendingDoctors > 0 && (
            <div className="alert alert--warn">
              <Clock size={16} className="alert__icon" />
              <span>
                {pendingDoctors} clinician account{pendingDoctors === 1 ? '' : 's'} waiting for approval. They can't see patient
                data until approved.
              </span>
            </div>
          )}

          <div className="grid grid--4">
            <div className="stat">
              <div>
                <div className="stat__label">Total users</div>
                <div className="stat__value">{stats.totalUsers}</div>
              </div>
              <span className="stat__icon">
                <Users size={17} />
              </span>
            </div>
            <div className="stat">
              <div>
                <div className="stat__label">Patients</div>
                <div className="stat__value">{stats.patients}</div>
              </div>
              <span className="stat__icon stat__icon--neutral">
                <User size={17} />
              </span>
            </div>
            <div className="stat">
              <div>
                <div className="stat__label">Clinicians</div>
                <div className="stat__value">{stats.doctors}</div>
                {pendingDoctors > 0 && <div className="stat__meta">{pendingDoctors} pending</div>}
              </div>
              <span className="stat__icon stat__icon--neutral">
                <Stethoscope size={17} />
              </span>
            </div>
            <div className="stat">
              <div>
                <div className="stat__label">Sessions recorded</div>
                <div className="stat__value">{stats.sessions}</div>
              </div>
              <span className="stat__icon">
                <Activity size={17} />
              </span>
            </div>
          </div>

          <div className="card">
            <div className="card__header">
              <span className="card__title">Accounts</span>
              <div className="input-group" style={{ width: 260 }}>
                <span className="input-group__icon">
                  <Search size={15} />
                </span>
                <input
                  className="input"
                  placeholder="Search name, email or role"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            {loading ? (
              <div className="card__body stack stack--sm">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="skeleton" style={{ height: 44 }} />
                ))}
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="empty">No accounts match your search.</div>
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Details</th>
                      <th>Role</th>
                      <th>Assigned clinician</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((u) => {
                      const RoleIcon = ROLE_ICON[u.role] ?? User;
                      const isSelf = u.id === userId;
                      const isPending = u.role === 'doctor' && u.approved === false;
                      return (
                        <tr key={u.id} className={`${isSelf ? 'is-self' : ''}${updatingId === u.id ? ' is-updating' : ''}`}>
                          <td>
                            <div className="row row--sm">
                              <span className="avatar">
                                <span className="avatar-initials">
                                  <RoleIcon size={15} />
                                </span>
                              </span>
                              <div>
                                <div className="row row--sm">
                                  <span className="semibold">{u.name}</span>
                                  {isSelf && <span className="badge badge--outline">You</span>}
                                  {isPending && <span className="badge badge--warn">Pending</span>}
                                </div>
                                <div className="text-xs muted">{u.email}</div>
                              </div>
                            </div>
                          </td>
                          <td className="text-xs muted">
                            {u.role !== 'patient'
                              ? 'Staff account'
                              : u.age
                                ? `${u.age} years · ${u.experience} · ${u.goal}`
                                : 'Profile not completed'}
                          </td>
                          <td>
                            <select
                              className="select"
                              style={{ width: 130, height: 32 }}
                              value={u.role}
                              disabled={updatingId === u.id}
                              onChange={(e) => handleChangeRole(u.id, e.target.value as UserRow['role'])}
                              aria-label={`Role for ${u.name}`}
                            >
                              <option value="patient">Patient</option>
                              <option value="doctor">Clinician</option>
                              <option value="admin">Admin</option>
                            </select>
                          </td>
                          <td>
                            {u.role === 'patient' ? (
                              <select
                                className="select"
                                style={{ width: 190, height: 32 }}
                                value={u.doctorId || ''}
                                disabled={updatingId === u.id}
                                onChange={(e) => handleAssignDoctor(u.id, e.target.value)}
                                aria-label={`Clinician for ${u.name}`}
                              >
                                <option value="">Unassigned</option>
                                {approvedDoctors.map((doc) => (
                                  <option key={doc.id} value={doc.id}>
                                    {doc.name}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <span className="muted text-xs">—</span>
                            )}
                          </td>
                          <td>
                            <div className="row row--sm" style={{ justifyContent: 'flex-end' }}>
                              {isPending && (
                                <button
                                  className="btn btn--secondary btn--sm"
                                  disabled={updatingId === u.id}
                                  onClick={() => handleApproveDoctor(u.id)}
                                >
                                  Approve
                                </button>
                              )}
                              <button
                                className="btn btn--icon is-danger"
                                disabled={updatingId === u.id || isSelf}
                                onClick={() => handleDeleteUser(u.id, u.name)}
                                aria-label={`Delete ${u.name}`}
                                title={isSelf ? "You can't delete your own account" : 'Delete account'}
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
