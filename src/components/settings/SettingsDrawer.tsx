"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import { Drawer } from "@/components/ui/Drawer";
import { AccountTab } from "./AccountTab";
import { FitnessTab } from "./FitnessTab";
import type { Tab } from "@/types/user";
import type { SettingsDrawerProps } from "@/types/ui";

const TABS: Tab[] = ["account", "fitness"];

export function SettingsDrawer({ open, onClose, user }: SettingsDrawerProps) {
  const [tab, setTab] = useState<Tab>("account");
  const [slideDirection, setSlideDirection] = useState(0);

  return (
    <Drawer open={open} onClose={onClose} title="Settings">
      {/* ── Tab Navigation ── */}
      <LayoutGroup>
        <div className="relative flex border-b border-border px-6">
          {TABS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => {
                setSlideDirection(TABS.indexOf(t) > TABS.indexOf(tab) ? 1 : -1);
                setTab(t);
              }}
              className={`relative px-4 py-3 text-sm font-medium capitalize transition-colors duration-150 -mb-px ${
                tab === t
                  ? "text-accent"
                  : "text-muted hover:text-secondary"
              }`}
            >
              {t}
              {tab === t && (
                <motion.div
                  layoutId="settings-tab-indicator"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent"
                  transition={{ duration: 0.15, ease: [0.22, 1, 0.36, 1] }}
                />
              )}
            </button>
          ))}
        </div>
      </LayoutGroup>

      <AnimatePresence mode="wait" initial={false} custom={slideDirection}>
        <motion.div
          key={tab}
          custom={slideDirection}
          variants={{
            enter: (d: number) => ({ x: d * 60, opacity: 0 }),
            center: { x: 0, opacity: 1 },
            exit: (d: number) => ({ x: d * -60, opacity: 0 }),
          }}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.15, ease: [0.22, 1, 0.36, 1] }}
          className="px-6 py-6 space-y-8"
        >
          {tab === "account" && (
            <AccountTab user={user} open={open} onClose={onClose} />
          )}
          {tab === "fitness" && (
            <FitnessTab user={user} open={open} onClose={onClose} />
          )}
        </motion.div>
      </AnimatePresence>

      {/* Legal links */}
      <div className="px-6 pb-6 pt-2 text-center text-xs text-muted">
        <Link href="/privacy" onClick={onClose} className="hover:text-secondary transition-colors duration-150">
          Privacy Policy
        </Link>
        <span className="mx-2">&middot;</span>
        <Link href="/terms-of-service" onClick={onClose} className="hover:text-secondary transition-colors duration-150">
          Terms of Service
        </Link>
      </div>
    </Drawer>
  );
}
