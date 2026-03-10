"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import type { DropdownMenuProps } from "@/types/ui";

export function DropdownMenu({
  open,
  onClose,
  anchorRef,
  children,
  align = "right",
}: DropdownMenuProps) {
  const [mounted, setMounted] = useState(false);
  const [coords, setCoords] = useState({ top: 0, right: 0, left: 0 });
  const dropdownRef = useRef<HTMLDivElement>(null);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- portal needs client-only mount detection
  useEffect(() => { setMounted(true); }, []);

  const updateCoords = useCallback(() => {
    if (!anchorRef.current) return;
    const rect = anchorRef.current.getBoundingClientRect();
    setCoords({
      top: rect.bottom + 8,
      right: window.innerWidth - rect.right,
      left: rect.left,
    });
  }, [anchorRef]);

  useEffect(() => {
    if (!open) return;
    updateCoords();
    window.addEventListener("resize", updateCoords);
    window.addEventListener("scroll", onClose, { passive: true });
    return () => {
      window.removeEventListener("resize", updateCoords);
      window.removeEventListener("scroll", onClose);
    };
  }, [open, updateCoords, onClose]);

  useEffect(() => {
    if (!open) return;
    const handle = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handle);
    return () => document.removeEventListener("keydown", handle);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const handle = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        anchorRef.current &&
        !anchorRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open, onClose, anchorRef]);

  if (!mounted) return null;

  const positionStyle: React.CSSProperties = {
    position: "fixed",
    top: coords.top,
    transformOrigin: align === "right" ? "top right" : "top left",
    zIndex: 50,
    boxShadow:
      "0 4px 6px -1px rgba(0,0,0,0.08), 0 10px 24px -4px rgba(0,0,0,0.12)",
    ...(align === "right"
      ? { right: Math.max(8, coords.right) }
      : { left: coords.left }),
  };

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          ref={dropdownRef}
          initial={{ opacity: 0, scale: 0.95, y: -6 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -6 }}
          transition={{ duration: 0.15, ease: [0.22, 1, 0.36, 1] }}
          style={positionStyle}
          className="min-w-[220px] bg-surface border border-border-subtle rounded-xl overflow-hidden"
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

export function DropdownMenuItem({
  children,
  onClick,
  className = "",
  disabled = false,
  danger = false,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full text-left px-4 py-2.5 text-sm flex items-center gap-3 transition-colors hover:bg-elevated disabled:opacity-50 disabled:cursor-not-allowed ${
        danger ? "text-danger" : "text-primary"
      } ${className}`}
    >
      {children}
    </button>
  );
}

export function DropdownMenuDivider() {
  return <div className="h-px bg-border-subtle my-1" />;
}
