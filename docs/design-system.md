# Design System

Colors, typography, UI primitives, dark mode, toasts, mobile gate, legal pages.

**Read when:** building UI components, adding pages, styling, or wiring toasts/drawers/modals.

## Tokens

- **Fonts:** Fraunces (`font-display`, headlines), Geist Sans (`font-sans`, body).
- **Color tokens:** CSS custom properties in `src/app/globals.css`, mapped via `@theme inline`.
- **Semantic classes:** `bg-bg`, `bg-surface`, `bg-elevated`, `text-primary`, `text-secondary`, `text-muted`, `text-accent`, `border-border`, `border-border-subtle`, `text-danger`, `text-success`, `text-recovery-yellow`.
- **Accent:** terracotta `#D4552A` (light) / `#E8633A` (dark).
- **Palette:** warm neutrals (not zinc). Light bg `#F7F7F4`, dark bg `#0B0B0A`.
- **Light mode SVG fills:** 50-65% lightness range (muted earthy, not vivid).

## Typography

- Serif italic headlines, sans body.
- Section labels: `uppercase tracking-wider`.

## UI primitives

- **Cards:** `bg-surface border border-border-subtle rounded-xl`
- **Primary button:** `bg-accent text-white rounded-lg`
- **Secondary button:** `border border-border`
- **Ghost button:** `text-secondary`
- **Drawer** (`src/components/ui/Drawer.tsx`): backdrop (`z-40`) and panel (`z-50` with `role="dialog"`) are sibling elements inside a React fragment wrapper.
- **Icons:** all shared icons live in `src/components/ui/icons.tsx`. **YOU MUST NOT** define SVG icons inline elsewhere.

## Dark Mode

- `dark` class on `<html>`, managed by `ThemeProvider` + localStorage.
- Anti-FOUC inline script in `layout.tsx`. **YOU MUST NOT** read theme server-side.

## Toasts

- Library: `sonner` — lightweight, dark-mode aware, renders via portal at app root.
- Setup: `<Toaster>` in `src/components/layout/Providers.tsx` via `ThemedToaster` component (reads theme from `useTheme()` context).
- Position: `bottom-center`. Duration: `1500ms`. `richColors` mode for built-in success/error semantics.
- Usage: `import { toast } from "sonner"` → `toast.success("message")` / `toast.error("message")`.

### Required toast messages

| Action | Message |
|---|---|
| Workout logged/updated/deleted | `"Workout logged"` / `"Workout updated"` / `"Workout deleted"` |
| Draft saved/published | `"Draft saved"` / `"Workout saved"` |
| Profile save | `"Profile updated"` |
| Fitness save | `"Fitness profile updated"` |
| Sign out | `"Signed out"` |
| Create exercise | `toast.success()` on success (inline in form via `setError`) |

Every API failure gets `toast.error()` with a user-friendly message (e.g. `"Failed to save workout"`).

Bottom-center placement avoids overlap with right-side drawer. Toasts render at body level so they persist across route changes.

## Loading States

- `loading.tsx` files for `/dashboard`, `/recovery`, `/progress`.
- Use `className="skeleton"` (custom shimmer in `globals.css`), **NOT** `animate-pulse`.
- Skeletons mirror the real page layout.

## Mobile Gate

Desktop-only app — viewports <768px redirect to `/mobile`.

- **Server-side:** `src/proxy.ts` detects mobile User-Agent via regex, redirects to `/mobile` before auth runs.
- **Client-side:** `src/components/layout/MobileGate.tsx` listens to resize events, redirects if viewport < `md` breakpoint.
- **Allowed routes (bypass gate):** `/`, `/mobile`, `/api`, `/_next`, `/favicon`, `/privacy`, `/terms-of-service`.

## Legal Pages

- `/privacy` — 9 sections covering Supabase, OpenAI, Groq, Upstash, Vercel as third parties.
- `/terms-of-service` — 11 sections, AI disclaimer (not medical advice).
- Both are public routes (added to public list in `src/lib/supabase/middleware.ts`).
- Legal links: signup form, Settings drawer footer, shared `Footer` component.
- `src/components/ui/BackButton.tsx` — simple `history.back()` nav used on legal pages.
- `src/components/layout/Footer.tsx` — shared footer with Privacy/Terms + copyright, rendered in `layout.tsx`.
