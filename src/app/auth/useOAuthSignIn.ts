"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Provider = "google" | "apple";

export function useOAuthSignIn(setError: (msg: string | null) => void) {
  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);

  async function signInWithProvider(provider: Provider) {
    const setLoading = provider === "google" ? setGoogleLoading : setAppleLoading;
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      setError(error.message);
      setLoading(false);
    }
  }

  return {
    googleLoading,
    appleLoading,
    handleGoogleSignIn: () => signInWithProvider("google"),
    handleAppleSignIn: () => signInWithProvider("apple"),
  };
}
