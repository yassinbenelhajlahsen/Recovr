"use client";

import { useState } from "react";
import { Drawer } from "@/components/ui/Drawer";
import { FloatingInput } from "@/components/ui/FloatingInput";

interface SettingsDrawerProps {
  open: boolean;
  onClose: () => void;
  user: {
    email: string;
    name?: string | null;
  };
}

function ComingSoonBadge() {
  return (
    <span className="text-xs text-muted bg-elevated border border-border-subtle rounded-full px-2 py-0.5 leading-none">
      Coming soon
    </span>
  );
}

function SectionHeader({
  title,
  badge,
}: {
  title: string;
  badge?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">
        {title}
      </h3>
      {badge && <ComingSoonBadge />}
    </div>
  );
}

export function SettingsDrawer({ open, onClose, user }: SettingsDrawerProps) {
  const [name, setName] = useState(user.name ?? "");
  const isDirty = name !== (user.name ?? "");

  return (
    <Drawer open={open} onClose={onClose} title="Settings">
      <div className="px-6 py-6 space-y-8">
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
            <FloatingInput
              id="settings-email"
              type="email"
              label="Email"
              value={user.email}
              onChange={() => {}}
              disabled
              required={false}
            />
          </div>
          <button
            className="mt-4 px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium transition-opacity disabled:opacity-40 enabled:hover:opacity-90"
            disabled={!isDirty}
            onClick={() => {
              /* will wire up to API later */
            }}
          >
            Save changes
          </button>
        </section>

        {/* ── Body Metrics ── */}
        <section>
          <SectionHeader title="Body Metrics" badge />
          <div className="space-y-3 opacity-50 pointer-events-none select-none">
            <FloatingInput
              id="settings-height"
              type="text"
              label="Height (in)"
              value=""
              onChange={() => {}}
              disabled
              required={false}
            />
            <FloatingInput
              id="settings-weight"
              type="text"
              label="Weight (lbs)"
              value=""
              onChange={() => {}}
              disabled
              required={false}
            />
          </div>
        </section>

        {/* ── Goals ── */}
        <section>
          <SectionHeader title="Goals" badge />
          <div className="opacity-50 pointer-events-none select-none">
            <FloatingInput
              id="settings-goal"
              type="text"
              label="Primary fitness goal"
              value=""
              onChange={() => {}}
              disabled
              required={false}
            />
            <p className="mt-2 text-xs text-muted leading-relaxed">
              Set targets like strength, hypertrophy, endurance, or fat loss.
              Recovery tracking will adapt to your goal.
            </p>
          </div>
        </section>
      </div>
    </Drawer>
  );
}
