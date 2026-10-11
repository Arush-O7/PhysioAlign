import { getSavedUser, setSavedUser } from './auth';

type TroubleListener = (down: boolean) => void;
const troubleListeners = new Set<TroubleListener>();
let consecutiveFailures = 0;

/** subscribe to "the api looks unreachable" changes */
export function onApiTrouble(listener: TroubleListener) {
  troubleListeners.add(listener);
  return () => {
    troubleListeners.delete(listener);
  };
}

const reportTrouble = (down: boolean) => {
  // one blip shouldn't shout; two in a row means something is wrong
  consecutiveFailures = down ? consecutiveFailures + 1 : 0;
  const isDown = consecutiveFailures >= 2;
  troubleListeners.forEach((listener) => listener(isDown));
};

// the session lives in an httpOnly cookie that the browser sends by itself.
// X-Requested-With is required by the server on writes as csrf protection
export async function apiFetch(url: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers);
  headers.set('X-Requested-With', 'fetch');
  if (options.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');

  let res: Response;
  try {
    res = await fetch(url, { ...options, headers, credentials: 'same-origin' });
  } catch (error) {
    reportTrouble(true);
    throw error;
  }

  // 503 means the server is up but not serving (starting, or database down)
  reportTrouble(res.status === 503);

  // cookie expired or was cleared, drop the local copy of the user and start over
  if (res.status === 401 && getSavedUser()) {
    setSavedUser(null);
    window.location.reload();
  }
  return res;
}
