"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { UserMenu } from "./UserMenu";
import { SettingsDrawer } from "./SettingsDrawer";
import type { User } from "@supabase/supabase-js";

function getInitials(name?: string | null, email?: string): string {
  if (name) {
    const parts = name.trim().split(/\s+/);
    return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
  }
  return (email?.[0] ?? "?").toUpperCase();
}

export function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const avatarRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_, session) =>
      setUser(session?.user ?? null),
    );
    return () => subscription.unsubscribe();
  }, []);

  // Close dropdown on any navigation by including pathname in the key state
  const [menuPath, setMenuPath] = useState(pathname);
  if (menuPath !== pathname) {
    setMenuPath(pathname);
    if (menuOpen) setMenuOpen(false);
  }

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/auth/signin");
    router.refresh();
  }

  const displayName = user?.user_metadata?.full_name as string | undefined;
  const initials = getInitials(displayName, user?.email);

  return (
    <>
      <nav className="border-b border-border bg-bg/80 backdrop-blur-md sticky top-0 z-30">
        <div className="px-4 sm:px-8 h-16 flex items-center justify-between relative">
          <Link
            href={user ? "/dashboard" : "/auth/signin"}
            className="font-display text-xl text-primary tracking-tight"
          >
            Recovr
          </Link>

          <div className="absolute right-2 flex items-center gap-1">
            {user && (
              <Link
                href="/recovery"
                className="text-sm font-medium text-muted hover:text-primary px-3 py-2 rounded-lg hover:bg-surface transition-colors"
              >
                Recovery
              </Link>
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
          </div>
        </div>
      </nav>

      {user && (
        <>
          <UserMenu
            open={menuOpen}
            onClose={() => setMenuOpen(false)}
            anchorRef={avatarRef}
            user={user}
            onOpenSettings={() => setSettingsOpen(true)}
            onSignOut={handleSignOut}
          />
          <SettingsDrawer
            open={settingsOpen}
            onClose={() => setSettingsOpen(false)}
            user={{
              email: user.email ?? "",
              name: displayName ?? null,
            }}
          />
        </>
      )}
    </>
  );
}
