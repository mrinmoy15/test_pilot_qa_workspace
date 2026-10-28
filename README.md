# TestPilot QA Workspace

TestPilot is a small QA test-management demo for tracking manual and automated test cases and reviewing sprint regression history. It is an interview portfolio project built with Next.js App Router, React, TypeScript, Tailwind CSS, Lucide React, and SQLite.

## Run locally

1. Install Node.js (20.9 or newer) and npm.
2. Run `npm install` in this project folder once.
3. Run `npm run dev`.
4. Open http://localhost:3000.

On first run, TestPilot creates a local SQLite database at `data/testpilot.sqlite` and seeds demo users, a company workspace, projects, suites, test cases, regression runs, results, and activity. Dashboard metrics, project/suite counts, run charts, and activity are read from SQLite. New test cases, result changes, and deletions are persisted and reflected in run history/activity.

## Demo identities (not real authentication)

Use the account selector in the top bar to switch between the seeded demo identities, for example `jordan.davis@acme.com` and `alex.morgan@acme.com`. The selected email is stored in an HTTP-only demo cookie and determines who is recorded as creating/changing demo data. The email is not verified, and this is **not authentication**: both identities share the same Acme workspace. Do not use this identity mechanism to protect real data.

When replacing SQLite with Supabase, retain the API/data-access boundary and replace the demo session with verified magic-link/OTP authentication. Derive the user and organization from the verified server-side session, not a client-provided email, and enforce organization membership/row-level security on every query.

## What the demo shows

- SQLite-backed organizations, demo users, projects, test suites, test cases, runs, results, and activity.
- Sprint quality summary, pass rate, release readiness, run history, and recent activity derived from stored records.
- Test case management: search, module/status filters, add cases, change results, and delete cases.
- Defect triage examples with defect IDs linked from failing or blocked tests.
- Release readiness and regression run summary.
- Export the currently filtered test cases to CSV.
- SQLite-backed API using Next.js Route Handlers, scoped to the selected demo organization.
- Responsive QA dashboard with Lucide React icons.

## SQLite database

The relational schema and sample records are created automatically when the API is used. To use a different local database file, set `TESTPILOT_DB_PATH` before starting Next.js. The `data/` directory is ignored by Git so local test data is not committed.

This SQLite setup is intended for a local demo or a single persistent Node.js server. Serverless deployments often have ephemeral filesystems and multiple instances; use a hosted database or persistent volume for deployment rather than assuming this local SQLite file will be shared or retained.

## Useful scripts

- `npm run dev` — local development server
- `npm run lint` — ESLint
- `npm run build` — production build
- `npm run start` — serve the production build

## Project map

- `src/app/page.tsx` — QA dashboard, test case actions, and filters
- `src/app/api/test-cases/route.ts` — list and create test cases
- `src/app/api/test-cases/[id]/route.ts` — update results and delete cases
- `src/app/api/session/route.ts` — select a seeded demo identity (not authentication)
- `src/app/api/dashboard/route.ts` — load all dashboard data for the current demo organization
- `src/app/globals.css` — responsive dashboard styling
- `src/lib/database.ts` — SQLite schema/migrations, seed data, and dashboard queries
- `src/lib/demo-session.ts` — demo-only identity cookie helper
- `src/lib/test-cases.ts` — shared QA case types and validation

## Interview walkthrough idea

Show the seeded regression results and seven-day history, switch between the seeded demo accounts, filter by project/suite and failed status, change a result, add a test case, then reload to show SQLite persistence. Be explicit that the account selector is a demo identity picker, not verified email login.
