"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

export function Modal({ open, onClose, title, children }: ModalProps) {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);

  /* eslint-disable react-hooks/set-state-in-effect -- portal mount/unmount + animation requires effect-driven setState */
  useEffect(() => {
    if (open) {
      setMounted(true);
      const raf = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(raf);
    } else {
      setVisible(false);
      const t = setTimeout(() => setMounted(false), 200);
      return () => clearTimeout(t);
    }
  }, [open]);
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
      className={`fixed inset-0 z-40 flex items-end sm:items-center justify-center p-0 sm:p-4 transition-opacity duration-200 ${
        visible ? "opacity-100" : "opacity-0"
      } bg-black/60`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`relative w-full sm:max-w-2xl flex flex-col bg-elevated sm:rounded-xl shadow-2xl transition-all duration-200 max-h-[92dvh] sm:max-h-[88dvh] ${
          visible
            ? "opacity-100 translate-y-0 sm:scale-100"
            : "opacity-0 translate-y-4 sm:scale-[0.97] sm:translate-y-0"
        }`}
      >
        {/* Sticky header */}
        {title && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
            <h2 className="font-display text-lg text-primary">{title}</h2>
            <button
              onClick={onClose}
              className="text-muted hover:text-primary transition-colors -mr-1 p-1"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
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
