import { getSavedUser, setSavedUser } from './auth';

// fetch wrapper that sends the session token and logs out if it's rejected
export async function apiFetch(url: string, options: RequestInit = {}) {
  const token = getSavedUser()?.token;
  const headers = new Headers(options.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (options.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');

  const res = await fetch(url, { ...options, headers });
  if (res.status === 401 && token) {
    setSavedUser(null);
    window.location.reload();
  }
  return res;
}
