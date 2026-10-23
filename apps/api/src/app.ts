import fs from 'node:fs';
import path from 'node:path';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { Router } from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { env, isTest, paths } from './config/env.js';
import { logger } from './lib/logger.js';
import { prisma } from './lib/prisma.js';
import { loadSession } from './middleware/auth.js';
import { csrfProtection } from './middleware/csrf.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { rateLimits } from './middleware/rateLimit.js';
import { adminRouter } from './modules/admin/admin.routes.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { jobsRouter } from './modules/jobs/jobs.routes.js';
import { notificationsRouter } from './modules/notifications/notifications.routes.js';
import { referralsRouter } from './modules/referrals/referrals.routes.js';
import { getPublicConfig } from './modules/settings/settings.service.js';
import { usersRouter } from './modules/users/users.routes.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', env.TRUST_PROXY);
  app.set('query parser', 'simple');

  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          'default-src': ["'self'"],
          'script-src': ["'self'"],
          // MUI/Emotion inject styles at runtime.
          'style-src': ["'self'", "'unsafe-inline'"],
          'img-src': ["'self'", 'data:'],
          'font-src': ["'self'", 'data:'],
          'connect-src': ["'self'"],
          'frame-ancestors': ["'none'"],
          'form-action': ["'self'"],
          'object-src': ["'none'"],
          // Only meaningful behind HTTPS; on plain-HTTP hosts it would break asset loading.
          'upgrade-insecure-requests': env.COOKIE_SECURE ? [] : null,
        },
      },
      crossOriginEmbedderPolicy: false,
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    }),
  );
  // Scoped to the API: SPA page URLs such as /reset-password?token=… must never reach the logs.
  if (!isTest)
    app.use('/api', pinoHttp({ logger, autoLogging: { ignore: (req) => (req as express.Request).originalUrl === '/api/v1/health' } }));

  const api = Router();
  api.use(
    cors({
      origin: (origin, cb) => cb(null, !origin || env.CORS_ORIGINS.includes(origin)),
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
      allowedHeaders: ['Content-Type', 'X-CSRF-Token', 'Idempotency-Key'],
      maxAge: 600,
    }),
  );
  api.use(express.json({ limit: '100kb' }));
  api.use(cookieParser());
  api.use(rateLimits.api);
  api.use((_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
  api.use(loadSession);
  api.use(csrfProtection);

  api.get('/health', async (_req, res) => {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok' });
  });
  api.get('/config', async (_req, res) => {
    res.json(await getPublicConfig());
  });
  api.use('/auth', authRouter);
  api.use('/users', usersRouter);
  api.use('/jobs', jobsRouter);
  api.use('/notifications', notificationsRouter);
  api.use('/referrals', referralsRouter);
  api.use('/admin', adminRouter);
  api.use(notFoundHandler);

  app.use('/api/v1', api);
  app.use('/api', notFoundHandler);

  // Production: serve the built SPA from the same origin so cookies stay first-party.
  if (env.SERVE_WEB && fs.existsSync(paths.webDist)) {
    app.use(express.static(paths.webDist, { index: false, maxAge: '1h', setHeaders: immutableAssets }));
    app.get(/^(?!\/api\/).*/, (_req, res) => {
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(path.join(paths.webDist, 'index.html'));
    });
  }

  app.use(errorHandler);
  return app;
}

function immutableAssets(res: express.Response, filePath: string) {
  if (filePath.includes(`${path.sep}assets${path.sep}`)) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
}
