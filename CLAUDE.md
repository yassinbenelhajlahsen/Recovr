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

### Seeding

- `prisma/seed.ts` **never deletes** default exercises — `WorkoutExercise` has `onDelete: Cascade` on the exercise FK, so deleting exercises cascades and wipes all sets. Instead the seed fetches existing names, inserts missing exercises, and updates `muscle_groups`/`equipment` on existing ones.
- Safe to re-run at any time without losing user workout data.

### Muscle group naming

- Stored as a string array in Postgres (e.g. `["core", "abs"]`). `"core"` and `"abs"` are separate values — never `"core/Abs"` or similar.
- Search uses `hasSome: [query]` for exact muscle name matching (case-sensitive, so values are always lowercase).
- Both `/api/exercises` and the dashboard workout filter search by name OR muscle group — typing `"core"` or `"abs"` returns matching results.

## Design System

- **Fonts**: Fraunces (display/headlines, `font-display`), Geist Sans (body/UI, `font-sans`)
- **Color tokens**: defined as CSS custom properties in `globals.css` (:root + .dark), mapped to Tailwind via `@theme inline`
- **Semantic classes**: `bg-bg`, `bg-surface`, `bg-elevated`, `text-primary`, `text-secondary`, `text-muted`, `text-accent`, `bg-accent`, `border-border`, `border-border-subtle`, `text-danger`, `text-success`, `text-recovery-yellow`
- **Recovery yellow token**: `--c-recovery-yellow` = `#A07A12` (light) / `#D4A017` (dark) — used for "partial/recovering" muscle status
- **Light mode recovery colors** (muted earthy tones, not vivid primaries): `--c-danger: #B84040`, `--c-success: #3D7056`, `--c-recovery-yellow: #A07A12`. SVG fill anchors use higher lightness (~58-62%) and lower saturation (~35-55%) to avoid clashing with the warm off-white background.
- **SVG fill color rule**: light mode fills must be in the 50–65% lightness range so they read as muted overlays rather than harsh dark blobs on white.
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
- `/onboarding` — locked multi-step onboarding (name → body metrics → goal). Server-side gate: redirects to `/dashboard` if already onboarded, redirects to `/auth/signin` if not authed. Dashboard also redirects here if `onboarding_completed` is false.
- `/dashboard` — the main screen: greeting, log workout CTA, filters, full workout list + recovery panel (DashboardClient)
- `/recovery` — full recovery page: front+back SVG body maps + tap-to-inspect muscle detail panel

## TypeScript Types

- **All shared types live in `src/types/`** — never define reusable types inline in component or lib files
- **Rule**: if a type is used by more than one file, or could be, it goes in `src/types/`. Internal one-off types (e.g. a local state shape used nowhere else) may stay inline.
- **Files**:
  - `src/types/recovery.ts` — `RecoveryStatus`, `MuscleRecovery`, `BodyMapProps`
  - `src/types/workout.ts` — `SetEntry`, `ExerciseEntry`, `Exercise`, `WorkoutFormInitialData`, `WorkoutSaveData`, `WorkoutFormProps`, `WorkoutPreview`, `SessionSummaryData`, `SetData`, `ExerciseData`, `WorkoutExerciseData`, `WorkoutDetail`, `Workout`, `DashboardClientProps`
  - `src/types/user.ts` — `UnitSystem`, `UserProfile`, `Tab`
  - `src/types/theme.ts` — `Theme`, `ThemeContextValue`
  - `src/types/ui.ts` — `DrawerProps`, `ModalProps`, `DropdownMenuProps`, `FloatingInputProps`, `UserMenuProps`, `MetricsInputsProps`, `SettingsDrawerProps`, `FitnessTabProps`
- Import with `import type { Foo } from "@/types/workout"` (always use `import type` for type-only imports)

## File Structure

```
src/
├── types/
│   ├── recovery.ts             # RecoveryStatus, MuscleRecovery, BodyMapProps
│   ├── workout.ts              # All workout/exercise/session types
│   ├── user.ts                 # UnitSystem, UserProfile, Tab
│   ├── theme.ts                # Theme, ThemeContextValue
│   └── ui.ts                   # Component prop interfaces (DrawerProps, ModalProps, etc.)
├── app/
│   ├── layout.tsx              # Root layout (ThemeProvider, Navbar)
│   ├── page.tsx                # Redirects to /dashboard
│   ├── dashboard/page.tsx      # Unified main screen (Server Component)
│   ├── onboarding/page.tsx     # Onboarding gate (Server Component)
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
│       ├── user/sync/route.ts
│       ├── user/profile/route.ts # GET + PUT user profile (height, weight, goal, onboarding)
│       └── user/delete/route.ts  # DELETE user account (Supabase Admin + Prisma cascade)
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
│   ├── UserMenu.tsx            # Avatar dropdown: theme toggle, settings, sign out
│   ├── MetricsInputs.tsx       # Reusable height/weight input fields (used in onboarding + settings)
│   ├── OnboardingFlow.tsx      # Multi-step onboarding form (name, body metrics, goal)
│   ├── settings/
│   │   └── SettingsDrawer.tsx  # Settings drawer: profile, body metrics, goals (all functional)
│   └── ui/
│       ├── Modal.tsx
│       ├── Drawer.tsx
│       ├── DropdownMenu.tsx    # Portal dropdown: DropdownMenu, DropdownMenuItem, DropdownMenuDivider
│       ├── FloatingInput.tsx   # Floating label input component
│       └── PasswordChecklist.tsx # Password validation checklist
├── store/
│   ├── workoutStore.ts         # Zustand store (modal state, preview data, session summary)
│   └── appStore.ts             # Zustand store (app-wide: isOnboarding flag)
├── lib/
│   ├── prisma.ts               # Singleton PrismaClient
│   ├── recovery.ts             # calculateRecovery(userId) — recovery engine (no new DB tables)
│   ├── units.ts                # Height/weight unit conversion and display utilities
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
- **Multi-workout model**: residual fatigue accumulation — `combinedPct = clamp(1 - sum(1 - pct), 0, 1)` across all workouts in window (not just worst case)
- **Bodyweight proxy**: `BODYWEIGHT_PROXY = 75` — sets with `weight = 0` count as 75 lbs for volume calculation
- **Legacy timestamp fix**: midnight UTC timestamps (old workouts) are shifted to noon for accurate recovery aging
- **Status thresholds**: `recovered` ≥ 0.85, `partial` ≥ 0.45, `fatigued` < 0.45
- **16 muscle groups**: chest, triceps, shoulders, lower back, hamstrings, glutes, traps, back, biceps, rear shoulders, quadriceps, calves, forearms, core, abs, hip flexors, tibialis
- **SVG body maps**: `@mjcdev/react-body-highlighter` library; `recoveryColors.ts` does HSL interpolation (red→yellow→green) for fill colors
- **Dashboard integration**: `RecoveryPanel` is a sticky right-column sidebar; recovery data is fetched in parallel with workouts in `dashboard/page.tsx`

## State Management (Zustand)

- **`src/store/workoutStore.ts`** — manages modal/drawer state, workout preview data, and session summary data
- **`src/store/appStore.ts`** — app-wide state: `isOnboarding` flag (used by Navbar to hide nav links during onboarding flow)
- **Key types**: `SessionSummaryData` (full workout data for post-save modal), `WorkoutPreview` (summary from list for instant drawer preview)
- **Pattern — pass data through store, not refetch**: When navigating between views (e.g., form save → summary modal, card click → drawer), pass available data via the store instead of fetching from the API. Components render immediately with the data they have.
  - `SessionSummaryModal`: reads `activeSession` directly from store (no fetch)
  - `WorkoutDetailDrawer`: uses `previewData` from card click to render instant preview (date, exercise names, stats) while full detail loads; uses `onSave` data after edit to update view without refetching
  - `WorkoutForm.onSave`: passes full workout data (date, exercises, sets) constructed from local state — consumers should use this instead of refetching
- **Exercise search cache**: `WorkoutForm` uses a `useRef<Map<string, Exercise[]>>` to cache `/api/exercises` search results per query. Cache is cleared after creating a custom exercise.

## Navbar & User Menu

- **Avatar button** (top right): 36×36 `rounded-full bg-surface border border-border-subtle`, shows user initials (`text-accent`). Initials derived from `user.user_metadata?.full_name` or first letter of email.
- **Dropdown** (`UserMenu.tsx`): opens on avatar click via `DropdownMenu` portal. Contains: email header, theme toggle, settings button, sign out. Closes on route change, Escape, click-outside, scroll.
- **Settings drawer** (`SettingsDrawer.tsx`): right-slide `Drawer` with three sections — Profile (name editable, email read-only), Body Metrics (height/weight), Goals (preset pills + custom text). All sections functional. Navbar lazy-fetches profile via `GET /api/user/profile` when drawer opens. Save calls `PUT /api/user/profile` + `router.refresh()`.
- **`DropdownMenu`**: `position: fixed` anchored via `getBoundingClientRect()`. Framer Motion scale+fade from top-right (`scale 0.95→1, opacity 0→1, y -6→0`, 150ms). `z-50` (above navbar `z-30` and drawer `z-40`).
- `ThemeToggle` component is still present but no longer rendered in the navbar — theme is toggled via the dropdown.

## Onboarding

- **Locked multi-step flow** at `/onboarding` — new users cannot bypass (no skip, no close)
- **3 steps**: Welcome + name → Body metrics (height/weight) → Fitness goal (preset pills + custom)
- **Server-side gate**: dashboard redirects to `/onboarding` if `onboarding_completed` is false; OAuth callback also checks
- **Profile fields on User model**: `height_inches` (Int?), `weight_lbs` (Int?), `fitness_goals` (String[]), `onboarding_completed` (Boolean, default false)
- **Goals**: up to 3 presets (Strength, Hypertrophy, Endurance, Fat Loss) OR 1 custom free text — mutually exclusive
- **API**: `GET /api/user/profile` (getClaims), `PUT /api/user/profile` (getUser) — shared by both onboarding and settings drawer

## Environment Variables (.env)

See `.env.example` for required keys. Key variables:
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — Supabase anon/publishable key
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase service role key (used by `/api/user/delete` to call Admin API)
- `DATABASE_URL` — pooled connection string (PgBouncer, port 6543)
- `DIRECT_URL` — direct connection string (port 5432, for migrations)
