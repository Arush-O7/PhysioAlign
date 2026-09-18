import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import fs from 'fs';
import { config } from './config.js';
import { one } from './db/pool.js';
import { requireAuth, requireCsrfHeader } from './middleware/auth.js';
import { errorHandler } from './middleware/errors.js';
import { rateLimit } from './middleware/rateLimit.js';
import { adminRouter } from './routes/admin.js';
import { authRouter } from './routes/auth.js';
import { coachRouter } from './routes/coach.js';
import { doctorRouter } from './routes/doctor.js';
import { sessionsRouter } from './routes/sessions.js';
import { usersRouter } from './routes/users.js';

// flipped once migrations have run. until then the api answers 503
export const readiness = { ready: false };

export function createApp() {
  const app = express();

  // render puts the app behind a proxy, needed for req.ip and req.secure
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  // the frontend is served from the same origin in production, so cors is
  // only opened up when an origin is configured explicitly
  if (config.corsOrigins.length) app.use(cors({ origin: config.corsOrigins, credentials: true }));

  app.use(express.json({ limit: '5mb' }));
  app.use(cookieParser());

  app.get('/api/health', async (_req, res) => {
    try {
      await one('SELECT 1');
      res.status(readiness.ready ? 200 : 503).json({ ok: readiness.ready, database: 'up' });
    } catch (error) {
      res.status(503).json({ ok: false, database: 'down', error: (error as Error).message });
    }
  });

  app.use('/api', (_req, res, next) => {
    if (readiness.ready) return next();
    res.status(503).json({ error: 'Server is starting up, please try again in a moment' });
  });

  app.use('/api', requireCsrfHeader);
  app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, max: config.isTest ? 1000 : 20 }), authRouter);

  app.use('/api', requireAuth);
  app.use('/api/users', usersRouter);
  app.use('/api/sessions', sessionsRouter);
  app.use('/api/coach', coachRouter);
  app.use('/api/doctor', doctorRouter);
  app.use('/api/admin', adminRouter);

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });
  app.use(errorHandler);

  // built frontend, served as a single page app
  const dist = path.resolve(process.cwd(), 'dist');
  if (fs.existsSync(dist)) {
    app.use(express.static(dist, { index: false, maxAge: '1h' }));
    app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
  }

  return app;
}
