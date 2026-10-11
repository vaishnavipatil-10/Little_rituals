# Feature implementation checklist

## Stage 1 — foundation
- [x] Inspect fresh workspace and define React/Vite + Express + Supabase architecture
- [x] Add initial schema, RLS, brand assets, environment template, setup docs
- [x] Install dependencies and verify the production frontend build
- [x] Verify Express health and not-found responses

## Stage 2 — authentication and routing (in progress)
- [x] Supabase client/session restoration and password auth flows
- [x] Protected/public route gates and starter dashboard shell
- [x] Express Supabase access-token validation boundary
- [x] User-scoped profile and skin preference API and settings screen
- [ ] Validate registration, login, password reset, and private API against the user's new Supabase project
- [ ] Profile photo upload (requires private Supabase Storage bucket and policies)

## Later stages
- [ ] Stage 3: products, ingredient explorer, routines, journal, water
- [ ] Stage 4: dashboard, real-data charts, compatibility rules, patch tests
- [ ] Stage 5: server-validated XP, quests, badges, garden, bingo, certificates
- [ ] Stage 6: optional cycle tracking and evidence-based personal summaries
- [ ] Stage 7: weather provider, reminders, expiry, reports, exports
- [ ] Stage 8: integration/security/accessibility/responsive review and deployment docs

Features remain unchecked until implemented and verified against real data or a clearly isolated development setup.
