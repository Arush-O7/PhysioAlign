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
    // only display info lives here. the real session is the httpOnly cookie
    return user?.id ? user : null;
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
  user: { id: string; name: string; email: string; picture?: string };
};

const saveAuthResponse = ({ user }: AuthResponse) => {
  setSavedUser({
    id: user.id,
    name: user.name,
    email: user.email,
    picture: user.picture || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(user.name)}`,
  });
};

const postAuth = async (url: string, body: object, fallbackError: string) => {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'fetch' },
    credentials: 'same-origin',
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

  const signOut = async () => {
    // the cookie is httpOnly, so only the server can clear it
    await fetch('/api/auth/logout', {
      method: 'POST',
      headers: { 'X-Requested-With': 'fetch' },
      credentials: 'same-origin',
    }).catch(() => {});
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
