# Available Player Portal

Dedicated tool for player discovery
Enhances SLUGGER, the Atlantic League of Professional Baseball’s analytics platform
Introduces a widget for identifying professional baseball players
Centralizes information on available players near MLB level
Provides a searchable, league-specific interface for player discovery (specifically players leaving/available from the Major League)
Supports coaches, league staff, and decision-makers in roster planning
Improves efficiency and enables data-driven recruiting decisions


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
