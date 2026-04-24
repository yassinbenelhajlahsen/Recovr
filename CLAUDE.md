# Recvr — Project Context

Next.js App Router workout/recovery tracker with Supabase auth, Prisma, Tailwind v4, and Upstash Redis caching.

## Commands

```bash
npm run dev              # Dev server (http://localhost:3000)
npx prisma migrate dev   # Create + apply a new migration
npx prisma generate      # Regenerate Prisma client after schema change
npx prisma db seed       # Seed default exercises
npx prisma studio        # DB GUI
npm run test             # Vitest watch
npm run test:run         # Vitest once (CI)
npm run test:e2e         # Playwright
```

## Project Structure

```
src/
├── app/                # Pages + API routes
│   ├── api/{exercises,workouts,recovery,user,progress,suggest,voice}/
│   └── {dashboard,recovery,progress,onboarding,privacy,terms-of-service,mobile}/
├── components/
│   ├── dashboard/      # DashboardClient
│   ├── landing/        # LandingClient, LandingIllustrations
│   ├── workout/        # WorkoutDetailDrawer, WorkoutForm, ExerciseCard, VoiceInput + hooks/
│   ├── recovery/       # RecoveryPanel, BodyMap*, SuggestionPanel, MuscleDetailPanel + hooks/
│   ├── progress/       # ProgressClient, ProgressChart, selectors + hooks/
│   ├── layout/         # Navbar, ThemeProvider, Providers, PageTransition, Footer, MobileGate
│   ├── onboarding/     # OnboardingFlow, MetricsInputs
│   ├── settings/       # SettingsDrawer, AccountTab, FitnessTab + hooks/
│   └── ui/             # Modal, Drawer, DropdownMenu, FloatingInput, BackButton, icons
├── types/              # workout, recovery, user, progress, suggestion, voice, theme, ui, dashboard
├── store/              # Zustand: workoutStore, appStore, clientStore
├── lib/                # prisma, openai, groq, redis, cache, recovery, suggestion, rate-limit,
│                       # workout-validation, exerciseMatcher, fetch, hooks, logger,
│                       # constants, units, utils, optimistic, dashboard, supabase/
└── proxy.ts            # Route protection (Supabase middleware + mobile gate)
```

## Conventions

Only the non-default, non-obvious rules — everything else lives in the reference docs below.

- **Prisma client import:** `@/generated/prisma/client` (NOT `@prisma/client`). Singleton in `src/lib/prisma.ts`.
- **Supabase client:** `createClient()` (sync) in Client Components; `await createClient()` in Server Components / Route Handlers.
- **Dates:** use `toLocalISODate(d?)` from `src/lib/utils.ts` — never format `YYYY-MM-DD` inline.
- **Shared types** go in `src/types/` — `import type { Foo } from "@/types/workout"`.
- **Icons** live in `src/components/ui/icons.tsx` — never define SVG icons inline.
- **401 handling:** only via `fetchWithAuth` (`src/lib/fetch.ts`) / the global `swrFetcher`. Do not reimplement.
- **Route handlers:** always wrapped with `withLogging` from `src/lib/logger.ts` — including the auth callback.
- **Dark mode:** anti-FOUC inline script in `layout.tsx`; do NOT read theme server-side.
- **`useRef` (React 19):** `useRef<T>(null)` returns `RefObject<T | null>` — prop types accepting refs must use `RefObject<T | null>`, not `RefObject<T>`.

## Reference Docs

- **[docs/architecture.md](docs/architecture.md)** — Read when implementing or touching recovery, AI suggestions, drafts, voice logging, progress charts, onboarding, or Zustand stores.
- **[docs/auth-and-data.md](docs/auth-and-data.md)** — Read when writing API routes, adding auth guards, editing the Prisma schema, running migrations, or wiring SWR hooks.
- **[docs/caching.md](docs/caching.md)** — Read when adding a Redis key, modifying a cached route, or debugging staleness.
- **[docs/design-system.md](docs/design-system.md)** — Read when building UI, styling, or wiring drawers/toasts/modals/legal pages.
- **[docs/testing-and-security.md](docs/testing-and-security.md)** — Read when writing tests, debugging mocks, or touching validation/rate-limit/logging/headers.

## Environment

See `.env.example`. Key vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`, `DIRECT_URL`, `OPENAI_API_KEY`, `GROQ_API_KEY`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `E2E_TEST_EMAIL`, `E2E_TEST_PASSWORD`.
