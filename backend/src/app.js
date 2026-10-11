import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { createClient } from '@supabase/supabase-js';
import { profileRouter } from './routes/profile.js';
import { productRouter } from './routes/products.js';
import { ingredientRouter } from './routes/ingredients.js';
import { routineRouter } from './routes/routines.js';
import { journalRouter } from './routes/journal.js';
import { waterRouter } from './routes/water.js';
import { progressRouter } from './routes/progress.js';
import { privacyRouter } from './routes/privacy.js';
import { achievementsRouter } from './routes/achievements.js';

function requireUser(req, res, next) {
  const authorization = req.get('authorization') || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return res.status(503).json({ error: { code: 'AUTH_NOT_CONFIGURED', message: 'Sign-in is not configured on this server yet.' } });
  if (!token) return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Please sign in to continue.' } });
  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: `Bearer ${token}` } } });
  supabase.auth.getUser(token).then(({ data, error }) => {
    if (error || !data.user) return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Your session is invalid or expired. Please sign in again.' } });
    req.user = data.user;
    req.supabase = supabase;
    next();
  }).catch(next);
}

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin: process.env.FRONTEND_ORIGIN || 'http://localhost:5173' }));
  app.use(express.json({ limit: '1mb' }));
  app.use('/api', rateLimit({ windowMs: 15 * 60 * 1000, limit: 300, standardHeaders: 'draft-8', legacyHeaders: false }));
  app.get('/api/health', (_req, res) => res.json({ status: 'ok', service: 'Little Rituals API' }));
  app.get('/api/me', requireUser, (req, res) => res.json({ user: { id: req.user.id, email: req.user.email, displayName: req.user.user_metadata?.display_name || '' } }));
  app.use('/api/profile', requireUser, profileRouter);
  app.use('/api/products', requireUser, productRouter);
  app.use('/api/ingredients', requireUser, ingredientRouter);
  app.use('/api/routines', requireUser, routineRouter);
  app.use('/api/journal', requireUser, journalRouter);
  app.use('/api/water', requireUser, waterRouter);
  app.use('/api/progress', requireUser, progressRouter);
  app.use('/api/privacy', requireUser, privacyRouter);
  app.use('/api/achievements', requireUser, achievementsRouter);
  app.use((_req, res) => res.status(404).json({ error: { code: 'NOT_FOUND', message: 'This page could not be found.' } }));
  app.use((err, _req, res, _next) => {
    console.error('Unhandled request error', err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong. Please try again.' } });
  });
  return app;
}
