"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { FloatingInput } from "@/components/ui/FloatingInput";
import {
  PasswordChecklist,
  passwordMeetsRequirements,
} from "@/components/ui/PasswordChecklist";
import { createClient } from "@/lib/supabase/client";
import { SectionHeader } from "./SectionHeader";
import type { UserProfile } from "@/types/user";

const EyeIcon = () => (
  <svg
    className="w-4 h-4"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.75}
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z"
    />
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
    />
  </svg>
);

const EyeOffIcon = () => (
  <svg
    className="w-4 h-4"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.75}
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88"
    />
  </svg>
);

interface AccountTabProps {
  user: UserProfile;
  open: boolean;
  onClose: () => void;
}

export function AccountTab({ user, open, onClose }: AccountTabProps) {
  const router = useRouter();

  // ── Profile state ──
  const [name, setName] = useState(user.name ?? "");
  const [saving, setSaving] = useState(false);

  // ── Password state ──
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);

  // ── Delete state ──
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Sync name when user prop changes
  useEffect(() => {
    setName(user.name ?? "");
  }, [user]);

  // Reset transient state when drawer closes
  useEffect(() => {
    if (!open) {
      setNewPassword("");
      setConfirmPassword("");
      setShowNewPassword(false);
      setShowConfirmPassword(false);
      setPasswordError(null);
      setPasswordSuccess(false);
      setConfirmDelete(false);
    }
  }, [open]);

  const isAccountDirty = name !== (user.name ?? "");
  const confirmMismatch =
    confirmPassword.length > 0 && confirmPassword !== newPassword;

  const providers = user.providers ?? [];
  const canChangePassword =
    providers.includes("email") ||
    (!providers.length && !providers.includes("google"));

  async function handleSaveProfile() {
    setSaving(true);
    await fetch("/api/user/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim() || null,
        height_inches: user.height_inches,
        weight_lbs: user.weight_lbs,
        fitness_goals: user.fitness_goals ?? [],
      }),
    });
    setSaving(false);
    onClose();
    router.refresh();
  }

  async function handleResetPassword() {
    setPasswordError(null);
    setPasswordSuccess(false);

    if (!passwordMeetsRequirements(newPassword)) {
      setPasswordError("Password does not meet all requirements.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords don't match.");
      return;
    }

    setPasswordSaving(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      setPasswordError(error.message);
    } else {
      setPasswordSuccess(true);
      setNewPassword("");
      setConfirmPassword("");
    }
    setPasswordSaving(false);
  }

  async function handleDeleteAccount() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }

    setDeleting(true);
    const res = await fetch("/api/user/delete", { method: "DELETE" });
    if (res.ok) {
      const supabase = createClient();
      await supabase.auth.signOut();
      router.push("/auth/signin");
    } else {
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  return (
    <>
      {/* ── Profile ── */}
      <section>
        <SectionHeader title="Profile" />
        <div className="space-y-3">
          <FloatingInput
            id="settings-name"
            type="text"
            label="Display name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required={false}
            autoComplete="name"
            autoCapitalize="words"
          />
          <div className="relative">
            <FloatingInput
              id="settings-email"
              type="email"
              label="Email"
              value={user.email}
              onChange={() => {}}
              disabled
              required={false}
              rightSlot={
                <svg
                  className="w-4 h-4 text-muted"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z"
                  />
                </svg>
              }
            />
          </div>
        </div>

        {isAccountDirty && (
          <button
            className="mt-4 w-full px-4 py-3 rounded-xl bg-accent text-white text-sm font-semibold transition-opacity disabled:opacity-40 enabled:hover:opacity-90"
            disabled={saving}
            onClick={handleSaveProfile}
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        )}
      </section>

      {/* ── Change Password / Sign-in Method ── */}
      {canChangePassword ? (
        <section>
          <SectionHeader title="Change Password" />
          <div className="space-y-2.5">
            <div>
              <FloatingInput
                id="settings-new-password"
                type={showNewPassword ? "text" : "password"}
                label="New password"
                value={newPassword}
                onChange={(e) => {
                  setNewPassword(e.target.value);
                  setPasswordError(null);
                  setPasswordSuccess(false);
                }}
                required={false}
                autoComplete="new-password"
                rightSlot={
                  <button
                    type="button"
                    onClick={() => setShowNewPassword((v) => !v)}
                    className="p-1.5 text-muted hover:text-secondary transition-colors duration-150"
                    tabIndex={-1}
                    aria-label={
                      showNewPassword ? "Hide password" : "Show password"
                    }
                  >
                    {showNewPassword ? <EyeOffIcon /> : <EyeIcon />}
                  </button>
                }
              />
              <AnimatePresence initial={false}>
                {newPassword.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{
                      duration: 0.22,
                      ease: [0.22, 1, 0.36, 1],
                    }}
                    style={{ overflow: "hidden" }}
                    className="mt-2"
                  >
                    <PasswordChecklist password={newPassword} />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <FloatingInput
              id="settings-confirm-password"
              type={showConfirmPassword ? "text" : "password"}
              label="Confirm new password"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                setPasswordError(null);
                setPasswordSuccess(false);
              }}
              required={false}
              autoComplete="new-password"
              error={confirmMismatch ? "Passwords don't match" : undefined}
              rightSlot={
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((v) => !v)}
                  className="p-1.5 text-muted hover:text-secondary transition-colors duration-150"
                  tabIndex={-1}
                  aria-label={
                    showConfirmPassword
                      ? "Hide password"
                      : "Show password"
                  }
                >
                  {showConfirmPassword ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              }
            />

            <AnimatePresence>
              {passwordError && (
                <motion.p
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.15 }}
                  className="text-xs text-danger overflow-hidden"
                >
                  {passwordError}
                </motion.p>
              )}
              {passwordSuccess && (
                <motion.p
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.15 }}
                  className="text-xs text-success overflow-hidden"
                >
                  Password updated successfully.
                </motion.p>
              )}
            </AnimatePresence>

            <button
              className="w-full px-4 py-3 rounded-xl bg-accent text-white text-sm font-semibold transition-opacity disabled:opacity-40 enabled:hover:opacity-90"
              disabled={
                !newPassword ||
                !confirmPassword ||
                confirmMismatch ||
                passwordSaving
              }
              onClick={handleResetPassword}
            >
              {passwordSaving ? "Updating…" : "Update password"}
            </button>
          </div>
        </section>
      ) : (
        <section>
          <SectionHeader title="Sign-in Method" />
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            <p className="text-sm text-secondary">Signed in with Google</p>
          </div>
        </section>
      )}

      {/* ── Delete Account ── */}
      <section className="pt-4 border-t border-border">
        <SectionHeader title="Danger Zone" />
        <p className="text-xs text-muted mb-3 leading-relaxed">
          Permanently delete your account and all associated data. This
          action cannot be undone.
        </p>
        <button
          type="button"
          onClick={handleDeleteAccount}
          disabled={deleting}
          className={`w-full px-4 py-3 rounded-xl text-sm font-semibold transition-colors duration-150 ${
            confirmDelete
              ? "bg-danger text-white hover:opacity-90"
              : "border border-danger text-danger hover:bg-danger/10"
          } disabled:opacity-40`}
        >
          {deleting
            ? "Deleting…"
            : confirmDelete
              ? "Confirm delete — this is permanent"
              : "Delete account"}
        </button>
        {confirmDelete && !deleting && (
          <button
            type="button"
            onClick={() => setConfirmDelete(false)}
            className="w-full mt-2 px-4 py-2 text-xs text-muted hover:text-secondary transition-colors"
          >
            Cancel
          </button>
        )}
      </section>
    </>
  );
}
