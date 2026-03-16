# Recvr

**Train smarter. Recover faster.**

Recvr (Recover) is a recovery-first fitness tracking app that monitors muscle fatigue in real time and uses AI to recommend what to train next. Built for athletes who want data-driven decisions about when to push and when to rest.

Live site: https://recvr.fit

## Demos

<details>
<summary>Log Workout</summary>

![Log Workout](demos/log_workout.gif)

</details>

<details>
<summary>Onboarding</summary>

![Onboarding](demos/onboarding.gif)

</details>

<details>
<summary>Recovery Engine</summary>

![Recovery Engine](demos/recovery_engine.gif)

</details>

<details>
<summary>AI Suggestions</summary>

![AI Suggestions](demos/suggestion.gif)

</details>

<details>
<summary>Progress Analytics</summary>

![Progress Analytics](demos/progress.gif)

</details>

## Features

### Recovery Intelligence
Real-time muscle recovery maps computed from your workout history. Interactive SVG body maps (front and back) show which muscles are ready to train and which need rest, updated after every session.

### AI-Powered Suggestions
Personalized workout plans generated from your current recovery state. Considers muscle readiness, training history, fitness goals, and gender-specific recovery patterns to suggest optimal training splits.

### Voice Logging
Log workouts by speaking naturally. Audio is transcribed via Groq Whisper and parsed by GPT-4o-mini into structured exercises that auto-populate the workout form.

### Progress Analytics
Track strength gains with estimated 1RM charts and monitor body weight trends over time. Side-by-side visualizations with configurable date ranges and metric modes.

### Workout Management
Full CRUD for workouts with exercise search, set tracking, draft support, and muscle group filtering. AI-suggested workouts can be saved as drafts and published later.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 |
| Auth | Supabase Auth (email/password + Google + Apple Auth) |
| Database | PostgreSQL (Supabase) via Prisma 7 |
| AI | OpenAI GPT-4o-mini, Groq Whisper |
| Caching | Upstash Redis |
| State | Zustand + SWR |
| Charts | Recharts v3 |
| Testing | Vitest + Playwright |

## Getting Started

### Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project (auth + PostgreSQL)
- API keys for [OpenAI](https://platform.openai.com) and [Groq](https://console.groq.com) (for AI features)
- [Upstash Redis](https://upstash.com) instance (optional — app works without it)

### Setup

1. **Clone and install**

   ```bash
   git clone <repo-url>
   cd Recovr
   npm install
   ```

2. **Configure environment variables**

   ```bash
   cp .env.example .env
   ```

   Fill in your credentials — see `.env.example` for all required variables:
   - `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` / `SUPABASE_SERVICE_ROLE_KEY`
   - `DATABASE_URL` (pooled, port 6543) / `DIRECT_URL` (direct, port 5432)
   - `OPENAI_API_KEY` / `GROQ_API_KEY`
   - `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` (optional)

3. **Set up the database**

   ```bash
   npx prisma migrate dev    # Apply migrations
   npx prisma db seed         # Seed default exercises
   ```

4. **Start the dev server**

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

## Scripts

```bash
npm run dev              # Start dev server
npm run build            # Lint + test + build for production
npm run test             # Run Vitest in watch mode
npm run test:run         # Run Vitest once (CI)
npm run test:e2e         # Run Playwright E2E tests
npm run lint             # ESLint
npx prisma studio        # Open Prisma Studio (DB GUI)
npx prisma generate      # Regenerate Prisma client
```

## Project Structure

```
src/
├── app/                # Pages + API routes (App Router)
│   ├── api/            # REST endpoints (exercises, workouts, recovery, progress, voice, suggest)
│   ├── dashboard/      # Home — workout list + recovery panel
│   ├── recovery/       # SVG body maps + AI suggestions
│   ├── progress/       # 1RM + body weight charts
│   └── onboarding/     # 4-step setup flow
├── components/
│   ├── workout/        # Workout form, exercise cards, voice input
│   ├── recovery/       # Body maps, muscle detail, suggestion panel
│   ├── progress/       # Charts, selectors, stats
│   ├── layout/         # Navbar, footer, theme, providers
│   ├── settings/       # Account + fitness settings
│   └── ui/             # Shared components (Drawer, Modal, icons)
├── store/              # Zustand stores (workout, app, client)
├── lib/                # Singletons, utilities, Supabase clients
└── types/              # Shared TypeScript types
```

## Testing

Unit and integration tests use **Vitest** with React Testing Library. E2E tests use **Playwright**.

```bash
npm run test:run         # All unit/integration tests
npm run test:e2e         # E2E suite (requires running dev server)
```

E2E tests require `E2E_TEST_EMAIL` and `E2E_TEST_PASSWORD` env vars pointing to a test user with completed onboarding.

## Architecture Notes

- **Recovery engine** computes fatigue on-the-fly from the last 96 hours of workouts — no separate tables
- **Cache-aside pattern** with Redis: recovery (5min TTL), AI suggestions (1hr cooldown), exercises (24hr)
- **AI suggestions** stream via NDJSON; cache hits return instant JSON
- **Desktop-only** — mobile viewports redirect to a placeholder page
- **Server-side auth gates** protect dashboard and onboarding flow
- **Prisma driver adapter** (`@prisma/adapter-pg`) for connection pooling with Supabase

## License

Private project. All rights reserved.
