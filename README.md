# AtomQuest

AI-augmented goal setting and quarterly tracking for high-performing teams.

Live demo: https://atomquest.vercel.app

## Demo Credentials

| Role | Email | Password |
| --- | --- | --- |
| Employee | alice@atomquest.demo | Password123! |
| Manager | manager@atomquest.demo | Password123! |
| Admin | admin@atomquest.demo | Password123! |

## Project Overview

AtomQuest is a full-stack goals and performance-tracking system that supports a
quarterly planning cycle. Employees draft goals, managers review and approve
goal sheets, and progress is tracked through quarterly achievements and manager
check-ins. Admins can publish shared goals, run escalations, and review audit
logs for locked goal sheets.

## Architecture

- Frontend: React + Vite SPA authenticated with JWT bearer tokens.
- Backend: Express API with Prisma Client for data access.
- Database: PostgreSQL.

See the system sketch in [docs/architecture.txt](docs/architecture.txt).

## Tech Stack

- Frontend: React, Vite, Tailwind CSS, Recharts
- Backend: Node.js, Express, Prisma, JWT, Nodemailer
- Database: PostgreSQL

## Key Features

- Goal setting and approval workflow (draft, submit, approve, lock).
- Quarterly achievement tracking with computed goal health.
- Shared goals: admins push a single KPI to many employees; updates sync across
	linked owners.
- Escalation rules: automated alerts for overdue submission and approval.
- Audit trail for post-lock changes.
- Reporting: CSV export and dashboard trend data.

## Domain Model (High Level)

- Users: employee, manager, admin.
- Goal sheets per cycle year containing goals.
- Goals contain quarterly achievements and manager check-ins.
- Cycles define quarterly dates and goal-setting windows.
- Audit logs capture changes to locked data.

## API Overview

All routes are prefixed with `/api` unless noted.

- Auth
	- POST `/auth/login`
- Goal sheets
	- GET `/goalsheets/me`
	- POST `/goalsheets`
	- PUT `/goalsheets/:id/submit`
	- PUT `/goalsheets/:id/approve`
	- PUT `/goalsheets/:id/return`
	- PUT `/goalsheets/:id/unlock`
	- GET `/goalsheets/team`
	- GET `/goalsheets/all`
- Goals and achievements
	- PATCH `/goals/:id`
	- PATCH `/achievements/:id`
	- POST `/checkins`
- Admin
	- POST `/admin/shared-goals`
	- GET `/admin/audit`
	- POST `/admin/escalations/run`
- Reports and dashboard
	- GET `/reports/planned-actual.csv`
	- GET `/dashboard/completion`
	- GET `/dashboard/trends`
- Health checks (no auth required)
	- GET `/health`, `/healthz`, `/api/health`, `/api/healthz`
	- GET `/api/health/db`

## Getting Started (Local)

### Prerequisites

- Node.js 20+
- PostgreSQL 14+
- npm

### 1) Backend setup

```bash
cd backend
npm install
```

Create a `.env` file in `backend/`:

```bash
DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/atomquest
JWT_SECRET=replace-me
FRONTEND_URL=http://localhost:5173
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your-user
SMTP_PASS=your-pass
EMAIL_FROM=AtomQuest <no-reply@atomquest.local>
ESCALATION_DAYS_SUBMIT=7
ESCALATION_DAYS_APPROVAL=5
ENABLE_ESCALATIONS=true
```

Initialize Prisma and seed demo data:

```bash
npx prisma generate
npx prisma migrate dev
npx prisma db seed
```

Start the API:

```bash
npm run dev
```

The API listens on `http://localhost:4000` by default.

### 2) Frontend setup

```bash
cd frontend
npm install
```

Create a `.env` file in `frontend/`:

```bash
VITE_API_URL=http://localhost:4000/api
```

Start the web app:

```bash
npm run dev
```

Open `http://localhost:5173` and sign in with the demo credentials.

## Environment Variables

### Backend

| Variable | Purpose |
| --- | --- |
| DATABASE_URL | PostgreSQL connection string used by Prisma. |
| JWT_SECRET | Secret used to sign JWT tokens. |
| FRONTEND_URL | Allowed origin for CORS (frontend base URL). |
| SMTP_HOST | SMTP hostname for escalation emails. |
| SMTP_PORT | SMTP port. |
| SMTP_USER | SMTP user. |
| SMTP_PASS | SMTP password. |
| EMAIL_FROM | Sender identity for outbound emails. |
| ESCALATION_DAYS_SUBMIT | Days before submitting goals triggers escalation. |
| ESCALATION_DAYS_APPROVAL | Days before approval triggers escalation. |
| ENABLE_ESCALATIONS | Set to `false` to disable scheduler. |
| PORT | Optional API port override (default: 4000). |

### Frontend

| Variable | Purpose |
| --- | --- |
| VITE_API_URL | Base URL for the API. |

## Scripts

### Backend

- `npm run dev` - start API with nodemon.
- `npm start` - start API.
- `npm run prisma` - Prisma CLI passthrough.
- `npm run seed` - seed database with demo data.

### Frontend

- `npm run dev` - start Vite dev server.
- `npm run build` - build production assets.
- `npm run preview` - preview the production build.

## Deployment Notes

- Backend
	- Dockerfile is in `backend/` and exposes port 4000.
	- `backend/start.sh` runs `prisma migrate deploy`, seeds production data, and
		starts the API.
	- Procfile is provided for platforms that use it.
- Frontend
	- `frontend/vercel.json` configures SPA routing for Vercel.
	- Set `VITE_API_URL` during build to point at your deployed API.

## Troubleshooting

- If CORS errors occur, confirm `FRONTEND_URL` matches the frontend origin.
- If Prisma fails to connect, verify `DATABASE_URL` and database availability.
- If escalation emails do not send, validate SMTP settings and `ENABLE_ESCALATIONS`.

## Project Structure

```
backend/        Express API, Prisma, migrations, seeders
frontend/       React SPA, Tailwind styles
docs/           Architecture notes
```
