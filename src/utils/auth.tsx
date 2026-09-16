import { useState, useEffect, useMemo } from 'react';

// Global authentication state listeners
let listeners: Array<() => void> = [];
const subscribe = (listener: () => void) => {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter(l => l !== listener);
  };
};
const notify = () => {
  listeners.forEach(l => l());
};

// Local storage helpers
export const getSavedUser = () => {
  try {
    const saved = localStorage.getItem('physioalign:google_user');
    const user = saved ? JSON.parse(saved) : null;
    // sessions saved before tokens existed can't talk to the api anymore
    return user?.token ? user : null;
  } catch {
    return null;
  }
};

export const setSavedUser = (user: any) => {
  if (user) {
    localStorage.setItem('physioalign:google_user', JSON.stringify(user));
    localStorage.setItem('physioalign:is_signed_in', 'true');
  } else {
    localStorage.removeItem('physioalign:google_user');
    localStorage.removeItem('physioalign:is_signed_in');
  }
  notify();
};

type AuthResponse = {
  user: { clerk_id?: string; id?: string; name: string; email: string; picture?: string };
  token: string;
};

const saveAuthResponse = (data: AuthResponse) => {
  const { user, token } = data;
  setSavedUser({
    id: user.clerk_id || user.id,
    name: user.name,
    email: user.email,
    picture: user.picture || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(user.name)}`,
    token,
  });
};

const postAuth = async (url: string, body: object, fallbackError: string) => {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || fallbackError);
  }

  saveAuthResponse(data);
  return data.user;
};

export const signInWithEmailPassword = (email: string, password: string) =>
  postAuth('/api/auth/login', { email, password }, 'Failed to sign in');

export const signUpWithEmailPassword = (name: string, email: string, password: string, role: string) =>
  postAuth('/api/auth/signup', { name, email, password, role }, 'Failed to sign up');

// the credential is checked by the backend, we don't trust the decoded token here
export const signInWithGoogle = (credential: string) =>
  postAuth('/api/auth/google', { credential }, 'Google sign-in failed');

export function useAuth() {
  const [user, setUser] = useState(getSavedUser);

  useEffect(() => {
    return subscribe(() => {
      setUser(getSavedUser());
    });
  }, []);

  const signOut = () => {
    setSavedUser(null);
    sessionStorage.removeItem('physioalign:session_active');
    window.location.reload(); // Hard refresh to clear state
  };

  return {
    isLoaded: true,
    isSignedIn: !!user,
    userId: user ? user.id : null,
    signOut
  };
}

export function useUser() {
  const [user, setUser] = useState(getSavedUser);

  useEffect(() => {
    return subscribe(() => {
      setUser(getSavedUser());
    });
  }, []);

  const clerkFormattedUser = useMemo(() => {
    return user ? {
      id: user.id,
      fullName: user.name,
      firstName: user.name ? user.name.split(' ')[0] : '',
      imageUrl: user.picture,
      primaryEmailAddress: {
        emailAddress: user.email
      }
    } : null;
  }, [user]);

  return {
    isLoaded: true,
    isSignedIn: !!user,
    user: clerkFormattedUser
  };
}

export function UserButton(_props?: any) {
  const { user } = useUser();
  const { signOut } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  if (!user) return null;

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="tap"
        style={{
          width: 40,
          height: 40,
          borderRadius: '50%',
          border: '2.5px solid var(--line)',
          overflow: 'hidden',
          cursor: 'pointer',
          padding: 0,
          boxShadow: '0 2.5px 0 var(--line)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'white'
        }}
      >
        <img src={user.imageUrl} alt={user.fullName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </button>
      {isOpen && (
        <div style={{
          position: 'absolute',
          right: 0,
          top: 48,
          background: 'white',
          border: '3px solid var(--line)',
          borderRadius: '12px',
          padding: '16px',
          boxShadow: '4px 4px 0 var(--line)',
          zIndex: 1000,
          minWidth: 200,
          fontFamily: 'Nunito',
          textAlign: 'left'
        }}>
          <div style={{ fontWeight: 900, fontSize: 14, color: 'var(--ink)' }}>{user.fullName}</div>
          <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginBottom: 8, wordBreak: 'break-all' }}>{user.primaryEmailAddress.emailAddress}</div>
          <hr style={{ border: 'none', borderTop: '2px solid var(--line)', margin: '8px 0' }} />
          <button 
            onClick={signOut}
            className="tap"
            style={{
              width: '100%',
              background: 'var(--peach)',
              border: '2px solid var(--line)',
              borderRadius: '8px',
              padding: '8px 12px',
              fontWeight: 800,
              fontSize: 12,
              cursor: 'pointer',
              boxShadow: '0 2px 0 var(--line)',
              color: 'var(--ink)',
              textAlign: 'center'
            }}
          >
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
}
