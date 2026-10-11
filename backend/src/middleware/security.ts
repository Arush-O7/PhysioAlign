import type { NextFunction, Request, Response } from 'express';
import { config } from '../config.js';

// Content-Security-Policy, written out so each allowance is explainable:
//  - the pose model is wasm from jsdelivr, the weights come from google storage
//  - google identity services needs its script, frame and endpoint
//  - react sets element styles directly, hence 'unsafe-inline' for styles only
//  - no 'unsafe-eval', no wildcard script sources
const CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "script-src 'self' 'wasm-unsafe-eval' https://accounts.google.com https://cdn.jsdelivr.net",
  "worker-src 'self' blob:",
  // accounts.google.com ships the stylesheet for its sign-in button
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://accounts.google.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob: https://api.dicebear.com https://lh3.googleusercontent.com",
  "media-src 'self' blob:",
  [
    'connect-src',
    "'self'",
    'https://cdn.jsdelivr.net',
    'https://storage.googleapis.com',
    'https://accounts.google.com',
    'https://oauth2.googleapis.com',
  ].join(' '),
  'frame-src https://accounts.google.com',
].join('; ');

export function securityHeaders(req: Request, res: Response, next: NextFunction) {
  res.set('Content-Security-Policy', CSP);
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.set('X-Frame-Options', 'DENY');
  // the camera is the whole point, but only for this origin, and nothing else
  res.set('Permissions-Policy', 'camera=(self), microphone=(), geolocation=(), interest-cohort=()');
  res.set('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  res.set('Cross-Origin-Resource-Policy', 'same-origin');

  // only meaningful over https, and only in production
  if (config.isProduction && req.secure) {
    res.set('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
  }

  next();
}
