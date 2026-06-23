import { useState, useEffect } from 'react';

// Decodes a JWT token returned by Google Identity Services
export const decodeJwt = (token: string) => {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    return JSON.parse(jsonPayload);
  } catch (e) {
    return null;
  }
};

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
  const saved = localStorage.getItem('physioalign:google_user');
  return saved ? JSON.parse(saved) : null;
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

export const signInWithEmailPassword = async (email: string, password: string) => {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Failed to sign in');
  }

  setSavedUser({
    id: data.clerk_id,
    name: data.name,
    email: data.email,
    picture: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(data.name)}`
  });

  return data;
};

export const signUpWithEmailPassword = async (name: string, email: string, password: string, role: string) => {
  const response = await fetch('/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password, role })
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Failed to sign up');
  }

  setSavedUser({
    id: data.clerk_id,
    name: data.name,
    email: data.email,
    picture: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(data.name)}`
  });

  return data;
};

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

  const clerkFormattedUser = user ? {
    id: user.id,
    fullName: user.name,
    firstName: user.name ? user.name.split(' ')[0] : '',
    imageUrl: user.picture,
    primaryEmailAddress: {
      emailAddress: user.email
    }
  } : null;

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
