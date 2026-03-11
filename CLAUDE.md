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

- **Keep files focused** — components render JSX, not business logic. Extract to hooks if >~150 lines.
- **Extract hooks for non-trivial logic** — `useState` + `useEffect` + handlers → colocated `hooks/` directory.
- **No duplicate UI** — shared UI lives in `src/components/ui/`.
- **All shared types in `src/types/`** — use `import type { Foo } from "@/types/workout"`.
- **`useRef` typing (React 19)**: `useRef<T>(null)` returns `RefObject<T | null>` — prop types that accept refs must use `RefObject<T | null>`, not `RefObject<T>`.
- **Shared icons in `src/components/ui/icons.tsx`** — never define SVG icons inline.
- **Colocate hooks** — single-feature hooks go in `hooks/` next to the component. App-wide hooks go in `src/lib/` or `src/hooks/`.
- **`toLocalISODate(d?)`** in `src/lib/utils.ts` — returns current (or given) date as `YYYY-MM-DD` in local time. Use this everywhere instead of inline date formatting.

## Auth Patterns

- **Client Components**: `createClient()` from `@/lib/supabase/client`
- **Server Components / Route Handlers**: `await createClient()` from `@/lib/supabase/server`
- **Middleware**: `src/proxy.ts` calls `updateSession()` from `src/lib/supabase/middleware.ts`
- After `signInWithPassword`, call `ensureUserInDb(user)` from `@/lib/supabase/ensure-user`
- OAuth callback syncs user via `src/app/auth/callback/route.ts`
- **OAuth upsert**: use `where: { email }` (not `id`) to avoid P2002 errors when same email exists across providers
- **GET routes** use `getClaims()` (local JWT verification, fast). **Mutations** use `getUser()` (server-side validation).
- `getClaims()` → extract user ID via `claims.claims.sub`, email via `claims.claims.email`

## Database

- Prisma client imported from `@/generated/prisma/client` (NOT `@prisma/client`)
- `DATABASE_URL` = pooled (port 6543, `?pgbouncer=true`), `DIRECT_URL` = direct (port 5432, migrations)
- Prisma v7 requires driver adapter: `new PrismaClient({ adapter: new PrismaPg(...) })`
- Singleton in `src/lib/prisma.ts` — follow the same `globalThis` singleton pattern for any other heavy clients (e.g. `src/lib/openai.ts`)
- Prefer `select` over `include` — only fetch columns the frontend uses

### Seeding

- `seedExercises()` never deletes exercises (cascade would wipe workout data). Upserts only.
- `seedWorkouts()` inserts dev workouts for user `66894e73...`. Uses `[seed]` tag for idempotency.

### Muscle group naming

- Lowercase string arrays: `["core", "abs"]`. Search uses `hasSome`. Never `"core/Abs"`.

## Loading States

- `loading.tsx` files for `/dashboard`, `/recovery`, `/progress`
- Use `className="skeleton"` (custom shimmer in `globals.css`), NOT `animate-pulse`
- Skeletons mirror the real page layout

## Design System

- **Fonts**: Fraunces (`font-display`, headlines), Geist Sans (`font-sans`, body)
- **Color tokens**: CSS custom properties in `globals.css`, mapped via `@theme inline`
- **Semantic classes**: `bg-bg`, `bg-surface`, `bg-elevated`, `text-primary`, `text-secondary`, `text-muted`, `text-accent`, `border-border`, `border-border-subtle`, `text-danger`, `text-success`, `text-recovery-yellow`
- **Accent**: terracotta `#D4552A` (light) / `#E8633A` (dark)
- **Palette**: warm neutrals (not zinc). Light: `#F7F7F4`. Dark: `#0B0B0A`
- **Light mode colors**: muted earthy tones, not vivid. SVG fills in 50-65% lightness range.
- **Typography**: serif italic headlines, sans body, uppercase tracking-wider section labels
- **Cards**: `bg-surface border border-border-subtle rounded-xl`
- **Buttons**: Primary `bg-accent text-white rounded-lg`, Secondary `border border-border`, Ghost `text-secondary`

## Dark Mode

- `dark` class on `<html>`, managed by `ThemeProvider` + localStorage
- Anti-FOUC inline script in `layout.tsx`. Do NOT read theme server-side.

## Routing

- `/` — home: workout list + recovery panel + drawer (create/view/edit/summary)
- `/onboarding` — locked 3-step flow (name → metrics → goal). Server-side gate.
- `/recovery` — SVG body maps + tap-to-inspect muscle detail
- `/progress` — 1RM charts + body weight chart, side-by-side. Full-width layout.

## Key Architecture

### File Structure

```
src/
├── types/              # Shared types (workout.ts, recovery.ts, user.ts, progress.ts, theme.ts, ui.ts)
├── app/                # Pages + API routes
│   ├── api/exercises|workouts|recovery|user/   # REST endpoints
│   └── recovery|progress|onboarding/           # Sub-pages (Server Components)
├── components/
│   ├── DashboardClient.tsx
│   ├── workout/        # WorkoutDetailDrawer, WorkoutForm, ExerciseCard, etc. + hooks/
│   ├── recovery/       # RecoveryPanel, RecoveryView, BodyMap*, MuscleDetailPanel + hooks/
│   ├── progress/       # ProgressClient, charts, selectors + hooks/
│   ├── layout/         # Navbar, UserMenu, ThemeProvider, PageTransition + hooks/
│   ├── onboarding/     # OnboardingFlow, MetricsInputs
│   ├── settings/       # SettingsDrawer, AccountTab, FitnessTab + hooks/
│   └── ui/             # Modal, Drawer, DropdownMenu, FloatingInput, GoalSelector, icons
├── store/              # Zustand: workoutStore, appStore, clientStore
├── lib/                # prisma.ts, openai.ts, recovery.ts, units.ts, utils.ts, supabase/
└── proxy.ts            # Route protection
```

### State Management (Zustand)

- `workoutStore` — drawer open/close, view routing (`create|view|edit|summary`), preview data, session summary
- `appStore` — `isOnboarding` flag
- `clientStore` — SSR hydration safety (`mounted`, `isDark` via MutationObserver)
- **Pattern**: pass data through store, not refetch. Components render immediately with available data.

### Recovery Engine

- Computed on-the-fly from last 96h workouts — no DB tables. See `src/lib/recovery.ts`.
- Status thresholds: `recovered` ≥ 0.85, `partial` ≥ 0.45, `fatigued` < 0.45
- SVG body maps via `@mjcdev/react-body-highlighter`, HSL interpolation in `recoveryColors.ts`
- `RecoveryPanel` (dashboard) is view-only. Full interaction on `/recovery`.

### Body Weight Tracking

- `body_weight Float?` on Workout — optional per-workout entry
- API syncs to `User.weight_lbs` only if it's the most recent workout with body_weight
- Progress chart reads from `Workout.body_weight`, not `User.weight_lbs`

### Onboarding

- Locked 3-step flow, server-side gate on dashboard + OAuth callback
- User fields: `height_inches`, `weight_lbs`, `fitness_goals` (String[]), `onboarding_completed`
- Goals: up to 3 presets OR 1 custom (mutually exclusive)

### AI Suggestions (`/recovery` page)

- `SuggestionTrigger` (server-rendered, receives recovery data) opens a `size="lg"` Drawer
- `SuggestionPanel` + `useSuggestion` hook handle idle/loading/result states; hook uses AbortController to cancel in-flight requests on dismiss
- API route `POST /api/suggest` calls OpenAI via singleton `src/lib/openai.ts`; do NOT trust client-supplied recovery data — always recompute server-side
- Wrap OpenAI calls in try/catch and JSON.parse in try/catch — AI can return errors or malformed JSON
- Result footer has "Dismiss" + "Save as Draft" split buttons; `useSaveDraft` hook in `recovery/hooks/useSaveDraft.ts` POSTs to `/api/workouts/draft`

### Workout Drafts

- `is_draft Boolean @default(false)` and `source String @default("manual")` on Workout model
- Drafts excluded from recovery engine (`is_draft: false` in `calculateRecovery` where clause)
- Drafts excluded from progress charts (all 3 Prisma queries in `src/app/progress/page.tsx`)
- Dashboard includes drafts — "Draft" badge (`text-recovery-yellow`) on workout cards
- Deep-link: after saving draft from `/recovery` → `router.push('/?draft={id}')` → DashboardClient `openDraftId` prop opens drawer on mount, then `router.replace('/')` clears the param
- `POST /api/workouts/draft` — exercise matching (exact name → substring → create custom, resolved **sequentially** to avoid duplicate custom exercises) + creates with `is_draft: true, source: "suggested"`
- `WorkoutForm` also shows "Save as Draft" (ghost button, appears once form has ≥1 exercise) — POSTs to `/api/workouts` with `is_draft: true, source: "manual"`
- `PATCH /api/workouts/[id]` — only flips `is_draft`; used for publish flow from draft view
- Draft view in WorkoutViewDetail shows "Save Workout" (accent) + "Edit" + Delete instead of just Edit + Delete
- `source` field (`"manual"` | `"suggested"`) is internal only, never shown to users

## Environment Variables

See `.env.example`. Key vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`, `DIRECT_URL`, `OPENAI_API_KEY`
