import { useState } from 'react';
import { Download, Loader2, ShieldCheck, Trash2 } from 'lucide-react';
import { apiFetch } from '../utils/api';
import { setSavedUser } from '../utils/auth';

const CONFIRM_WORD = 'DELETE';

/** "Your data" block: take it with you, or remove it entirely. */
export function AccountData() {
  const [busy, setBusy] = useState<'export' | 'delete' | null>(null);
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState('');

  const handleExport = async () => {
    setBusy('export');
    setError('');
    try {
      const res = await apiFetch('/api/users/me/export');
      if (!res.ok) throw new Error('Could not prepare your data right now.');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `physioalign-data-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setError(e.message || 'Could not prepare your data right now.');
    } finally {
      setBusy(null);
    }
  };

  const handleDelete = async () => {
    setBusy('delete');
    setError('');
    try {
      const res = await apiFetch('/api/users/me', { method: 'DELETE' });
      if (!res.ok && res.status !== 204) throw new Error('Could not delete the account. Please try again.');
      setSavedUser(null);
      window.location.href = '/';
    } catch (e: any) {
      setError(e.message || 'Could not delete the account. Please try again.');
      setBusy(null);
    }
  };

  return (
    <div className="plush" style={{ background: 'var(--surface)', padding: '20px 22px' }}>
      <h3 style={{ fontSize: 17, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <ShieldCheck size={18} /> Your data
      </h3>
      <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-soft)', marginBottom: 16, lineHeight: 1.5 }}>
        Camera video is never uploaded — only the per-second scores and joint angles behind your reports. You can take a
        copy of everything we store, or delete the lot.
      </p>

      {error && (
        <div
          style={{
            background: '#FFEAE6',
            border: '2.5px solid var(--line)',
            borderRadius: 'var(--r-sm)',
            padding: '10px 14px',
            fontSize: 13,
            fontWeight: 800,
            marginBottom: 14,
          }}
        >
          {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button className="btn-plush ghost sm tap" onClick={handleExport} disabled={busy !== null}>
          {busy === 'export' ? <Loader2 size={15} className="spin" /> : <Download size={15} />}
          Download my data
        </button>

        {!confirming ? (
          <button className="btn-plush danger sm tap" onClick={() => setConfirming(true)} disabled={busy !== null}>
            <Trash2 size={15} />
            Delete my account
          </button>
        ) : null}
      </div>

      {confirming && (
        <div
          style={{
            marginTop: 14,
            padding: 14,
            border: '2.5px solid var(--line)',
            borderRadius: 'var(--r-sm)',
            background: 'var(--cream)',
          }}
        >
          <p style={{ fontSize: 13, fontWeight: 800, marginBottom: 10 }}>
            This removes your profile and every session, for good. Type <code>{CONFIRM_WORD}</code> to confirm.
          </p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              aria-label={`Type ${CONFIRM_WORD} to confirm`}
              placeholder={CONFIRM_WORD}
              style={{
                border: '2.5px solid var(--line)',
                borderRadius: 'var(--r-sm)',
                padding: '8px 12px',
                fontFamily: 'inherit',
                fontWeight: 800,
                fontSize: 13,
                background: 'var(--surface)',
                color: 'var(--ink)',
                width: 140,
              }}
            />
            <button
              className="btn-plush danger sm tap"
              disabled={typed.trim().toUpperCase() !== CONFIRM_WORD || busy !== null}
              onClick={handleDelete}
            >
              {busy === 'delete' ? <Loader2 size={15} className="spin" /> : <Trash2 size={15} />}
              Delete everything
            </button>
            <button
              className="btn-plush ghost sm tap"
              onClick={() => {
                setConfirming(false);
                setTyped('');
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
