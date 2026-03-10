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
- **Middleware**: session refresh is handled in `src/middleware.ts` via `updateSession()`
- After `signInWithPassword`, call `ensureUserInDb(user)` from `@/lib/supabase/ensure-user` to sync user to Prisma DB
- OAuth and email confirmation flows sync user via `src/app/auth/callback/route.ts`
- **Google OAuth is configured** in Supabase dashboard (enabled, redirect URL set)

## Database

- Prisma v7 config lives in `prisma.config.ts` (reads `.env`)
- `DATABASE_URL` = pooled connection (port 6543, for runtime)
- `DIRECT_URL` = direct connection (port 5432, for migrations)
- Prisma client is imported from `@/generated/prisma/client` (NOT `@prisma/client`)
- Prisma v7 requires a driver adapter: `new PrismaClient({ adapter: new PrismaPg({ connectionString: DATABASE_URL }) })`
- Singleton pattern in `src/lib/prisma.ts`

## Design System

- **Fonts**: Instrument Serif (display/headlines, `font-display`), Geist Sans (body/UI, `font-sans`)
- **Color tokens**: defined as CSS custom properties in `globals.css` (:root + .dark), mapped to Tailwind via `@theme inline`
- **Semantic classes**: `bg-bg`, `bg-surface`, `bg-elevated`, `text-primary`, `text-secondary`, `text-muted`, `text-accent`, `bg-accent`, `border-border`, `border-border-subtle`, `text-danger`, `text-success`
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
- `/dashboard` — the main screen: greeting, log workout CTA, filters, full workout list, modals (DashboardClient)
- `/workouts` → redirects to `/dashboard` (preserves search params)
- `/workouts/[id]` — workout detail (read-only)
- `/workouts/[id]/edit` — edit workout form

## File Structure

```
src/
├── app/
│   ├── layout.tsx              # Root layout (ThemeProvider, Navbar)
│   ├── page.tsx                # Redirects to /dashboard
│   ├── dashboard/page.tsx      # Unified main screen (Server Component)
│   ├── workouts/
│   │   ├── page.tsx            # Redirects to /dashboard
│   │   ├── new/page.tsx
│   │   ├── [id]/page.tsx
│   │   └── [id]/edit/page.tsx
│   ├── auth/
│   │   ├── signin/page.tsx
│   │   ├── signup/page.tsx
│   │   └── callback/route.ts   # OAuth + email confirmation handler
│   └── api/
│       ├── exercises/route.ts
│       ├── workouts/route.ts
│       ├── workouts/[id]/route.ts
│       └── user/sync/route.ts
├── components/
│   ├── DashboardClient.tsx     # Main client component (list + modals)
│   ├── WorkoutForm.tsx         # Create/edit workout form
│   ├── WorkoutsFilter.tsx      # Search + date range filters
│   ├── WorkoutDetailDrawer.tsx # Side drawer for workout details
│   ├── SessionSummaryModal.tsx # Post-save success modal
│   ├── DeleteWorkoutButton.tsx
│   ├── Navbar.tsx
│   ├── ThemeProvider.tsx
│   ├── ThemeToggle.tsx
│   └── ui/
│       ├── Modal.tsx
│       └── Drawer.tsx
├── store/
│   └── workoutStore.ts         # Zustand store for modal state
├── lib/
│   ├── prisma.ts               # Singleton PrismaClient
│   └── supabase/
│       ├── client.ts           # Browser client
│       ├── server.ts           # Server client
│       ├── middleware.ts       # Middleware session refresh
│       └── ensure-user.ts      # Syncs auth user to DB after sign-in
├── generated/prisma/           # Auto-generated Prisma client (gitignored)
└── middleware.ts               # Route protection
prisma/
├── schema.prisma               # Data models
├── seed.ts                     # Default exercises seed
└── migrations/                 # Migration history
```

## Environment Variables (.env)

See `.env.example` for required keys.
