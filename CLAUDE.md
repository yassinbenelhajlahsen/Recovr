# BodyLab — Project Context

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

## Dark Mode
- Tailwind v4 class-based: `dark` class on `<html>` element
- `ThemeProvider` in `src/components/ThemeProvider.tsx` manages state + localStorage
- Anti-FOUC inline script in `src/app/layout.tsx`
- Do NOT read theme preference server-side (hydration mismatch)

## File Structure
```
src/
├── app/
│   ├── layout.tsx              # Root layout (ThemeProvider, Navbar)
│   ├── page.tsx                # Redirects to /dashboard
│   ├── dashboard/page.tsx      # Protected dashboard (Server Component)
│   ├── auth/
│   │   ├── signin/page.tsx
│   │   ├── signup/page.tsx
│   │   └── callback/route.ts   # OAuth + email confirmation handler
│   └── api/
│       └── user/sync/route.ts  # Upserts Supabase user into Prisma DB
├── components/
│   ├── Navbar.tsx
│   ├── ThemeProvider.tsx
│   └── ThemeToggle.tsx
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
