"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, useState } from "react";
import { preload } from "swr";
import { useAppStore } from "@/store/appStore";
import { UserMenu } from "./UserMenu";
import { GuestMenu } from "./GuestMenu";
import { SettingsDrawer } from "@/components/settings/SettingsDrawer";
import { useNavbar } from "./hooks/useNavbar";
import { UserIcon } from "@/components/ui/icons";
import { swrFetcher } from "@/lib/fetch";

function getInitials(name?: string | null, email?: string): string {
  if (name) {
    const parts = name.trim().split(/\s+/);
    return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
  }
  return (email?.[0] ?? "?").toUpperCase();
}

export function Navbar() {
  const pathname = usePathname();
  const isOnboarding =
    useAppStore((s) => s.isOnboarding) || pathname === "/onboarding";
  const isAuthPage = pathname.startsWith("/auth");
  const showNavLinks = !isOnboarding && !isAuthPage;

  const {
    user,
    profile,
    menuOpen,
    setMenuOpen,
    settingsOpen,
    setSettingsOpen,
    handleSignOut,
  } = useNavbar();

  const avatarRef = useRef<HTMLButtonElement>(null);
  const guestRef = useRef<HTMLButtonElement>(null);
  const [guestMenuOpen, setGuestMenuOpen] = useState(false);

  const displayName = user?.user_metadata?.full_name as string | undefined;
  const initials = getInitials(displayName, user?.email);

  return (
    <>
      <nav className="border-b border-border bg-bg/80 backdrop-blur-md sticky top-0 z-30">
        <div className="px-4 sm:px-8 h-16 flex items-center justify-between relative">
          {isOnboarding ? (
            <span className="font-display text-xl text-primary tracking-tight">
              Recvr
            </span>
          ) : (
            <Link
              href={user ? "/dashboard" : "/"}
              className="font-display text-xl text-primary tracking-tight"
            >
              Recvr
            </Link>
          )}

          <div className="absolute right-2 flex items-center gap-1">
            {user && showNavLinks && (
              <>
                <Link
                  href="/dashboard"
                  className={`text-sm font-medium px-3 py-2 rounded-lg transition-colors ${
                    pathname === "/dashboard"
                      ? "text-accent"
                      : "text-muted hover:text-primary hover:bg-surface"
                  }`}
                >
                  Dashboard
                </Link>
                <Link
                  href="/progress"
                  onMouseEnter={() => preload("/api/progress", swrFetcher)}
                  className={`text-sm font-medium px-3 py-2 rounded-lg transition-colors ${
                    pathname === "/progress"
                      ? "text-accent"
                      : "text-muted hover:text-primary hover:bg-surface"
                  }`}
                >
                  Progress
                </Link>
                <Link
                  href="/recovery"
                  onMouseEnter={() => preload("/api/recovery", swrFetcher)}
                  className={`text-sm font-medium px-3 py-2 rounded-lg transition-colors ${
                    pathname === "/recovery"
                      ? "text-accent"
                      : "text-muted hover:text-primary hover:bg-surface"
                  }`}
                >
                  Recovery
                </Link>
              </>
            )}
            {user && (
              <button
                ref={avatarRef}
                onClick={() => setMenuOpen((v) => !v)}
                aria-label="Open account menu"
                aria-expanded={menuOpen}
                className="w-9 h-9 rounded-full bg-surface border border-border-subtle text-sm font-semibold text-accent hover:border-border transition-colors flex items-center justify-center ml-1 shrink-0"
              >
                {initials}
              </button>
            )}
            {!user && !isAuthPage && (
              <button
                ref={guestRef}
                onClick={() => setGuestMenuOpen((v) => !v)}
                aria-label="Open menu"
                aria-expanded={guestMenuOpen}
                className="w-9 h-9 rounded-full bg-surface border border-border-subtle text-muted hover:text-secondary hover:border-border transition-colors flex items-center justify-center ml-1 shrink-0"
              >
                <UserIcon />
              </button>
            )}
          </div>
        </div>
      </nav>

      {!user && !isAuthPage && (
        <GuestMenu
          open={guestMenuOpen}
          onClose={() => setGuestMenuOpen(false)}
          anchorRef={guestRef}
        />
      )}

      {user && (
        <>
          <UserMenu
            open={menuOpen}
            onClose={() => setMenuOpen(false)}
            anchorRef={avatarRef}
            user={user}
            onOpenSettings={() => setSettingsOpen(true)}
            onSignOut={handleSignOut}
            onboarding={isOnboarding}
          />
          {showNavLinks && (
            <SettingsDrawer
              open={settingsOpen}
              onClose={() => setSettingsOpen(false)}
              user={{
                email: user.email ?? "",
                name: profile?.name ?? displayName ?? null,
                height_inches: profile?.height_inches ?? null,
                weight_lbs: profile?.weight_lbs ?? null,
                fitness_goals: profile?.fitness_goals ?? [],
                gender: profile?.gender ?? null,
                providers: user.app_metadata?.providers ?? [],
              }}
            />
          )}
        </>
      )}
    </>
  );
}
