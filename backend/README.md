# Backend API

## Routes
- POST `/api/auth/login`
- GET `/api/goalsheets/me`
- POST `/api/goalsheets`
- PUT `/api/goalsheets/:id/submit`
- PUT `/api/goalsheets/:id/approve`
- PUT `/api/goalsheets/:id/return`
- PUT `/api/goalsheets/:id/unlock`
- GET `/api/goalsheets/team`
- GET `/api/goalsheets/all`
- PATCH `/api/goals/:id`
- PATCH `/api/achievements/:id`
- POST `/api/checkins`
- POST `/api/admin/shared-goals`
- GET `/api/admin/audit`
- POST `/api/admin/escalations/run`
- GET `/api/reports/planned-actual.csv`
- GET `/api/dashboard/completion`
- GET `/api/dashboard/trends`

## Env
- `DATABASE_URL`
- `JWT_SECRET`
- `FRONTEND_URL`
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM`
- `ESCALATION_DAYS_SUBMIT`, `ESCALATION_DAYS_APPROVAL`, `ENABLE_ESCALATIONS`
