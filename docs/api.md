# REST API outline

Base URL: `/api`. JSON errors use `{ "error": { "code": "...", "message": "..." } }`. Private routes will require `Authorization: Bearer <Supabase access token>` and derive ownership from the validated token, never a request `user_id`.

## Available now

- `GET /api/health` — confirms the local API process is responding; it does not test Supabase connectivity.
- `GET /api/me` — protected; validates the bearer access token with Supabase Auth and returns the authenticated user's basic identity. It returns `503 AUTH_NOT_CONFIGURED` when backend Supabase settings are missing and `401 UNAUTHORIZED` for absent/invalid sessions.
- `GET /api/profile` / `PATCH /api/profile` — protected; read or update the caller's own display name.
- `GET /api/profile/skin` / `PATCH /api/profile/skin` — protected; read or update the caller's own skin type, concern tags, avoid-list, and self-care goals.

## Planned route groups

- `/profile`, `/skin-profile`, `/settings`
- `/products`, `/products/:id`, `/products/:id/reviews`
- `/ingredients`, `/ingredients/:id`, `/compatibility/check`
- `/routines`, `/routines/:id/steps`, `/routines/:id/completions`
- `/journal`, `/water`, `/dashboard`, `/reports`
- `/gamification/quests`, `/gamification/badges`, `/garden`, `/bingo`, `/certificates`
- `/cycle` (only when opted in), `/cycle/insights`
- `/patch-tests`, `/weather`, `/goals`, `/travel-kits`, `/reminders`

Routes will be added with their feature stages and documented with validation, ownership, status codes, and behavior. This outline is not a claim that those endpoints work today. Private route middleware passes the caller JWT through to Supabase so later table requests remain subject to RLS; no browser-supplied user id establishes ownership.
