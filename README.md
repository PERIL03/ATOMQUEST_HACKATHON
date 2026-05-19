# AtomQuest

AI-augmented goal setting and quarterly tracking for high-performing teams.

Live demo: https://atomquest.vercel.app

## Demo Credentials

| Role | Email | Password |
| --- | --- | --- |
| Employee | alice@atomquest.demo | Password123! |
| Manager | manager@atomquest.demo | Password123! |
| Admin | admin@atomquest.demo | Password123! |

## Setup

```bash
npm install
npx prisma generate
npx prisma db push
npx prisma db seed
npm run dev
```

## Features

- Goal setting & approval workflow
- Quarterly achievement tracking
- AI-powered goal suggestions
- Goal health indicators
- Manager effectiveness scorecard
- Audit trail
- CSV export
 - Shared-goal sync: admin pushes a single shared KPI to many employees; achievements
	 updated by any linked owner are synchronized across recipients.
 - Escalation rules: automated email alerts for overdue submission, approval, and
	 quarterly check-ins.
 - Architecture diagram: [docs/architecture.svg](docs/architecture.svg)
