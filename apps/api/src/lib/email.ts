import nodemailer, { type Transporter } from 'nodemailer';
import { env } from '../config/env.js';
import { logger } from './logger.js';

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/** Emails captured when EMAIL_TRANSPORT=memory (used by the automated tests). */
export const sentEmails: EmailMessage[] = [];

let transporter: Transporter | undefined;

function getTransporter(): Transporter {
  transporter ??= nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
  });
  return transporter;
}

/**
 * Queues an email for delivery without blocking the request. Failures are logged, never thrown:
 * callers must not reveal delivery problems (that would leak whether an address exists), a slow or
 * failing mail server must not break the request, and response timing stays the same either way.
 */
export function sendEmail(message: EmailMessage): void {
  void deliver(message);
}

async function deliver(message: EmailMessage): Promise<void> {
  try {
    switch (env.EMAIL_TRANSPORT) {
      case 'memory':
        sentEmails.push(message);
        return;
      case 'console':
        logger.info({ to: message.to, subject: message.subject }, `\n----- EMAIL -----\n${message.text}\n-----------------`);
        return;
      case 'smtp':
        await getTransporter().sendMail({ from: env.EMAIL_FROM, ...message });
        return;
    }
  } catch (err) {
    logger.error({ err, subject: message.subject }, 'Failed to send email');
  }
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

function layout(title: string, paragraphs: string[], action?: { label: string; url: string }) {
  const text = [title, '', ...paragraphs, ...(action ? ['', `${action.label}: ${action.url}`] : []), '', '— ReferLoop'].join('\n');
  const html = `<!doctype html><html><body style="font-family:Segoe UI,Arial,sans-serif;background:#f6f7fb;padding:24px;color:#1f2937">
<div style="max-width:520px;margin:auto;background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:28px">
<h2 style="margin-top:0;color:#3730a3">${escapeHtml(title)}</h2>
${paragraphs.map((p) => `<p style="line-height:1.5">${escapeHtml(p)}</p>`).join('\n')}
${
  action
    ? `<p style="margin:28px 0"><a href="${escapeHtml(action.url)}" style="background:#4f46e5;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600">${escapeHtml(action.label)}</a></p>
<p style="font-size:12px;color:#6b7280">If the button does not work, copy this link into your browser:<br>${escapeHtml(action.url)}</p>`
    : ''
}
<p style="font-size:12px;color:#6b7280;margin-top:28px">— ReferLoop</p></div></body></html>`;
  return { text, html };
}

const appLink = (pathAndQuery: string) => `${env.APP_URL.replace(/\/+$/, '')}${pathAndQuery}`;

export const emails = {
  verifyEmail(to: string, name: string, token: string) {
    const url = appLink(`/verify-email?token=${encodeURIComponent(token)}`);
    return sendEmail({
      to,
      subject: 'Verify your ReferLoop email address',
      ...layout(
        `Welcome to ReferLoop, ${name}`,
        ['Confirm your email address to start posting and editing job openings. This link expires in 24 hours.'],
        { label: 'Verify email', url },
      ),
    });
  },

  accountAlreadyExists(to: string) {
    return sendEmail({
      to,
      subject: 'ReferLoop sign-up attempt',
      ...layout(
        'You already have a ReferLoop account',
        [
          'Someone (hopefully you) tried to register with this email address, but an account already exists.',
          'If you forgot your password you can reset it below. If this was not you, you can ignore this email.',
        ],
        { label: 'Reset password', url: appLink('/forgot-password') },
      ),
    });
  },

  passwordReset(to: string, token: string) {
    const url = appLink(`/reset-password?token=${encodeURIComponent(token)}`);
    return sendEmail({
      to,
      subject: 'Reset your ReferLoop password',
      ...layout(
        'Password reset requested',
        [
          'Use the link below to choose a new password. It expires in 1 hour and can only be used once.',
          'If you did not request this, you can safely ignore this email.',
        ],
        { label: 'Reset password', url },
      ),
    });
  },

  passwordChanged(to: string) {
    return sendEmail({
      to,
      subject: 'Your ReferLoop password was changed',
      ...layout('Password changed', [
        'The password for your ReferLoop account was just changed and all other sessions were signed out.',
        'If you did not do this, reset your password immediately and contact an administrator.',
      ]),
    });
  },

  accountLocked(to: string, minutes: number) {
    return sendEmail({
      to,
      subject: 'ReferLoop sign-in temporarily locked',
      ...layout(
        'Too many failed sign-in attempts',
        [
          `Sign-in to your account has been paused for ${minutes} minutes after repeated failed attempts.`,
          'If this was not you, consider resetting your password.',
        ],
        { label: 'Reset password', url: appLink('/forgot-password') },
      ),
    });
  },

  referralRequested(to: string, requesterName: string, jobTitle: string, message: string) {
    const excerpt = message.length > 500 ? `${message.slice(0, 500)}…` : message;
    return sendEmail({
      to,
      subject: `${requesterName} asked you for a referral`,
      ...layout(
        'New referral request',
        [
          `${requesterName} would like a referral for "${jobTitle}", which you shared on ReferLoop.`,
          `Their message: ${excerpt}`,
          'You can accept, mark them as referred, or decline. They will be notified either way.',
        ],
        { label: 'Review request', url: appLink('/referrals?box=received') },
      ),
    });
  },

  referralUpdated(to: string, referrerName: string, jobTitle: string, outcome: string, note: string | null) {
    return sendEmail({
      to,
      subject: `Referral update for ${jobTitle}`,
      ...layout(
        'Your referral request was updated',
        [`${referrerName} ${outcome} for "${jobTitle}".`, ...(note ? [`Their note: ${note}`] : [])],
        { label: 'View your requests', url: appLink('/referrals?box=sent') },
      ),
    });
  },

  accountSuspended(to: string, reason: string | null) {
    return sendEmail({
      to,
      subject: 'Your ReferLoop account has been suspended',
      ...layout('Account suspended', [
        'An administrator suspended your ReferLoop account. You have been signed out of all sessions.',
        ...(reason ? [`Reason: ${reason}`] : []),
      ]),
    });
  },
};
