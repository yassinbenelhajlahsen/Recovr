"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { FloatingInput } from "@/components/ui/FloatingInput";
import { AppleIcon, EyeIcon, EyeOffIcon, GoogleIcon } from "@/components/ui/icons";
import { PasswordChecklist, passwordMeetsRequirements } from "@/components/ui/PasswordChecklist";
import { useOAuthSignIn } from "@/app/auth/useOAuthSignIn";

export default function SignUpPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { googleLoading, appleLoading, handleGoogleSignIn, handleAppleSignIn } = useOAuthSignIn(setError);

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!passwordMeetsRequirements(password)) {
      setError("Password does not meet all requirements.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({ email, password });

    if (error) { setError(error.message); setLoading(false); return; }

    if (data.user) {
      const { ensureUserInDb } = await import("@/lib/supabase/ensureUser");
      await ensureUserInDb(data.user);
    }

    router.push("/onboarding");
  }

  const confirmMismatch = confirm.length > 0 && confirm !== password;

  return (
    <div className="min-h-[calc(100dvh-65px)] flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-[360px] space-y-6">
        {/* Header */}
        <div className="text-center space-y-1">
          <h1 className="font-display text-4xl text-primary">Create account</h1>
          <p className="text-sm text-muted">Start tracking your recovery</p>
        </div>

        {/* Google */}
        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={googleLoading}
          className="w-full flex items-center justify-center gap-2.5 rounded-xl border border-border bg-elevated hover:bg-surface px-4 py-[11px] text-[15px] font-medium text-primary transition-colors duration-150 disabled:opacity-50"
        >
          <GoogleIcon />
          {googleLoading ? "Redirecting…" : "Continue with Google"}
        </button>

        {/* Apple */}
        <button
          type="button"
          onClick={handleAppleSignIn}
          disabled={appleLoading}
          className="w-full flex items-center justify-center gap-2.5 rounded-xl border border-border bg-elevated hover:bg-surface px-4 py-[11px] text-[15px] font-medium text-primary transition-colors duration-150 disabled:opacity-50"
        >
          <AppleIcon />
          {appleLoading ? "Redirecting…" : "Continue with Apple"}
        </button>

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-muted uppercase tracking-wider">or</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        {/* Form */}
        <form onSubmit={handleSignUp} className="space-y-2.5">
          <FloatingInput
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            label="Email"
            autoComplete="email"
          />

          <div>
            <FloatingInput
              id="password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              label="Password"
              autoComplete="new-password"
              rightSlot={
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="p-1.5 text-muted hover:text-secondary transition-colors duration-150"
                  tabIndex={-1}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              }
            />
            <AnimatePresence initial={false}>
              {password.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                  style={{ overflow: "hidden" }}
                  className="mt-2"
                >
                  <PasswordChecklist password={password} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <FloatingInput
            id="confirm"
            type={showConfirm ? "text" : "password"}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            label="Confirm password"
            autoComplete="new-password"
            error={confirmMismatch ? "Passwords don't match" : undefined}
            rightSlot={
              <button
                type="button"
                onClick={() => setShowConfirm((v) => !v)}
                className="p-1.5 text-muted hover:text-secondary transition-colors duration-150"
                tabIndex={-1}
                aria-label={showConfirm ? "Hide password" : "Show password"}
              >
                {showConfirm ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            }
          />

          <AnimatePresence>
            {error && (
              <motion.p
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.15 }}
                className="text-xs text-danger overflow-hidden"
              >
                {error}
              </motion.p>
            )}
          </AnimatePresence>

          <div className="pt-1">
            <motion.button
              type="submit"
              disabled={loading}
              whileTap={{ scale: 0.97 }}
              className="relative w-full rounded-xl bg-accent hover:bg-accent-hover text-white text-[15px] font-semibold py-[13px] transition-colors duration-150 disabled:opacity-50 overflow-hidden"
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={String(loading)}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.14 }}
                  className="block"
                >
                  {loading ? "Creating account…" : "Create account"}
                </motion.span>
              </AnimatePresence>
            </motion.button>
          </div>
        </form>

        <p className="text-center text-xs text-muted">
          By signing up, you agree to our{" "}
          <Link href="/terms-of-service" className="text-accent hover:text-accent-hover underline transition-colors duration-150">
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="text-accent hover:text-accent-hover underline transition-colors duration-150">
            Privacy Policy
          </Link>
          .
        </p>

        <div className="flex items-center justify-center gap-1 text-sm">
          <span className="text-muted">Already have an account?</span>
          <Link href="/auth/signin" className="text-accent hover:text-accent-hover transition-colors duration-150">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
