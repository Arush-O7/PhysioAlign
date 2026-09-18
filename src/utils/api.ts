import { getSavedUser, setSavedUser } from './auth';

// the session lives in an httpOnly cookie that the browser sends by itself.
// X-Requested-With is required by the server on writes as csrf protection
export async function apiFetch(url: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers);
  headers.set('X-Requested-With', 'fetch');
  if (options.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');

  const res = await fetch(url, { ...options, headers, credentials: 'same-origin' });
  // cookie expired or was cleared, drop the local copy of the user and start over
  if (res.status === 401 && getSavedUser()) {
    setSavedUser(null);
    window.location.reload();
  }
  return res;
}
