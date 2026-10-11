import { useEffect, useState } from 'react';
import { CloudOff, WifiOff } from 'lucide-react';
import { onApiTrouble } from '../utils/api';

/**
 * One line at the top of the app when the browser is offline or the API has
 * stopped answering, so a failed action doesn't look like a frozen screen.
 */
export function ConnectionBanner() {
  const [offline, setOffline] = useState(() => typeof navigator !== 'undefined' && !navigator.onLine);
  const [apiDown, setApiDown] = useState(false);

  useEffect(() => {
    const goOffline = () => setOffline(true);
    const goOnline = () => {
      setOffline(false);
      setApiDown(false);
    };
    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);
    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
    };
  }, []);

  useEffect(() => {
    const unsubscribe = onApiTrouble((down) => setApiDown(down));
    return () => {
      unsubscribe();
    };
  }, []);

  if (!offline && !apiDown) return null;

  return (
    <div
      role="status"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 3000,
        background: offline ? 'var(--butter)' : 'var(--rose)',
        borderBottom: '2.5px solid var(--line)',
        padding: '8px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        fontSize: 13.5,
        fontWeight: 800,
        color: 'var(--ink)',
      }}
    >
      {offline ? <WifiOff size={16} /> : <CloudOff size={16} />}
      {offline
        ? "You're offline. Pose tracking still works; sessions will save once you're back."
        : "Can't reach the server right now. We'll keep trying."}
    </div>
  );
}
