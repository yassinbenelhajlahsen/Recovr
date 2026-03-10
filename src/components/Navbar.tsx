"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ThemeToggle } from "./ThemeToggle";
import type { User } from "@supabase/supabase-js";

export function Navbar() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);

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

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/auth/signin");
    router.refresh();
  }

  return (
    <nav className="border-b border-border bg-bg/80 backdrop-blur-md sticky top-0 z-30">
      <div className="px-4 sm:px-8 h-16 flex items-center justify-between relative">
        <Link
          href={user ? "/dashboard" : "/auth/signin"}
          className="font-display text-xl text-primary tracking-tight"
        >
          Recovr
        </Link>

        <div className="absolute right-2 flex items-center gap-1">
          <ThemeToggle />
          {user && (
            <button
              onClick={handleSignOut}
              className="text-sm font-medium text-muted hover:text-primary px-3 py-2 rounded-lg hover:bg-surface transition-colors"
            >
              Sign out
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}
