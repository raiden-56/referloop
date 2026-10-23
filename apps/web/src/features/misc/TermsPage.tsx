import { Card, CardContent, Typography } from '@mui/material';
import { PageHeader } from '@/components/PageHeader';

// Placeholder policy text. Replace with your organisation's reviewed terms before going live.
const TERMS = [
  [
    'Community listings',
    'Jobs on ReferLoop are shared by members. ReferLoop does not employ, recruit for, or verify the employers listed. Always confirm details on the official application page.',
  ],
  ['Referrals', 'Only offer a referral you can actually arrange. Never charge applicants for referrals or applications.'],
  [
    'Collaborative editing',
    'Any verified member may edit, close or reopen a listing. Every change is recorded with the member’s name and kept in the job history.',
  ],
  [
    'Acceptable use',
    'Do not post spam, misleading or fraudulent openings, or personal information about others. Administrators may archive listings and suspend accounts that break these rules.',
  ],
] as const;

const PRIVACY = [
  [
    'What we store',
    'Your name, email address, optional company and job title, a securely hashed password, and records of the jobs you post, edit or report.',
  ],
  [
    'What other members see',
    'Only your name, next to jobs you posted or edited. Your email address is never shown to other members or included in shared messages.',
  ],
  ['Security records', 'We keep sign-in and administrative audit logs (including IP addresses) to protect accounts and investigate abuse.'],
  ['Emails', 'We email you only for account verification, password resets and important security events.'],
] as const;

export default function TermsPage() {
  return (
    <>
      <PageHeader title="Terms & privacy" subtitle="The short version of how ReferLoop works." />
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h3" component="h2" gutterBottom>
            Terms of use
          </Typography>
          {TERMS.map(([title, text]) => (
            <Typography key={title} sx={{ mb: 1.5 }}>
              <strong>{title}.</strong> {text}
            </Typography>
          ))}
        </CardContent>
      </Card>
      <Card id="privacy">
        <CardContent>
          <Typography variant="h3" component="h2" gutterBottom>
            Privacy policy
          </Typography>
          {PRIVACY.map(([title, text]) => (
            <Typography key={title} sx={{ mb: 1.5 }}>
              <strong>{title}.</strong> {text}
            </Typography>
          ))}
        </CardContent>
      </Card>
    </>
  );
}
