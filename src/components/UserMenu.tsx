"use client";

import { useTheme } from "@/components/ThemeProvider";
import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuDivider,
} from "@/components/ui/DropdownMenu";
import type { User } from "@supabase/supabase-js";

interface UserMenuProps {
  open: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLElement | null>;
  user: User;
  onOpenSettings: () => void;
  onSignOut: () => void;
}

const SunIcon = () => (
  <svg
    className="h-4 w-4 shrink-0"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={2}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M12 7a5 5 0 1 0 0 10A5 5 0 0 0 12 7z"
    />
  </svg>
);

const MoonIcon = () => (
  <svg
    className="h-4 w-4 shrink-0"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={2}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"
    />
  </svg>
);

const SettingsIcon = () => (
  <svg
    className="h-4 w-4 shrink-0"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={2}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z"
    />
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
    />
  </svg>
);

const SignOutIcon = () => (
  <svg
    className="h-4 w-4 shrink-0"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={2}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9"
    />
  </svg>
);

export function UserMenu({
  open,
  onClose,
  anchorRef,
  user,
  onOpenSettings,
  onSignOut,
}: UserMenuProps) {
  const { theme, toggleTheme } = useTheme();

  return (
    <DropdownMenu open={open} onClose={onClose} anchorRef={anchorRef}>
      {/* Email header */}
      <div className="px-4 py-3 border-b border-border-subtle">
        <p className="text-xs text-muted truncate max-w-[180px]">
          {user.email}
        </p>
      </div>

      {/* Theme toggle */}
      <DropdownMenuItem onClick={toggleTheme}>
        {theme === "dark" ? <SunIcon /> : <MoonIcon />}
        {theme === "dark" ? "Light mode" : "Dark mode"}
      </DropdownMenuItem>

      {/* Settings */}
      <DropdownMenuItem
        onClick={() => {
          onOpenSettings();
          onClose();
        }}
      >
        <SettingsIcon />
        Settings
      </DropdownMenuItem>

      <DropdownMenuDivider />

      {/* Sign out */}
      <DropdownMenuItem
        danger
        onClick={() => {
          onSignOut();
          onClose();
        }}
      >
        <SignOutIcon />
        Sign out
      </DropdownMenuItem>
    </DropdownMenu>
  );
}
