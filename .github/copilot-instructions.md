# TestPilot QA workspace notes

## Stack
- Next.js App Router with TypeScript and React.
- Tailwind CSS v4 plus the dashboard styles in `src/app/globals.css`.
- Use `lucide-react` for interface icons.
- SQLite persists organizations, demo users, projects, suites, cases, runs, results, and activity in the ignored `data/` directory through Next.js Route Handlers.
- The email picker is a demo identity selector only. Never describe it as verified authentication or use it to authorize real data.

## Project conventions
- Keep shared types aligned between `src/lib/test-cases.ts` and the SQLite schema/query layer in `src/lib/database.ts`.
- Keep database access server-side in Route Handlers; do not import the SQLite database module into client components.
- Scope reads and mutations to the current demo user's organization; replace the demo cookie with a verified server-side auth session before production use.
- Verify changes with `npm run lint` and `npm run build`.

## Setup checklist
- [x] Clarify requirements: mini QA test-management dashboard, localhost-ready.
- [x] Scaffold Next.js App Router with TypeScript and Tailwind.
- [x] Add responsive QA dashboard, test-case workflows, and demo persistence.
- [x] Add Lucide React and a local SQLite backend.
- [x] Add seeded demo identities and SQLite-backed dashboard history data.
- [x] Document local run and SQLite setup in README.
- [x] Validate lint and production build.
- [x] No extra VS Code extensions needed.
