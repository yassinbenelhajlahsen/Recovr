"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

interface NavbarProfile {
  name?: string | null;
  height_inches?: number | null;
  weight_lbs?: number | null;
  fitness_goals?: string[];
}

interface UseNavbarReturn {
  user: User | null;
  profile: NavbarProfile | null;
  menuOpen: boolean;
  setMenuOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
  settingsOpen: boolean;
  setSettingsOpen: (open: boolean) => void;
  handleSignOut: () => Promise<void>;
  clearProfile: () => void;
}

export function useNavbar(): UseNavbarReturn {
  const router = useRouter();
  const pathname = usePathname();

  const [user, setUser] = useState<User | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [profile, setProfile] = useState<NavbarProfile | null>(null);

  // Auth state: initial load + subscription
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

  // Fetch profile when settings drawer opens
  useEffect(() => {
    if (settingsOpen) {
      fetch("/api/user/profile")
        .then((r) => r.json())
        .then(setProfile);
    }
  }, [settingsOpen]);

  // Close dropdown on route change
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

  function clearProfile() {
    setProfile(null);
  }

  return {
    user,
    profile,
    menuOpen,
    setMenuOpen,
    settingsOpen,
    setSettingsOpen,
    handleSignOut,
    clearProfile,
  };
}
