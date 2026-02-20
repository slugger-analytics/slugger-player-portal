# Available Player Portal

Production-ready scaffold for a **real-time recruitment command center** for Atlantic League baseball teams. The app addresses a 24–48 hour signing window where coaches must identify, evaluate, and contact released players before competitors. A key data concern is the **"Mexico Delay"** — timezone-related reporting gaps from independent leagues that are normalized before display.

## Project overview

The system serves three user types:

| Role | Needs | Primary entry |
|------|--------|----------------|
| **Managers / Coaches** | Real-time dashboard, priority lists, configurable alerts | `/dashboard` |
| **Analysts / Scouts** | Deep statistical comparison tools, exportable data | `/player/compare` |
| **Players / Agents** | Self-submission portal to upload profile for scouting | `/profile/submit` |

## Environment variables

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string (used by Prisma) |
| `TBC_API_KEY` | Baseball Cube API key for `/api/sync/tbc` |
| `MLB_FEED_URL` | MLB transaction / RSS feed URL |
| `INDIE_LEAGUE_FEED_URL` | Independent league transaction feed URL |
| `SMTP_HOST` | SMTP host for email notifications |
| `SMTP_USER` | SMTP username |
| `SMTP_PASS` | SMTP password |
| `NEXTAUTH_SECRET` | Secret for session/auth (if using NextAuth) |
| `CRON_SECRET` | Secret for securing cron-triggered sync routes |

## How to run Cron sync jobs locally

1. Start the app: `npm run dev`
2. Trigger TBC sync: `npm run sync:tbc` (or `curl -X POST http://localhost:3000/api/sync/tbc -H "Authorization: Bearer <CRON_SECRET>"`)
3. Trigger MLB/Indie feed sync: `npm run sync:mlb` (or `curl -X POST http://localhost:3000/api/sync/mlb-feed` with same auth)

Ensure `CRON_SECRET` is set in `.env` and your API routes verify it before running sync logic.

## Scripts

- `npm run dev` — Start Next.js dev server
- `npm run build` / `npm run start` — Production build and start
- `npm run db:generate` — Generate Prisma client
- `npm run db:push` — Push schema to DB (dev)
- `npm run db:migrate` — Run migrations
- `npm run db:studio` — Open Prisma Studio

## Tech stack

- **Next.js 14+** (App Router), **TypeScript**, **Tailwind CSS**
- **Prisma** + PostgreSQL
- **Lucide React** for all icons
- Data-fetching in **Server Components** where possible; **Client Components** only for interactivity (filters, drag-and-drop, notification settings)

## Role-based access

- **RoleGuard** wraps routes that restrict access by `UserRole`.
- **Middleware** redirects authenticated users by role: Manager → `/dashboard`, Analyst → `/player/compare`, Player/Agent → `/profile/submit`.
