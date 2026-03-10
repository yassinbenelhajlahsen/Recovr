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

## Code Style & Modularity

- **Keep files focused** — components should render JSX, not own business logic. If a file exceeds ~150 lines, consider whether state/effects/handlers belong in a hook.
- **Extract hooks for non-trivial logic** — any `useState` + `useEffect` + handlers combination that isn't purely local UI state (e.g. open/close) should live in a colocated `hooks/` directory next to the component.
- **No duplicate UI** — before building a new component, check if an existing one covers the need. Shared UI (goal selectors, icon sets, inputs) lives in `src/components/ui/`.
- **All shared types in `src/types/`** — if a type is used by more than one file, or likely will be, it goes in the appropriate file under `src/types/`. Only truly one-off local shapes (e.g. a single `type View = "a" | "b"` used nowhere else) may stay inline.
- **Shared icons in `src/components/ui/icons.tsx`** — never define SVG icon components inline in a feature file. Add them to the shared icons file and import from there.
- **Colocate hooks** — hooks used by a single component family go in a `hooks/` subdirectory alongside those components (e.g. `workout/hooks/`, `settings/hooks/`). Hooks used app-wide go in `src/lib/` or `src/hooks/`.

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

- `prisma/seed.ts` is split into two functions: `seedExercises()` and `seedWorkouts()`
- `seedExercises()` **never deletes** default exercises — `WorkoutExercise` has `onDelete: Cascade` on the exercise FK, so deleting exercises cascades and wipes all sets. Instead it fetches existing names, inserts missing exercises, and updates `muscle_groups`/`equipment` on existing ones.
- `seedWorkouts()` inserts 10 dev workouts (Push/Pull/Legs/Arms/Core) spread across the past ~6.5 days for user `66894e73-822a-493f-9955-ef11a7378fb4`. Uses `[seed]` tag in `notes` for idempotency — re-running skips already-inserted workouts. Gracefully skips if the user doesn't exist.
- Both functions are idempotent — safe to re-run at any time without losing user workout data.

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
│   ├── DashboardClient.tsx     # Main client component (list + drawer + recovery panel)
│   ├── workout/
│   │   ├── WorkoutDetailDrawer.tsx # Drawer with 4 views: create/view/edit/summary (AnimatePresence)
│   │   ├── WorkoutForm.tsx     # Create/edit workout form (uses hooks + sub-components)
│   │   ├── WorkoutSummaryView.tsx  # Summary view after logging a workout
│   │   ├── WorkoutViewDetail.tsx   # View mode: loaded workout + skeleton states
│   │   ├── ExerciseSearchPanel.tsx # Exercise search + custom exercise form (animated results)
│   │   ├── ExerciseCard.tsx    # Single exercise card with sets grid
│   │   ├── WorkoutsFilter.tsx  # Search + date range filters
│   │   ├── DeleteWorkoutButton.tsx # Two-step confirm delete (idle: text-primary, confirming: danger)
│   │   └── hooks/
│   │       ├── useWorkoutDetail.ts  # Fetch-on-open logic for the drawer
│   │       ├── useExerciseSearch.ts # Search state, debounce, cache, outside-click
│   │       ├── useExerciseList.ts   # Exercise/set CRUD state
│   │       └── useWorkoutForm.ts    # Form state (date/notes/duration/saving/error), handleSubmit, createCustomExercise
│   ├── recovery/
│   │   ├── RecoveryPanel.tsx   # Dashboard sidebar: dual body maps + status list
│   │   ├── RecoveryView.tsx    # Full-page recovery view
│   │   ├── RecoverySummary.tsx # Compact summary widget
│   │   ├── BodyMapFront.tsx    # Front SVG body map (uses @mjcdev/react-body-highlighter)
│   │   ├── BodyMapBack.tsx     # Back SVG body map
│   │   ├── MuscleDetailPanel.tsx # Tap-to-inspect muscle stats panel
│   │   ├── recoveryColors.ts  # HSL fill interpolation, status color/label maps, buildBodyMapCss
│   │   └── hooks/
│   │       └── useRecoverySelection.ts # selectedMuscle state, handleSelect toggle, muscleMap, status counts
│   ├── layout/
│   │   ├── Navbar.tsx          # Top nav bar (logo, nav links, avatar button)
│   │   ├── UserMenu.tsx        # Avatar dropdown: theme toggle, settings, sign out
│   │   └── hooks/
│   │       └── useNavbar.ts    # Auth subscription, profile fetch, menu/settings state, handleSignOut
│   │   ├── ThemeProvider.tsx   # Theme context + useTheme hook
│   │   ├── ThemeToggle.tsx     # Theme toggle button
│   │   └── PageTransition.tsx  # Zone-based page transition animations
│   ├── onboarding/
│   │   ├── OnboardingFlow.tsx  # Multi-step onboarding form (name, body metrics, goal)
│   │   └── MetricsInputs.tsx   # Reusable height/weight input fields
│   ├── settings/
│   │   ├── SettingsDrawer.tsx  # Settings drawer: profile, body metrics, goals (all functional)
│   │   ├── AccountTab.tsx      # Profile + account deletion tab (uses colocated hooks)
│   │   ├── FitnessTab.tsx      # Body metrics + goals tab (uses useFitnessForm + GoalSelector)
│   │   ├── SectionHeader.tsx   # Shared section header component
│   │   └── hooks/
│   │       ├── useProfileSave.ts    # name state, dirty check, handleSaveProfile
│   │       ├── usePasswordReset.ts  # all password state + handleResetPassword
│   │       ├── useDeleteAccount.ts  # confirm/deleting state + handleDeleteAccount
│   │       └── useFitnessForm.ts    # unitSystem/height/weight/goals state, dirty check, handleSaveFitness
│   └── ui/
│       ├── Modal.tsx
│       ├── Drawer.tsx          # flushSync on open to fix first-open animation (React 18)
│       ├── DropdownMenu.tsx    # Portal dropdown: DropdownMenu, DropdownMenuItem, DropdownMenuDivider
│       ├── FloatingInput.tsx   # Floating label input component
│       ├── PasswordChecklist.tsx # Password validation checklist
│       ├── GoalSelector.tsx    # Shared goal pills grid + optional "or" divider + custom goal input; exports GOALS const
│       └── icons.tsx           # Shared SVG icons: EyeIcon, EyeOffIcon, SunIcon, MoonIcon, SettingsIcon, SignOutIcon
├── store/
│   ├── workoutStore.ts         # Drawer state (isDrawerOpen, drawerView, openDrawer, closeDrawer, setDrawerView)
│   ├── appStore.ts             # App-wide state (isOnboarding flag)
│   └── clientStore.ts          # Client hydration state (mounted, isDark) — MutationObserver on <html> class
├── lib/
│   ├── prisma.ts               # Singleton PrismaClient
│   ├── recovery.ts             # calculateRecovery(userId) — recovery engine (no new DB tables)
│   ├── units.ts                # Height/weight unit conversion and display utilities
│   ├── utils.ts                # Shared: uid() local ID generator, formatDate/formatDateShort, fadeSlide animation config
│   └── supabase/
│       ├── client.ts           # Browser client
│       ├── server.ts           # Server client
│       ├── middleware.ts       # Middleware session refresh
│       └── ensure-user.ts      # Syncs auth user to DB after sign-in
├── generated/prisma/           # Auto-generated Prisma client (gitignored)
└── proxy.ts                    # Next.js 16 proxy — route protection via updateSession()
prisma/
├── schema.prisma               # Data models
├── seed.ts                     # Exercises + dev workout seed (split into seedExercises / seedWorkouts)
├── data/
│   ├── exercises.json          # Default exercise library (92 exercises, seeded with user_id: null)
│   └── workouts.json           # 10 dev workout templates (Push/Pull/Legs/Arms/Core) for local testing
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

- **`src/store/workoutStore.ts`** — drawer state, view routing, workout preview data, and session summary data
  - `isDrawerOpen: boolean` — whether `WorkoutDetailDrawer` is open
  - `drawerView: DrawerView | null` — current view inside the drawer: `"create" | "view" | "edit" | "summary"`
  - `openDrawer(workoutId?, preview?)` — opens drawer; no ID → `"create"`, with ID → `"view"`
  - `closeDrawer()` — closes and resets all drawer state
  - `setDrawerView(view, session?)` — transitions between views; used to go create → summary, view → edit, etc.
  - `activeSession: SessionSummaryData | null` — set on save, read by the summary view
  - `previewData: WorkoutPreview | null` — instant preview from card click while full detail loads
- **`src/store/appStore.ts`** — app-wide state: `isOnboarding` flag (used by Navbar to hide nav links during onboarding flow)
- **`src/store/clientStore.ts`** — client-only hydration state: `mounted` (true after first client render) and `isDark` (mirrors `document.documentElement.classList`). Uses a `MutationObserver` to stay in sync with theme class changes. Call `hydrate()` once in a top-level client component; returns a cleanup function. Used to avoid SSR hydration mismatches for theme-dependent rendering.
- **Key types**: `SessionSummaryData` (full workout data for the summary view), `WorkoutPreview` (summary from list for instant drawer preview)
- **Pattern — pass data through store, not refetch**: When navigating between views (e.g., form save → summary, card click → drawer), pass available data via the store instead of fetching from the API. Components render immediately with the data they have.
  - `WorkoutDetailDrawer`: summary view reads `activeSession` directly (no fetch); uses `previewData` from card click for instant skeleton preview while full detail loads; after edit save, updates local `workout` state from `onSave` data without refetching
  - `WorkoutForm.onSave`: passes full workout data constructed from local state — consumers use this instead of refetching
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
