# Little Rituals

“Small things. Soft moments. A little more care for you.”

Little Rituals is a private skincare and self-care journal built with React + Vite, JavaScript/JSX, CSS, Node.js + Express, and Supabase Auth/PostgreSQL. It provides product and ingredient libraries, routines, journal and water tracking, progress, evidence-based achievements, and privacy export. It is for personal tracking and general education, not diagnosis or treatment.

## Run locally

Requirements: Node.js 20.19+ or 22.12+ and npm.

1. Copy `.env.example` to `.env` and replace the placeholders locally. Keep `.env` private and untracked.
2. Install dependencies from the repository root: `npm install`.
3. Start the frontend and API together: `npm run dev`.
4. Open `http://localhost:5173`. The API health check is `http://localhost:3000/api/health`.
5. Create a production frontend build with `npm run build`.
6. Run backend tests with `npm test --workspace backend`.

Root `.env` variables:

| Variable | Used by | Purpose |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | Frontend | Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Frontend | Supabase publishable/anon key only |
| `VITE_API_URL` | Frontend | API base URL; local default is `http://localhost:3000/api` |
| `SUPABASE_URL` | Backend | Same Supabase project URL |
| `SUPABASE_PUBLISHABLE_KEY` | Backend | Verifies user JWTs and accesses RLS-protected records |
| `FRONTEND_ORIGIN` | Backend | Exact allowed frontend origin for CORS |
| `PORT` | Backend | Local API port; defaults to `3000` |

Normal app operations do not use a service-role key. Never add a service-role key to the frontend or commit credentials.

## Supabase

The application expects the fresh Little Rituals Supabase project and the migration in `database/migrations/0001_initial.sql` to be applied once. Do not run it again against an existing database without first checking migration state. The migration enables RLS and user ownership policies for private records. Ingredient catalog rows are shared read-only reference data. Set Supabase Auth to allow the deployed frontend origin and the app's password-recovery route (`/reset-password`) as a redirect URL. Review the SQL in `database/migrations` before applying any future database change.

Achievements are computed from saved `routine_completions` and `journal_entries`; certificates unlock only when those records prove the required consecutive dates. Awards are derived on request and no duplicate award rows or migrations are needed. Privacy export is authenticated and user-scoped. In-app account deletion is intentionally unavailable: Supabase Auth user deletion requires a trusted admin operation. Project owners can delete a user in Supabase Dashboard → Authentication → Users; the current schema cascades associated app records from the profile.

## Deploy the fresh project separately

Deploy two Vercel projects from this repository. No deployment is performed by this project setup.

### Frontend Vercel project

- Root directory: `frontend`
- Framework: Vite
- Build command: `npm run build`
- Output directory: `dist`
- Environment variables for Production (and Preview if used): `VITE_API_URL=https://<your-api-domain>/api`, `VITE_SUPABASE_URL`, and `VITE_SUPABASE_PUBLISHABLE_KEY`.
- `frontend/vercel.json` rewrites app routes to the SPA entry point.

### Backend Vercel project

- Root directory: `backend`
- Framework/runtime: Express, Node.js entry at `src/server.js`
- Environment variables: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, and `FRONTEND_ORIGIN=https://<your-frontend-domain>`. Vercel supplies the port. Configure the production frontend's exact origin; CORS is intentionally not wildcarded.
- Do not set or expose a service-role key for normal API requests.

After both projects deploy, set the frontend `VITE_API_URL` to the backend URL plus `/api`, then redeploy the frontend because Vite variables are embedded at build time. In Supabase Auth URL Configuration, set the frontend's production URL as the Site URL and add the production recovery redirect URL. Check `/api/health`, sign-in, and one private API call on the deployed domains. For Vercel preview deployments, configure the exact preview origin in the backend CORS environment before testing.

## Project map

- `frontend/`: React + Vite app, routes, styles, Supabase Auth client, and API client.
- `backend/`: Express routes, access-token verification, request validation, and backend tests.
- `database/migrations/`: PostgreSQL schema and RLS policies.
- `docs/`: schema and API notes.

Some routes for later ideas remain informational placeholders. Weather, cycle tracking, AI diagnosis, chatbot, social, and payment features are not implemented.
