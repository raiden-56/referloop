import { env } from './config/env.js';
import { createApp } from './app.js';
import { logger } from './lib/logger.js';
import { prisma } from './lib/prisma.js';

const server = createApp().listen(env.PORT, () => {
  logger.info(`ReferLoop API listening on http://localhost:${env.PORT} (${env.NODE_ENV}, email: ${env.EMAIL_TRANSPORT})`);
});

// Purge long-expired sessions and tokens at startup and then once a day. Running at startup matters:
// instances that are redeployed more often than daily would otherwise never purge anything.
function purgeExpired() {
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  Promise.all([
    prisma.userSession.deleteMany({ where: { expiresAt: { lt: cutoff } } }),
    prisma.emailVerificationToken.deleteMany({ where: { expiresAt: { lt: cutoff } } }),
    prisma.passwordResetToken.deleteMany({ where: { expiresAt: { lt: cutoff } } }),
  ]).catch((err: unknown) => logger.warn({ err }, 'Session cleanup failed'));
}
purgeExpired();
const cleanup = setInterval(purgeExpired, 24 * 60 * 60 * 1000);
cleanup.unref();

function shutdown(signal: string) {
  logger.info(`${signal} received, shutting down`);
  server.close(() => {
    void prisma.$disconnect().finally(() => process.exit(0));
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
