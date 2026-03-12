"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { DrawerProps } from "@/types/ui";

export function Drawer({ open, onClose, title, headerRight, size = "default", children }: DrawerProps) {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);

  // useLayoutEffect runs synchronously after DOM mutations, before paint —
  // this guarantees the drawer is in the DOM with translate-x-full before
  // any rAF fires, giving the CSS transition a start state to animate from.
  useLayoutEffect(() => {
    if (open) setMounted(true);
  }, [open]);

  /* eslint-disable react-hooks/set-state-in-effect -- portal mount/unmount + animation requires effect-driven setState */
  useEffect(() => {
    if (open && mounted) {
      let raf2: number;
      const raf = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => setVisible(true));
      });
      return () => { cancelAnimationFrame(raf); cancelAnimationFrame(raf2); };
    } else if (!open) {
      setVisible(false);
      const t = setTimeout(() => setMounted(false), 300);
      return () => clearTimeout(t);
    }
  }, [open, mounted]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (!open) return;
    const handle = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handle);
    return () => document.removeEventListener("keydown", handle);
  }, [open, onClose]);

  if (!mounted) return null;

  return createPortal(
    <div
      className={`fixed inset-0 z-40 flex justify-end transition-opacity duration-300 ${
        visible ? "opacity-100" : "opacity-0"
      } bg-black/60`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`relative flex flex-col w-full ${size === "lg" ? "max-w-xl" : "max-w-md"} h-full bg-elevated shadow-2xl transition-transform ${
          visible
            ? "duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] translate-x-0"
            : "duration-250 ease-[cubic-bezier(0.4,0,1,1)] translate-x-full"
        }`}
      >
        {/* Sticky header */}
        {title && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
            <h2 className="font-display text-lg text-primary">{title}</h2>
            <div className="flex items-center gap-3 -mr-1">
              {headerRight}
              <button
                onClick={onClose}
                className="text-muted hover:text-primary transition-colors p-1"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        )}
        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 overscroll-contain">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}
