import { Clock } from 'lucide-react';
import { useAuth } from '../utils/auth';
import { PhysioLogo } from './primitives';

export function PendingApprovalScreen() {
  const { signOut } = useAuth();

  return (
    <div className="screen screen--centered">
      <div className="card card--raised fade-in" style={{ maxWidth: 440, width: '100%' }}>
        <div className="card__body stack">
          <div className="row spread">
            <PhysioLogo size={28} />
            <span className="badge badge--warn">
              <Clock size={12} />
              Pending review
            </span>
          </div>
          <div>
            <h1 style={{ fontSize: 20 }}>Your clinician account is awaiting approval</h1>
            <p className="text-sm secondary" style={{ marginTop: 6 }}>
              An administrator needs to approve the account before you can see patient data. You'll be able to sign in to the
              clinician portal as soon as that's done.
            </p>
          </div>
          <div className="alert alert--neutral">
            Nothing to do for now — check back after an administrator has reviewed your request.
          </div>
          <button className="btn btn--secondary" onClick={signOut} style={{ alignSelf: 'flex-start' }}>
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
