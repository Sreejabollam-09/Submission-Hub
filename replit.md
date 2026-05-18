# AtomQuest Goal Tracker

A full-stack Goal Setting & Tracking Portal built for ATOMQUEST HACKATHON 1.0, supporting Employee, Manager, and Admin roles with goal creation, approval workflows, quarterly check-ins, progress scoring, and analytics.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/goal-portal run dev` — run the React frontend (port 21164)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Demo Accounts

| Name | Email | Password | Role |
|------|-------|----------|------|
| Alice Johnson | alice@company.com | pass123 | Employee |
| Bob Smith | bob@company.com | pass123 | Manager |
| Carol White | carol@company.com | pass123 | Admin |
| David Lee | david@company.com | pass123 | Employee |
| Eve Chen | eve@company.com | pass123 | Employee |
| Frank Miller | frank@company.com | pass123 | Employee |

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React 18 + Vite + Tailwind CSS + shadcn/ui + Recharts
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)
- Routing: Wouter

## Where things live

- `artifacts/goal-portal/src/` — React frontend source
  - `pages/` — Login, Dashboard, GoalSheets, CheckIns, Analytics, Reports, Admin, SharedGoals
  - `components/layout/` — Sidebar, Layout
  - `lib/auth.ts` — Auth helpers, user storage
- `artifacts/api-server/src/routes/` — Express route handlers
  - auth, users, cycles, thrust-areas, goal-sheets, goals, shared-goals, check-ins, dashboard, reports
- `lib/db/src/schema/` — Drizzle schema (8 tables)
- `lib/api-spec/openapi.yaml` — OpenAPI contract

## Architecture decisions

- **Header-based auth**: Uses `x-user-id` header (not sessions/JWT) for simplicity in hackathon demo
- **Plain-text passwords**: Demo only — no bcrypt for hackathon speed
- **Role-based UI + API**: Employees see their own data; managers see their team; admins see everything
- **Progress scoring per UoM**: numeric_min=Ach/Target×100, numeric_max=Target/Ach×100, zero=100 if Ach="0", timeline=client-side
- **Approval workflow**: draft→submitted→approved (or returned to draft); locked on approval

## Product

- **Employee**: Create goal sheet (max 8 goals, min 10% each, total 100%), submit for approval, submit quarterly check-ins with progress against each goal
- **Manager**: Review team goal sheets, approve or return with comments, view team progress
- **Admin**: All manager capabilities plus admin panel (users, cycles, thrust areas), full audit trail, reports

## User preferences

- Dark navy sidebar theme with indigo primary color
- Inter font

## Gotchas

- The API server must be running for login to work (the frontend calls `/api/auth/login`)
- Vite aliases `react` and `react-dom` to goal-portal's local `node_modules` to prevent duplicate React instances with workspace packages
- Goal sheet submit validates total weightage server-side; frontend checks before calling API
- `pnpm --filter @workspace/db run push` must be run to apply schema changes to dev DB

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
- DB schema source of truth: `lib/db/src/schema/index.ts`
- API contract source of truth: `lib/api-spec/openapi.yaml`
- Theme variables: `artifacts/goal-portal/src/index.css`
