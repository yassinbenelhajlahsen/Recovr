# Recovr — Project Context

## Stack

- **Next.js 16** (App Router, `src/` directory, `@/*` import alias)
- **Tailwind CSS v4** (class-based dark mode via `@custom-variant dark`)
- **Supabase Auth** (`@supabase/ssr`) — email/password + Google OAuth
- **Prisma 7** (schema in `prisma/schema.prisma`, client output in `src/generated/prisma`)
- **TypeScript**

## Key Commands

```bash
npm run dev              # Start dev server (http://localhost:3000)
npx prisma migrate dev   # Create and apply a new migration
npx prisma generate      # Regenerate Prisma client after schema change
npx prisma db seed       # Seed default exercises
npx prisma studio        # Open Prisma Studio (DB GUI)
```

## Auth Patterns

- **Client Components**: use `createClient()` from `@/lib/supabase/client`
- **Server Components / Route Handlers**: use `await createClient()` from `@/lib/supabase/server`
- **Middleware**: session refresh is handled in `src/proxy.ts` (Next.js 16 `proxy` export), which calls `updateSession()` from `src/lib/supabase/middleware.ts`
- After `signInWithPassword`, call `ensureUserInDb(user)` from `@/lib/supabase/ensure-user` to sync user to Prisma DB
- OAuth and email confirmation flows sync user via `src/app/auth/callback/route.ts`
- **OAuth callback upsert**: use `where: { email }` (not `id`) to avoid P2002 unique constraint errors when a user has previously signed up with email/password and then signs in with OAuth (same email, different Supabase user ID). The `update` sets `id` to the OAuth user's ID to keep the DB in sync.
- **Supabase identity linking**: enable "Prevent duplicate emails across providers" in Auth settings so users can't accidentally create two accounts. Once linked, Supabase shows both providers on the same user entry.
- **Google OAuth is configured** in Supabase dashboard (enabled, redirect URL set)
- **Asymmetric JWT signing keys (RS256)** are enabled in Supabase dashboard

### `getClaims()` vs `getUser()` strategy

- **Read-only endpoints** (GET routes, middleware, server components) use `supabase.auth.getClaims()` — verifies the JWT locally using cached JWKS public keys (no HTTP round-trip to Supabase auth server, <1ms vs ~50-200ms)
- **Mutations** (POST, PUT, DELETE) use `supabase.auth.getUser()` — validates the session server-side, ensuring revoked sessions can't modify data
- **Client components** (e.g., Navbar) use `getUser()` on the browser client — this reads from the local session, not a server call, so it's fine
- `getClaims()` returns `{ data: { claims, header, signature }, error }` — extract user ID via `claims.claims.sub` and email via `claims.claims.email`
- `getClaims()` still fully verifies JWT signature — a forged or expired token will fail. The only difference from `getUser()` is it won't catch server-side session revocations (e.g., manually banning a user from the Supabase dashboard). Revoked users can still read data until their JWT expires (default 1 hour).
- **Prerequisite**: asymmetric JWT keys must be enabled in Supabase dashboard (Settings > Auth > Signing Keys). The `@supabase/ssr` client auto-fetches the public key from `https://<project-ref>.supabase.co/.well-known/jwks.json` — no env vars needed.

## Database

- Prisma v7 config lives in `prisma.config.ts` (reads `.env`)
- `DATABASE_URL` = pooled connection (port 6543, `?pgbouncer=true`, for runtime)
- `DIRECT_URL` = direct connection (port 5432, for migrations)
- Prisma client is imported from `@/generated/prisma/client` (NOT `@prisma/client`)
- Prisma v7 requires a driver adapter: `new PrismaClient({ adapter: new PrismaPg({ connectionString: DATABASE_URL }) })`
- Singleton pattern in `src/lib/prisma.ts`

### Connection pooling

- **PgBouncer** (`?pgbouncer=true` on `DATABASE_URL`): Supabase's connection proxy on port 6543. Reuses pre-established Postgres connections instead of creating new ones per request (~5ms vs ~50-100ms cold connect). Also prevents connection exhaustion under concurrent serverless invocations (Postgres default limit ~100).
- **PrismaPg pool** (`src/lib/prisma.ts`): application-level pool with `max: 3` (right-sized for serverless — each instance gets its own pool), `connectionTimeoutMillis: 5000` (fail fast instead of hanging), `idleTimeoutMillis: 30000` (clean up idle connections).

### Query optimization

- Prefer `select` over `include` to reduce data transfer — only fetch columns the frontend actually uses
- Example: `sets: { select: { id: true, set_number: true, reps: true, weight: true } }` instead of `sets: true` (avoids sending `workout_exercise_id`, `created_at`, etc.)
- For the workout list (dashboard), only `{ id: true }` is needed for sets (just counting them)

## Design System

- **Fonts**: Fraunces (display/headlines, `font-display`), Geist Sans (body/UI, `font-sans`)
- **Color tokens**: defined as CSS custom properties in `globals.css` (:root + .dark), mapped to Tailwind via `@theme inline`
- **Semantic classes**: `bg-bg`, `bg-surface`, `bg-elevated`, `text-primary`, `text-secondary`, `text-muted`, `text-accent`, `bg-accent`, `border-border`, `border-border-subtle`, `text-danger`, `text-success`, `text-recovery-yellow`
- **Recovery yellow token**: `--c-recovery-yellow` = `#B8860B` (light) / `#D4A017` (dark) — used for "partial/recovering" muscle status
- **Accent color**: terracotta/coral — `#D4552A` (light) / `#E8633A` (dark) — reserved for primary CTAs and interactive highlights
- **Palette**: warm neutrals (not zinc). Light: off-white `#F7F7F4` bg. Dark: warm black `#0B0B0A` bg
- **Typography hierarchy**: serif italic headlines (`font-display text-4xl italic`), sans-serif body, uppercase tracking-wider labels for section headers
- **Cards**: `bg-surface border border-border-subtle rounded-xl` — background differentiation, not thin borders
- **Buttons**: Primary = `bg-accent text-white rounded-lg`, Secondary = `border border-border text-primary`, Ghost = `text-secondary`
- **Focus rings**: `focus:ring-2 focus:ring-accent/40 focus:border-accent`


## Dark Mode

- Tailwind v4 class-based: `dark` class on `<html>` element
- `ThemeProvider` in `src/components/ThemeProvider.tsx` manages state + localStorage
- Anti-FOUC inline script in `src/app/layout.tsx`
- Do NOT read theme preference server-side (hydration mismatch)
- Color tokens automatically switch via CSS custom properties (`:root` vs `.dark` in globals.css)

## Routing

- `/` → redirects to `/dashboard`
- `/dashboard` — the main screen: greeting, log workout CTA, filters, full workout list + recovery panel (DashboardClient)
- `/recovery` — full recovery page: front+back SVG body maps + tap-to-inspect muscle detail panel

## File Structure

```
src/
├── app/
│   ├── layout.tsx              # Root layout (ThemeProvider, Navbar)
│   ├── page.tsx                # Redirects to /dashboard
│   ├── dashboard/page.tsx      # Unified main screen (Server Component)
│   ├── auth/
│   │   ├── signin/page.tsx
│   │   ├── signup/page.tsx
│   │   └── callback/route.ts   # OAuth + email confirmation handler
│   ├── recovery/
│   │   └── page.tsx            # Full recovery page (Server Component)
│   └── api/
│       ├── exercises/route.ts
│       ├── workouts/route.ts
│       ├── workouts/[id]/route.ts
│       ├── recovery/route.ts   # GET recovery data (uses getClaims())
│       └── user/sync/route.ts
├── components/
│   ├── DashboardClient.tsx     # Main client component (list + modals + recovery panel)
│   ├── WorkoutForm.tsx         # Create/edit workout form
│   ├── WorkoutsFilter.tsx      # Search + date range filters
│   ├── WorkoutDetailDrawer.tsx # Side drawer for workout details
│   ├── SessionSummaryModal.tsx # Post-save success modal
│   ├── DeleteWorkoutButton.tsx
│   ├── PageTransition.tsx      # Zone-based page transition animations
│   ├── Navbar.tsx
│   ├── ThemeProvider.tsx
│   ├── ThemeToggle.tsx
│   ├── recovery/
│   │   ├── RecoveryPanel.tsx   # Dashboard sidebar: dual body maps + status list
│   │   ├── RecoveryView.tsx    # Full-page recovery view
│   │   ├── RecoverySummary.tsx # Compact summary widget
│   │   ├── BodyMapFront.tsx    # Front SVG body map (uses @mjcdev/react-body-highlighter)
│   │   ├── BodyMapBack.tsx     # Back SVG body map
│   │   ├── MuscleDetailPanel.tsx # Tap-to-inspect muscle stats panel
│   │   └── recoveryColors.ts  # HSL fill interpolation + status color/label maps
│   └── ui/
│       ├── Modal.tsx
│       ├── Drawer.tsx
│       ├── FloatingInput.tsx   # Floating label input component
│       └── PasswordChecklist.tsx # Password validation checklist
├── store/
│   └── workoutStore.ts         # Zustand store (modal state, preview data, session summary)
├── lib/
│   ├── prisma.ts               # Singleton PrismaClient
│   ├── recovery.ts             # calculateRecovery(userId) — recovery engine (no new DB tables)
│   └── supabase/
│       ├── client.ts           # Browser client
│       ├── server.ts           # Server client
│       ├── middleware.ts       # Middleware session refresh
│       └── ensure-user.ts      # Syncs auth user to DB after sign-in
├── generated/prisma/           # Auto-generated Prisma client (gitignored)
└── proxy.ts                    # Next.js 16 proxy — route protection via updateSession()
prisma/
├── schema.prisma               # Data models
├── seed.ts                     # Default exercises seed (imports from ./data/exercises.json)
├── data/
│   └── exercises.json          # Default exercise library (92 exercises, seeded with user_id: null)
└── migrations/                 # Migration history
```

## Recovery Engine

- **No new DB tables** — computed on-the-fly from last 96h workouts via `calculateRecovery(userId)` in `src/lib/recovery.ts`
- **Algorithm**: `volume_factor = clamp(volume / 5000, 0.8, 1.5)`, `adjusted_hours = 48 * factor`, `pct = clamp(hours_since / adjusted_hours, 0, 1)`
- **Status thresholds**: `recovered` ≥ 0.85, `partial` ≥ 0.45, `fatigued` < 0.45
- **16 muscle groups**: chest, triceps, shoulders, lower back, hamstrings, glutes, traps, back, biceps, rear shoulders, quadriceps, calves, forearms, core, hip flexors, tibialis
- **Multi-workout logic**: tracks worst (most fatigued) result per muscle across all workouts in window
- **SVG body maps**: `@mjcdev/react-body-highlighter` library; `recoveryColors.ts` does HSL interpolation (red→yellow→green) for fill colors
- **Dashboard integration**: `RecoveryPanel` is a sticky right-column sidebar; recovery data is fetched in parallel with workouts in `dashboard/page.tsx`

## State Management (Zustand)

- **Store**: `src/store/workoutStore.ts` — manages modal/drawer state, workout preview data, and session summary data
- **Key types**: `SessionSummaryData` (full workout data for post-save modal), `WorkoutPreview` (summary from list for instant drawer preview)
- **Pattern — pass data through store, not refetch**: When navigating between views (e.g., form save → summary modal, card click → drawer), pass available data via the store instead of fetching from the API. Components render immediately with the data they have.
  - `SessionSummaryModal`: reads `activeSession` directly from store (no fetch)
  - `WorkoutDetailDrawer`: uses `previewData` from card click to render instant preview (date, exercise names, stats) while full detail loads; uses `onSave` data after edit to update view without refetching
  - `WorkoutForm.onSave`: passes full workout data (date, exercises, sets) constructed from local state — consumers should use this instead of refetching
- **Exercise search cache**: `WorkoutForm` uses a `useRef<Map<string, Exercise[]>>` to cache `/api/exercises` search results per query. Cache is cleared after creating a custom exercise.

## Environment Variables (.env)

See `.env.example` for required keys.
