"use client";

import { useRef, useState, useCallback } from "react";
import { DropdownMenu, DropdownMenuItem } from "@/components/ui/DropdownMenu";
import type { MetricMode } from "@/types/progress";

const OPTIONS: { label: string; value: MetricMode }[] = [
  { label: "Est. 1RM", value: "1rm" },
  { label: "Top Weight", value: "topWeight" },
  { label: "Both", value: "both" },
];

type Props = {
  value: MetricMode;
  onChange: (v: MetricMode) => void;
};

export function MetricSelector({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => setOpen(false), []);

  const current = OPTIONS.find((o) => o.value === value)!;

  return (
    <div className="relative flex-shrink-0">
      <button
        ref={triggerRef}
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-lg border border-border-subtle bg-surface px-3 py-2 text-sm text-secondary hover:text-primary hover:border-border transition-colors"
      >
        <span>{current.label}</span>
        <svg
          className={`w-3.5 h-3.5 transition-transform ${open ? "rotate-180" : ""}`}
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M4 6l4 4 4-4" />
        </svg>
      </button>

      <DropdownMenu open={open} onClose={close} anchorRef={triggerRef} align="right">
        {OPTIONS.map((opt) => (
          <DropdownMenuItem
            key={opt.value}
            onClick={() => {
              onChange(opt.value);
              close();
            }}
            className={opt.value === value ? "text-accent" : ""}
          >
            {opt.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenu>
    </div>
  );
}
