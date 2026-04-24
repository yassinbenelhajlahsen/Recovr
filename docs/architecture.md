# Architecture

Domain subsystems, state management, and major feature flows.

**Read when:** implementing or modifying recovery, AI suggestions, drafts, voice logging, progress charts, onboarding, or anything that coordinates across these.

## State Management (Zustand)

Three stores in `src/store/`:

- `workoutStore.ts` — drawer open/close, view routing (`create | view | edit | summary`), preview data, session summary
- `appStore.ts` — `isOnboarding` flag
- `clientStore.ts` — SSR hydration safety (`mounted`, `isDark` via MutationObserver)

**Pattern:** pass data through the store, don't refetch. Components should render immediately with available data.

## Recovery Engine

- Computed on-the-fly from last 96h of workouts — no DB tables. See `src/lib/recovery.ts`.
- Canonical `MUSCLE_GROUPS` lives in `src/lib/constants.ts` (re-exported from `recovery.ts`).
- Always call `getRecovery(userId)` (cache-aside wrapper) — never `calculateRecovery` directly.
- Algorithm: `volume_factor = clamp(volume/5000, 0.8, 1.5)`, `adjusted_hours = 48 * factor`, residual accumulation model.
- Status thresholds: recovered ≥ 0.85, partial ≥ 0.45, fatigued < 0.45. `BODYWEIGHT_PROXY = 75` lbs.
- SVG body maps via `@mjcdev/react-body-highlighter`; HSL interpolation in `src/components/recovery/recoveryColors.ts`.
- `gender` prop flows: DB → page → `RecoveryView`/`RecoveryPanel` → `BodyMapFront`/`BodyMapBack`. Library only supports `"male"` | `"female"` — no neutral option; `null` defaults to `"male"`.
- `RecoveryPanel` (dashboard) is view-only and fetches gender via SWR (`/api/user/profile`). Full interaction only on `/recovery`.
- Muscle group naming: lowercase string arrays (`["core", "abs"]`). Search uses `hasSome`. Never `"core/Abs"`.
- Drafts excluded from recovery (`is_draft: false` in the `calculateRecovery` where clause).

## AI Suggestions

Source of truth: `src/app/api/suggest/route.ts`, `src/lib/suggestion.ts`, `src/components/recovery/SuggestionPanel.tsx`, `src/components/recovery/hooks/useSuggestion.ts`.

### Flow

- `SuggestionTrigger` (server-rendered) opens a `size="lg"` Drawer.
- `useSuggestion` manages idle/loading/streaming/result states and uses AbortController to cancel in-flight requests on dismiss.
- `POST /api/suggest` calls OpenAI via the singleton in `src/lib/openai.ts`. **Never trust client-supplied recovery data** — recompute server-side.

### Streaming

- Response is `text/x-ndjson`; each line is a `SuggestionStreamEvent`: `meta | title | rationale | exercise | done | error`. Types in `src/types/suggestion.ts` — import from there, not inline.
- Cache hits return instant `application/json` (no streaming). `useSuggestion` detects via `Content-Type`.
- `isStreaming = state.isLoading && state.suggestion !== null` drives progressive UI: skeleton cards fill to 4 as exercises arrive, footer hidden until `done`, scalar fields animate in.
- Server-side `extractExercises(buffer, alreadyEmitted)` rescans the full accumulated buffer from the exercises-array start on each chunk — avoids chunk-boundary bugs.
- `done` event carries optional `suggestionId` (DB row ID).

### Gender bias

- `"male"` → adds "Gender: Male" to user prompt; `"female"` → "Gender: Female"; `null` → omitted.
- System prompt GENDER CONSIDERATION section is a **tiebreaker only**: male lowers partial-recovery threshold to 50% for upper-body muscles; female lowers it to 50% for lower-body muscles. Fatigue always takes priority.

### History

- Views: `planner | history | historical-detail`. `useSuggestionHistory` uses `useSWRInfinite` with cursor pagination.
- API: `GET /api/suggest/history` (`?cursor=<ISO>&limit=20`), `GET /api/suggest/[id]`.
- Historical detail reuses `ExerciseCard` layout; no cooldown timer.
- Cooldown timer shown only for the most recent suggestion (`!isHistorical`) in the result footer and on the first history card.

### Cooldown

- DB authoritative (`Suggestion.created_at`). Blocked if `timeSinceLast < 1hr`.
- `POST /api/suggest` returns `_cooldown` (seconds) + `_cached: true` on cache hits.
- `GET /api/suggest/cooldown` returns `{ cooldown, suggestionId? }`.
- Use `getSuggestionState(userId)` in `src/lib/suggestion.ts` — checks Redis first, falls back to DB.

## Workout Drafts

Schema fields on `Workout`: `is_draft Boolean @default(false)`, `source String @default("manual")`.

- Drafts **excluded** from recovery engine and progress charts (all 3 Prisma queries in `src/app/progress/page.tsx`).
- Drafts **included** on dashboard with a "Draft" badge (`text-recovery-yellow`).
- Deep-link flow: save draft from `/recovery` → `router.push('/?draft={id}')` → `DashboardClient` `openDraftId` prop opens drawer on mount → `router.replace('/')` clears the param.
- `POST /api/workouts/draft` — exercise matching: exact name → substring → create custom. Resolved **sequentially** to avoid duplicate custom exercises.
- `WorkoutForm` shows "Save as Draft" (ghost button, appears once form has ≥1 exercise) — POSTs to `/api/workouts` with `is_draft: true, source: "manual"`.
- `PATCH /api/workouts/[id]` — only flips `is_draft`; used for publish flow from draft view.
- Publish logic: `usePublishDraft` hook in `src/components/workout/hooks/usePublishDraft.ts`.
- `source` (`"manual"` | `"suggested"`) is internal only — never shown to users.

## Voice Workout Logging

Source of truth: `src/app/api/voice/`, `src/components/workout/VoiceInput.tsx`, `src/components/workout/hooks/useVoiceRecorder.ts`.

### Flow

1. Record audio → `POST /api/voice/transcribe` (Groq Whisper, transcribe only)
2. Show editable transcript → user presses "Parse"
3. `POST /api/voice/parse` (GPT-4o-mini + exercise matching)
4. Show exercises → "Add to workout"

### Routes

- `POST /api/voice/transcribe` — `FormData` with `audio` blob. Returns `VoiceTranscriptResult` (`{ transcript }`). Rate limit 10/hr (`voice:{userId}`). MIME validated against webm/mp4/mpeg/ogg/wav; codec params stripped (`audio/webm;codecs=opus` → `audio/webm`).
- `POST /api/voice/parse` — JSON `{ transcript }`. Returns `VoiceTranscribeResponse` (transcript + matched + unmatched). Rate limit 20/hr (`voice-parse:{userId}`). Transcript max 10,000 chars.

### Integration

- Groq singleton: `src/lib/groq.ts` (`globalThis` pattern, Whisper only). Env: `GROQ_API_KEY`.
- Shared exercise matcher: `src/lib/exerciseMatcher.ts` — `resolveExercise(name, muscleGroups, allExercises, userId)`. Used by both `POST /api/workouts/draft` and `POST /api/voice/parse`.
- Hook states: `idle → requesting → recording → transcribing → transcribed → parsing → done → error`. Auto-stops at 120s.
- `useExerciseList.bulkAddExercises()` merges sets when same `exercise_id` appears multiple times.
- Mic button hidden if `MediaRecorder` unsupported.
- Types: `src/types/voice.ts` — `ParsedExercise`, `VoiceTranscriptResult`, `VoiceTranscribeResponse`.

## Progress Charts

Source: `src/components/progress/ProgressChart.tsx`, `src/types/progress.ts`.

- `ProgressChart` accepts either single-line (`dataKey`/`color`) or multi-line (`lines: LineConfig[]`) mode. Export `LineConfig` type from `ProgressChart.tsx`.
- `MetricMode = "1rm" | "topWeight" | "both"` in `src/types/progress.ts`. State lives in `useProgressFilters`.
- `MetricSelector` is a dropdown (`DropdownMenu`/`DropdownMenuItem`) placed inline with `ExerciseSelector`.
- Legend renders inside the chart card header when `resolvedLines.length > 1`.
- **`isAnimationActive={false}` on all `<Line>`** — Recharts animations block tooltip hover until complete. Keep disabled.
- `grow` prop: switches card to `flex flex-col flex-1` and chart area to `flex-1 min-h-[220px]`. Used on body weight chart (right column) to match left column height. Right column must be wrapped in `<div className="flex flex-col">`.
- `chartKey` prop: passed as `key` to `<LineChart>`. Include `metricMode` to force clean remount on metric switch.

## Body Weight Tracking

- `body_weight Float?` on `Workout` — optional per-workout entry.
- API syncs to `User.weight_lbs` only if it's the most recent workout with body_weight.
- Progress chart reads from `Workout.body_weight`, not `User.weight_lbs`.

## Onboarding

- 4-step **locked** flow: Name (0) → Gender (1) → Body Metrics (2) → Goals (3). All fields optional.
- Server-side gate on dashboard + OAuth callback.
- User fields: `height_inches`, `weight_lbs`, `fitness_goals` (String[]), `gender` (String? — `"male"` | `"female"` | `null`), `onboarding_completed`.
- Goals: up to 3 presets OR 1 custom (mutually exclusive).
- Migration: `prisma/migrations/20260311000002_add_gender/migration.sql` (manually created + applied).

## Routing

- `/` — public landing (auth-aware CTAs)
- `/dashboard` — workout list + recovery panel + drawer
- `/onboarding` — locked 4-step flow
- `/recovery` — SVG body maps + tap-to-inspect muscle detail
- `/progress` — 1RM charts + body weight chart, side-by-side, full-width
- `/privacy`, `/terms-of-service` — public legal pages
- `/mobile` — desktop-only placeholder
