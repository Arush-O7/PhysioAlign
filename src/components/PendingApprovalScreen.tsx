import { useAuth } from '../utils/auth';
import { PhysioLogo, Wordmark } from './primitives';

export function PendingApprovalScreen() {
  const { signOut } = useAuth();

  return (
    <div className="screen dots-bg" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: 24 }}>
      <div className="plush popin" style={{ background: 'white', padding: '36px 32px', maxWidth: 440, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
        <PhysioLogo size={70} />
        <Wordmark size={30} />
        <h2 style={{ fontSize: 22, fontWeight: 900, color: 'var(--ink)', margin: 0 }}>Waiting for approval</h2>
        <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink-soft)', margin: 0, lineHeight: 1.5 }}>
          Your clinician account has been created. An admin needs to approve it before you can see patient data.
          Check back once you've heard from them.
        </p>
        <button onClick={signOut} className="btn-plush ghost" style={{ padding: '10px 24px', fontSize: 15 }}>
          Sign out
        </button>
      </div>
    </div>
  );
}
