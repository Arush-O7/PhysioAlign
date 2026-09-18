import { config } from '../config.js';

export interface GoogleProfile {
  id: string;
  name: string;
  email: string;
  picture?: string;
}

// checks the id token with google instead of trusting what the browser decoded
export async function verifyGoogleCredential(credential: string): Promise<GoogleProfile | null> {
  const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`);
  if (!res.ok) return null;

  const info = await res.json();
  const validIssuer = info.iss === 'accounts.google.com' || info.iss === 'https://accounts.google.com';
  if (info.aud !== config.googleClientId || !validIssuer || Number(info.exp) < Date.now() / 1000) return null;
  if (info.email && info.email_verified !== 'true') return null;

  return {
    // existing google accounts are stored under the raw sub
    id: info.sub,
    name: info.name || info.email,
    email: info.email,
    picture: info.picture,
  };
}
