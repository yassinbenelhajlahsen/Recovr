"use client";

import { AnimatePresence, motion } from "framer-motion";
import { FloatingInput } from "@/components/ui/FloatingInput";
import { PasswordChecklist } from "@/components/ui/PasswordChecklist";
import { EyeIcon, EyeOffIcon, AppleIcon, GoogleIcon } from "@/components/ui/icons";
import { SectionHeader } from "./SectionHeader";
import { useProfileSave } from "./hooks/useProfileSave";
import { usePasswordReset } from "./hooks/usePasswordReset";
import { useDeleteAccount } from "./hooks/useDeleteAccount";
import type { UserProfile } from "@/types/user";

interface AccountTabProps {
  user: UserProfile;
  open: boolean;
  onClose: () => void;
}

export function AccountTab({ user, open, onClose }: AccountTabProps) {
  const { name, setName, saving, isAccountDirty, handleSaveProfile } =
    useProfileSave(user, onClose);

  const {
    newPassword,
    setNewPassword,
    confirmPassword,
    setConfirmPassword,
    showNewPassword,
    setShowNewPassword,
    showConfirmPassword,
    setShowConfirmPassword,
    passwordError,
    setPasswordError,
    passwordSuccess,
    setPasswordSuccess,
    passwordSaving,
    confirmMismatch,
    handleResetPassword,
  } = usePasswordReset(open);

  const { confirmDelete, setConfirmDelete, deleting, handleDeleteAccount } =
    useDeleteAccount(open);

  const providers = user.providers ?? [];
  const canChangePassword = providers.includes("email") || !providers.length;

  return (
    <>
      {/* ── Profile ── */}
      <section>
        <SectionHeader title="Profile" />
        <div className="space-y-3">
          <FloatingInput
            id="settings-name"
            type="text"
            label="Name"
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
            {providers.includes("apple") ? (
              <>
                <AppleIcon className="w-5 h-5 shrink-0" />
                <p className="text-sm text-secondary">Signed in with Apple</p>
              </>
            ) : (
              <>
                <GoogleIcon className="w-5 h-5 shrink-0" />
                <p className="text-sm text-secondary">Signed in with Google</p>
              </>
            )}
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
