/**
 * Seeds realistic sample data through the real service layer, so edit history, status history and
 * audit records are consistent with what the application would produce.
 *
 *   npm run db:seed        (skips if data already exists)
 *   npm run db:reset       (drops everything, re-applies migrations, then seeds)
 */
import { jobInputSchema, jobUpdateSchema, slugify, type JobInput } from '@referloop/shared';
import { prisma } from '../src/lib/prisma.js';
import { hashPassword } from '../src/lib/password.js';
import { changeStatus, createJob, updateJob } from '../src/modules/jobs/jobs.service.js';
import type { RequestMeta } from '../src/modules/audit/audit.service.js';

const SEED_PASSWORD = 'ReferLoop2026!';
const meta: RequestMeta = { ipAddress: '127.0.0.1', userAgent: 'seed-script' };
const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (n: number) => new Date(Date.now() - n * DAY);

const CATEGORIES = [
  'Engineering',
  'Data & Analytics',
  'Product Management',
  'Design',
  'Sales & Marketing',
  'Operations',
  'Finance',
  'HR & Recruiting',
  'Customer Success',
];

const USERS = [
  {
    key: 'admin',
    name: 'Priya Sharma',
    email: 'admin@referloop.dev',
    role: 'ADMIN',
    companyName: 'ReferLoop',
    jobTitle: 'Community Admin',
  },
  {
    key: 'arjun',
    name: 'Arjun Mehta',
    email: 'arjun@referloop.dev',
    companyName: 'Northwind Technologies',
    jobTitle: 'Engineering Manager',
  },
  { key: 'sara', name: 'Sara Thomas', email: 'sara@referloop.dev', companyName: 'Contoso Systems', jobTitle: 'Senior Recruiter' },
  { key: 'daniel', name: 'Daniel Kim', email: 'daniel@referloop.dev', companyName: 'Fabrikam Labs', jobTitle: 'Staff Data Scientist' },
  { key: 'meera', name: 'Meera Iyer', email: 'meera@referloop.dev', companyName: 'Woodgrove Bank', jobTitle: 'Product Designer' },
  {
    key: 'neha',
    name: 'Neha Kapoor',
    email: 'neha@referloop.dev',
    companyName: 'Tailspin Analytics',
    jobTitle: 'Analyst',
    unverified: true,
  },
  { key: 'vikram', name: 'Vikram Rao', email: 'vikram@referloop.dev', companyName: 'Litware Inc', jobTitle: 'Sales Lead', suspended: true },
] as const;

type UserKey = (typeof USERS)[number]['key'];

interface SeedJob {
  by: UserKey;
  ageDays: number;
  category: string;
  job: Omit<JobInput, 'categoryId' | 'preferredSkills' | 'referralAvailable' | 'posterCanRefer'> &
    Partial<Pick<JobInput, 'preferredSkills' | 'referralAvailable' | 'posterCanRefer'>>;
  edits?: { by: UserKey; afterDays: number; changes: Partial<JobInput>; reason?: string }[];
  close?: { by: UserKey; afterDays: number; reason: string };
}

const desc = (role: string, team: string, extra: string) =>
  `We are hiring a ${role} to join the ${team} team. ${extra}\n\nYou will work closely with product, design and engineering partners, take ownership of meaningful problems, and help raise the bar for quality across the team. We value clear written communication, pragmatic decision making and a habit of learning in public.`;

const JOBS: SeedJob[] = [
  {
    by: 'arjun',
    ageDays: 3,
    category: 'Engineering',
    job: {
      title: 'Senior Software Engineer (Frontend)',
      companyName: 'Northwind Technologies',
      department: 'Customer Platform',
      location: 'Bengaluru',
      workMode: 'HYBRID',
      employmentType: 'FULL_TIME',
      experienceMin: 5,
      experienceMax: 8,
      salaryMin: 3_500_000,
      salaryMax: 5_000_000,
      salaryCurrency: 'INR',
      numberOfOpenings: 2,
      summary: 'Build the React and TypeScript front end for our customer self-service platform used by 2M+ users.',
      description: desc(
        'Senior Software Engineer',
        'Customer Platform',
        'You will lead front-end architecture decisions for a large React codebase.',
      ),
      responsibilities:
        '- Own features end to end, from design review to production\n- Improve performance and accessibility\n- Mentor engineers through code review',
      requiredSkills: ['React', 'TypeScript', 'GraphQL', 'Testing Library'],
      preferredSkills: ['Next.js', 'Design systems'],
      eligibility: 'Must be authorised to work in India.',
      referralAvailable: true,
      posterCanRefer: true,
      referralInstructions:
        'Send me your CV and the job link on the company Slack (Arjun Mehta) and I will submit the referral within 2 working days.',
      applicationUrl: 'https://careers.northwind.example.com/jobs/fe-senior-1042',
    },
    edits: [{ by: 'sara', afterDays: 1, changes: { numberOfOpenings: 3 }, reason: 'Hiring manager confirmed a third opening' }],
  },
  {
    by: 'sara',
    ageDays: 6,
    category: 'Engineering',
    job: {
      title: 'Backend Engineer – Payments',
      companyName: 'Contoso Systems',
      location: 'Pune',
      workMode: 'ONSITE',
      employmentType: 'FULL_TIME',
      experienceMin: 3,
      experienceMax: 6,
      summary: 'Design and operate high-throughput payment APIs in Go and PostgreSQL with strict reliability targets.',
      description: desc('Backend Engineer', 'Payments', 'The team processes millions of transactions every day across 14 countries.'),
      requiredSkills: ['Go', 'PostgreSQL', 'Kafka', 'Distributed systems'],
      preferredSkills: ['Kubernetes', 'PCI DSS'],
      referralAvailable: true,
      posterCanRefer: true,
      referralInstructions: 'Apply via the official link and email me your application ID.',
      applicationUrl: 'https://jobs.contoso.example.com/r/payments-be-77',
      applicationDeadline: new Date(Date.now() + 20 * DAY).toISOString().slice(0, 10),
    },
  },
  {
    by: 'daniel',
    ageDays: 10,
    category: 'Data & Analytics',
    job: {
      title: 'Data Scientist, Forecasting',
      companyName: 'Fabrikam Labs',
      location: 'Hyderabad',
      workMode: 'HYBRID',
      employmentType: 'FULL_TIME',
      experienceMin: 2,
      experienceMax: 5,
      summary: 'Build demand forecasting models that drive inventory decisions for 400+ retail partners.',
      description: desc('Data Scientist', 'Forecasting', 'You will own models from experimentation to production monitoring.'),
      requiredSkills: ['Python', 'Time series', 'SQL', 'scikit-learn'],
      preferredSkills: ['PyTorch', 'Airflow'],
      referralAvailable: false,
      applicationUrl: 'https://fabrikam.example.com/careers/ds-forecasting',
    },
    edits: [
      {
        by: 'arjun',
        afterDays: 2,
        changes: { workMode: 'REMOTE', location: null },
        reason: 'Team confirmed the role is now fully remote within India',
      },
      { by: 'daniel', afterDays: 4, changes: { experienceMin: 3 }, reason: 'Corrected minimum experience' },
    ],
  },
  {
    by: 'meera',
    ageDays: 14,
    category: 'Design',
    job: {
      title: 'Product Designer (Mobile)',
      companyName: 'Woodgrove Bank',
      location: 'Mumbai',
      workMode: 'HYBRID',
      employmentType: 'FULL_TIME',
      experienceMin: 3,
      experienceMax: 7,
      summary: 'Design delightful, accessible mobile banking journeys for retail customers.',
      description: desc('Product Designer', 'Mobile Banking', 'You will shape the next generation of our iOS and Android apps.'),
      requiredSkills: ['Figma', 'Interaction design', 'Prototyping', 'Accessibility'],
      referralAvailable: true,
      posterCanRefer: true,
      referralInstructions: 'Share your portfolio link with me and I will refer you directly.',
      applicationUrl: 'https://woodgrove.example.com/careers/design-mobile',
    },
  },
  {
    by: 'arjun',
    ageDays: 21,
    category: 'Engineering',
    job: {
      title: 'Site Reliability Engineer',
      companyName: 'Northwind Technologies',
      location: 'Chennai',
      workMode: 'ONSITE',
      employmentType: 'FULL_TIME',
      experienceMin: 4,
      experienceMax: 9,
      summary: 'Keep our multi-region platform fast and reliable; automate everything you touch.',
      description: desc(
        'Site Reliability Engineer',
        'Infrastructure',
        'Our platform runs across three cloud regions with a 99.95% availability target.',
      ),
      requiredSkills: ['Kubernetes', 'Terraform', 'AWS', 'Prometheus'],
      preferredSkills: ['Go'],
      referralAvailable: true,
      posterCanRefer: true,
      applicationUrl: 'https://careers.northwind.example.com/jobs/sre-2201',
    },
    close: { by: 'arjun', afterDays: 15, reason: 'Position filled internally' },
  },
  {
    by: 'sara',
    ageDays: 2,
    category: 'HR & Recruiting',
    job: {
      title: 'Technical Recruiter (Contract)',
      companyName: 'Contoso Systems',
      location: 'Bengaluru',
      workMode: 'HYBRID',
      employmentType: 'CONTRACT',
      experienceMin: 2,
      experienceMax: 4,
      summary: 'Six-month contract to help scale our engineering hiring across India.',
      description: desc(
        'Technical Recruiter',
        'Talent Acquisition',
        'You will partner with hiring managers across three engineering groups.',
      ),
      requiredSkills: ['Technical sourcing', 'Stakeholder management', 'ATS'],
      referralAvailable: false,
      applicationUrl: 'https://jobs.contoso.example.com/r/tr-contract-12',
    },
  },
  {
    by: 'daniel',
    ageDays: 35,
    category: 'Data & Analytics',
    job: {
      title: 'Analytics Engineer',
      companyName: 'Tailspin Analytics',
      location: null,
      workMode: 'REMOTE',
      employmentType: 'FULL_TIME',
      experienceMin: 2,
      experienceMax: 6,
      summary: 'Model clean, trustworthy data with dbt and Snowflake for analysts across the company.',
      description: desc('Analytics Engineer', 'Data Platform', 'You will own our semantic layer and data quality tooling.'),
      requiredSkills: ['SQL', 'dbt', 'Snowflake'],
      preferredSkills: ['Python', 'Looker'],
      referralAvailable: true,
      posterCanRefer: false,
      referralInstructions: 'My former colleague on the team can refer; message me for an intro.',
      applicationUrl: 'https://tailspin.example.com/jobs/analytics-engineer',
      applicationDeadline: new Date(Date.now() - 5 * DAY).toISOString().slice(0, 10),
    },
  },
  {
    by: 'meera',
    ageDays: 8,
    category: 'Product Management',
    job: {
      title: 'Product Manager, Growth',
      companyName: 'Relecloud',
      location: 'Gurugram',
      workMode: 'HYBRID',
      employmentType: 'FULL_TIME',
      experienceMin: 4,
      experienceMax: 8,
      salaryMin: 4_000_000,
      salaryMax: 6_000_000,
      salaryCurrency: 'INR',
      summary: 'Own activation and retention for our SMB cloud storage product.',
      description: desc('Product Manager', 'Growth', 'You will run experiments with a dedicated engineering and design squad.'),
      requiredSkills: ['Experimentation', 'SQL', 'Product analytics'],
      referralAvailable: false,
      applicationUrl: 'https://relecloud.example.com/careers/pm-growth',
    },
  },
  {
    by: 'arjun',
    ageDays: 1,
    category: 'Engineering',
    job: {
      title: 'Software Engineering Intern',
      companyName: 'Northwind Technologies',
      location: 'Bengaluru',
      workMode: 'ONSITE',
      employmentType: 'INTERNSHIP',
      experienceMin: 0,
      experienceMax: 0,
      numberOfOpenings: 6,
      summary: 'Six-month internship for final-year students with a strong CS foundation.',
      description: desc('Software Engineering Intern', 'University Programs', 'Interns ship real features with a dedicated mentor.'),
      requiredSkills: ['Java', 'Data structures', 'Git'],
      eligibility: 'Final-year B.E./B.Tech/M.Tech students graduating in 2027.',
      referralAvailable: true,
      posterCanRefer: true,
      applicationUrl: 'https://careers.northwind.example.com/jobs/intern-2027',
    },
  },
  {
    by: 'sara',
    ageDays: 45,
    category: 'Customer Success',
    job: {
      title: 'Customer Success Manager',
      companyName: 'Litware Inc',
      location: 'Singapore',
      workMode: 'HYBRID',
      employmentType: 'FULL_TIME',
      experienceMin: 3,
      experienceMax: 6,
      salaryMin: 90_000,
      salaryMax: 120_000,
      salaryCurrency: 'SGD',
      summary: 'Be the trusted advisor for our largest APAC enterprise customers.',
      description: desc('Customer Success Manager', 'APAC Customer Success', 'You will manage a book of 20 enterprise accounts.'),
      requiredSkills: ['Account management', 'SaaS', 'Renewals'],
      referralAvailable: false,
      applicationUrl: 'https://litware.example.com/careers/csm-apac',
    },
    close: { by: 'daniel', afterDays: 30, reason: 'Careers page shows the role as filled' },
  },
  {
    by: 'daniel',
    ageDays: 4,
    category: 'Engineering',
    job: {
      title: 'Machine Learning Engineer',
      companyName: 'Fabrikam Labs',
      location: 'Bengaluru',
      workMode: 'HYBRID',
      employmentType: 'FULL_TIME',
      experienceMin: 3,
      experienceMax: 7,
      summary: 'Productionise ML models behind low-latency APIs serving 50k requests per second.',
      description: desc('Machine Learning Engineer', 'ML Platform', 'You will build feature stores and model serving infrastructure.'),
      requiredSkills: ['Python', 'PyTorch', 'MLOps', 'Docker'],
      preferredSkills: ['Ray', 'Triton'],
      referralAvailable: true,
      posterCanRefer: true,
      applicationUrl: 'https://fabrikam.example.com/careers/mle-platform',
    },
  },
  {
    by: 'meera',
    ageDays: 12,
    category: 'Finance',
    job: {
      title: 'Financial Analyst',
      companyName: 'Woodgrove Bank',
      location: 'Mumbai',
      workMode: 'ONSITE',
      employmentType: 'FULL_TIME',
      experienceMin: 1,
      experienceMax: 3,
      summary: 'Support FP&A for the retail banking division with monthly forecasting and variance analysis.',
      description: desc('Financial Analyst', 'FP&A', 'You will prepare board-level reporting packs.'),
      requiredSkills: ['Financial modelling', 'Excel', 'Forecasting'],
      referralAvailable: false,
      applicationUrl: 'https://woodgrove.example.com/careers/fpa-analyst',
    },
  },
  {
    by: 'sara',
    ageDays: 5,
    category: 'Sales & Marketing',
    job: {
      title: 'Content Marketing Specialist (Part-time)',
      companyName: 'Lucerne Publishing',
      location: null,
      workMode: 'REMOTE',
      employmentType: 'PART_TIME',
      experienceMin: 1,
      experienceMax: 4,
      summary: 'Write and edit long-form technical content for our developer audience, 20 hours a week.',
      description: desc('Content Marketing Specialist', 'Marketing', 'You will own our developer blog calendar.'),
      requiredSkills: ['Technical writing', 'SEO', 'Content strategy'],
      referralAvailable: false,
      applicationUrl: 'https://lucerne.example.com/jobs/content-pt',
    },
  },
  {
    by: 'arjun',
    ageDays: 9,
    category: 'Operations',
    job: {
      title: 'Engineering Program Manager',
      companyName: 'Northwind Technologies',
      location: 'Bengaluru',
      workMode: 'HYBRID',
      employmentType: 'FULL_TIME',
      experienceMin: 6,
      experienceMax: 12,
      summary: 'Drive cross-team delivery of our 2027 platform migration program.',
      description: desc(
        'Engineering Program Manager',
        'Platform Programs',
        'You will coordinate eight engineering teams across two time zones.',
      ),
      requiredSkills: ['Program management', 'Agile', 'Stakeholder management'],
      referralAvailable: true,
      posterCanRefer: true,
      applicationUrl: 'https://careers.northwind.example.com/jobs/epm-310',
    },
  },
  {
    by: 'daniel',
    ageDays: 60,
    category: 'Data & Analytics',
    job: {
      title: 'Data Engineer',
      companyName: 'Adatum Corporation',
      location: 'Noida',
      workMode: 'ONSITE',
      employmentType: 'TEMPORARY',
      experienceMin: 2,
      experienceMax: 5,
      summary: 'Three-month engagement to migrate legacy ETL pipelines to Spark on Databricks.',
      description: desc('Data Engineer', 'Data Migration', 'The engagement may extend based on project needs.'),
      requiredSkills: ['Spark', 'Databricks', 'Python', 'SQL'],
      referralAvailable: false,
      applicationUrl: 'https://adatum.example.com/careers/de-temp',
    },
  },
];

async function main() {
  if (await prisma.user.findUnique({ where: { email: 'admin@referloop.dev' } })) {
    console.log('Seed data already present — skipping. Run `npm run db:reset` to start fresh.');
    return;
  }

  await prisma.appSetting.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} });

  const categories = new Map<string, string>();
  for (const [i, name] of CATEGORIES.entries()) {
    const c = await prisma.jobCategory.create({ data: { name, slug: slugify(name), sortOrder: i * 10 } });
    categories.set(name, c.id);
  }

  const passwordHash = await hashPassword(SEED_PASSWORD);
  const users = new Map<UserKey, Awaited<ReturnType<typeof prisma.user.create>>>();
  for (const u of USERS) {
    const user = await prisma.user.create({
      data: {
        name: u.name,
        email: u.email,
        passwordHash,
        role: 'role' in u ? u.role : 'MEMBER',
        companyName: u.companyName,
        jobTitle: u.jobTitle,
        emailVerifiedAt: 'unverified' in u ? null : daysAgo(90),
        accountStatus: 'suspended' in u ? 'SUSPENDED' : 'ACTIVE',
        suspendedAt: 'suspended' in u ? daysAgo(3) : null,
        suspensionReason: 'suspended' in u ? 'Posted several spam listings' : null,
        passwordChangedAt: daysAgo(90),
        createdAt: daysAgo(90),
      },
    });
    users.set(u.key, user);
  }
  const user = (k: UserKey) => users.get(k)!;

  const createdJobs: { id: string; slug: string; title: string }[] = [];
  for (const seed of JOBS) {
    const created = new Date(Date.now() - seed.ageDays * DAY);
    const input = jobInputSchema.parse({
      preferredSkills: [],
      referralAvailable: false,
      posterCanRefer: false,
      ...seed.job,
      categoryId: categories.get(seed.category),
    });
    const { job } = await createJob(input, user(seed.by), undefined, meta);
    await backdate(job.id, created);
    let current = job;

    for (const edit of seed.edits ?? []) {
      const at = new Date(created.getTime() + edit.afterDays * DAY);
      const base = jobUpdateSchema.parse({ ...current, ...edit.changes, version: current.version, reason: edit.reason });
      const { job: updated } = await updateJob(current.id, base, user(edit.by), meta);
      await backdateLatestHistory(current.id, at);
      current = updated;
    }
    if (seed.close) {
      const at = new Date(created.getTime() + seed.close.afterDays * DAY);
      current = await changeStatus(current.id, 'CLOSED', seed.close.reason, user(seed.close.by), meta);
      await backdateLatestHistory(current.id, at, true);
    }
    createdJobs.push({ id: current.id, slug: current.slug, title: current.title });
  }

  // A pending report and a saved job so the moderation queue and saved list are not empty.
  const outdated = createdJobs.find((j) => j.title === 'Analytics Engineer')!;
  await prisma.jobReport.create({
    data: {
      jobId: outdated.id,
      reporterId: user('meera').id,
      reason: 'CLOSED_OR_OUTDATED',
      description: 'The application deadline passed last week and the careers page link now shows "no longer accepting applications".',
      createdAt: daysAgo(1),
    },
  });
  const designJob = createdJobs.find((j) => j.title.startsWith('Product Designer'))!;
  await prisma.jobReport.create({
    data: {
      jobId: designJob.id,
      reporterId: user('daniel').id,
      reason: 'BROKEN_LINK',
      description: 'Application link returns 404.',
      createdAt: daysAgo(2),
    },
  });
  await prisma.savedJob.create({ data: { userId: user('meera').id, jobId: createdJobs[0]!.id } });

  // Referral requests in a few states so both inboxes have something to show.
  const referable = (by: UserKey) =>
    prisma.job.findFirstOrThrow({
      where: { createdById: user(by).id, posterCanRefer: true, status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' },
    });
  const referrals: {
    from: UserKey;
    to: UserKey;
    status: 'PENDING' | 'ACCEPTED' | 'REFERRED';
    message: string;
    note?: string;
    ago: number;
  }[] = [
    {
      from: 'meera',
      to: 'arjun',
      status: 'PENDING',
      message:
        'Hi Arjun, I have four years of frontend experience with React and TypeScript, most recently leading a design-system migration. I would love a referral for this role.',
      ago: 1,
    },
    {
      from: 'daniel',
      to: 'arjun',
      status: 'ACCEPTED',
      message: 'I have shipped several Node.js services in production and mentor two junior engineers. Happy to share my resume.',
      note: 'Sounds like a great fit. Please email me your latest resume and I will submit it this week.',
      ago: 3,
    },
    {
      from: 'arjun',
      to: 'sara',
      status: 'REFERRED',
      message: 'I have led platform teams for five years and would value a referral. My LinkedIn is linked below.',
      note: 'Referred you today. The recruiter usually responds within a week.',
      ago: 6,
    },
  ];
  for (const r of referrals) {
    const job = await referable(r.to);
    await prisma.referralRequest.create({
      data: {
        jobId: job.id,
        requesterId: user(r.from).id,
        referrerId: user(r.to).id,
        status: r.status,
        message: r.message,
        profileUrl: r.from === 'arjun' ? 'https://www.linkedin.com/in/example-arjun' : null,
        responseNote: r.note ?? null,
        respondedAt: r.status === 'PENDING' ? null : daysAgo(r.ago - 1),
        createdAt: daysAgo(r.ago),
      },
    });
  }

  console.log(`Seeded ${USERS.length} users, ${CATEGORIES.length} categories and ${createdJobs.length} jobs.`);
  console.log(`All sample accounts use the password: ${SEED_PASSWORD}`);
  console.log('  admin@referloop.dev (administrator), arjun@, sara@, daniel@, meera@ (verified members),');
  console.log('  neha@ (unverified), vikram@ (suspended) — all @referloop.dev');
}

/** Moves creation-time records back in time so the sample board has a realistic spread of dates. */
async function backdate(jobId: string, at: Date) {
  await prisma.job.update({ where: { id: jobId }, data: { createdAt: at, updatedAt: at, statusChangedAt: at } });
  await prisma.jobEditHistory.updateMany({ where: { jobId }, data: { createdAt: at } });
  await prisma.jobStatusHistory.updateMany({ where: { jobId }, data: { createdAt: at } });
}

async function backdateLatestHistory(jobId: string, at: Date, statusChange = false) {
  const latest = await prisma.jobEditHistory.findFirst({ where: { jobId }, orderBy: { createdAt: 'desc' } });
  if (latest) await prisma.jobEditHistory.update({ where: { id: latest.id }, data: { createdAt: at } });
  if (statusChange) {
    const s = await prisma.jobStatusHistory.findFirst({ where: { jobId }, orderBy: { createdAt: 'desc' } });
    if (s) await prisma.jobStatusHistory.update({ where: { id: s.id }, data: { createdAt: at } });
  }
  await prisma.job.update({ where: { id: jobId }, data: { updatedAt: at, ...(statusChange ? { statusChangedAt: at } : {}) } });
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
