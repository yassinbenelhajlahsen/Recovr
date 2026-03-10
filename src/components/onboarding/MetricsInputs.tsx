"use client";

import { useRef } from "react";
import { motion } from "framer-motion";
import { FloatingInput } from "@/components/ui/FloatingInput";
import type { UnitSystem } from "@/types/user";
import type { MetricsInputsProps } from "@/types/ui";

const SPRING = { type: "spring" as const, stiffness: 400, damping: 32 };
const EASE = { duration: 0.4, ease: [0.22, 1, 0.36, 1] as const };

function clampNumeric(value: string, max: number): string {
  const filtered = value.replace(/[^0-9]/g, "");
  if (!filtered) return "";
  const num = parseInt(filtered);
  return String(Math.min(num, max));
}

export function MetricsInputs({
  idPrefix,
  height,
  onHeightChange,
  weight,
  onWeightChange,
  unitSystem,
  onUnitSystemChange,
}: MetricsInputsProps) {
  const isImperial = unitSystem === "imperial";

  const inchesRef = useRef<HTMLInputElement>(null);
  const weightRef = useRef<HTMLInputElement>(null);
  const inchesTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const ftMatch = height.match(/^(\d*)'(\d*)$/);
  const feet = ftMatch ? ftMatch[1] : "";
  const inches = ftMatch ? ftMatch[2] : "";

  function setFeet(v: string) {
    const clamped = clampNumeric(v, 7);
    onHeightChange(`${clamped}'${inches}`);
    if (clamped.length >= 1) {
      inchesRef.current?.focus();
    }
  }

  function setInches(v: string) {
    const clamped = clampNumeric(v, 11);
    onHeightChange(`${feet}'${clamped}`);
    if (inchesTimer.current) clearTimeout(inchesTimer.current);
    if (clamped.length >= 2) {
      // 10 or 11 — advance immediately
      weightRef.current?.focus();
    } else if (clamped === "1") {
      // Could be the start of 10 or 11 — wait briefly
      inchesTimer.current = setTimeout(() => weightRef.current?.focus(), 600);
    } else if (clamped.length === 1) {
      // 2–9 — always single digit, advance immediately
      weightRef.current?.focus();
    }
  }

  function switchSystem(s: UnitSystem) {
    onUnitSystemChange(s);
    onHeightChange(s === "imperial" ? "'" : "");
    onWeightChange("");
  }

  return (
    <div className="space-y-4">
      {/* ── Sliding toggle ── */}
      <div className="relative flex h-10 rounded-xl bg-surface border border-border-subtle overflow-hidden">
        <motion.div
          className="absolute inset-y-0 w-1/2 rounded-[11px] bg-accent"
          animate={{ x: isImperial ? 0 : "100%" }}
          transition={SPRING}
        />
        {(["imperial", "metric"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => switchSystem(s)}
            className="relative z-10 flex-1 text-sm font-medium transition-colors duration-200"
          >
            <motion.span
              animate={{
                color: unitSystem === s
                  ? "var(--c-white, #fff)"
                  : "var(--c-muted)",
              }}
              transition={{ duration: 0.2 }}
            >
              {s === "imperial" ? "Imperial" : "Metric"}
            </motion.span>
          </button>
        ))}
      </div>

      {/* ── Height — mitosis split/merge ── */}
      <div className="flex">
        {/* Primary box: Feet or cm — always present, stretches to fill */}
        <motion.div
          className="min-w-0 overflow-hidden"
          animate={{ flex: isImperial ? "1 1 0%" : "1 1 100%" }}
          transition={EASE}
        >
          {isImperial ? (
            <FloatingInput
              id={`${idPrefix}-height-ft`}
              type="text"
              label="Feet"
              value={feet}
              onChange={(e) => setFeet(e.target.value)}
              required={false}
              inputMode="numeric"
            />
          ) : (
            <FloatingInput
              id={`${idPrefix}-height-cm`}
              type="text"
              label="Height (cm)"
              value={height}
              onChange={(e) => {
                const v = e.target.value.replace(/[^0-9]/g, "");
                onHeightChange(v);
                if (v.length >= 3) weightRef.current?.focus();
              }}
              required={false}
              inputMode="numeric"
            />
          )}
        </motion.div>

        {/* Inches box: splits out / merges back */}
        <motion.div
          className="min-w-0 overflow-hidden"
          animate={{
            flex: isImperial ? "1 1 0%" : "0 0 0%",
            marginLeft: isImperial ? 8 : 0,
            opacity: isImperial ? 1 : 0,
          }}
          transition={EASE}
        >
          <FloatingInput
            id={`${idPrefix}-height-in`}
            type="text"
            label="Inches"
            value={inches}
            onChange={(e) => setInches(e.target.value)}
            required={false}
            inputMode="numeric"
            inputRef={inchesRef}
          />
        </motion.div>
      </div>

      {/* ── Weight ── */}
      <FloatingInput
        id={`${idPrefix}-weight`}
        type="text"
        label={isImperial ? "Weight (lbs)" : "Weight (kg)"}
        value={weight}
        onChange={(e) =>
          onWeightChange(e.target.value.replace(/[^0-9]/g, "").replace(/^0+/, ""))
        }
        required={false}
        inputMode="numeric"
        inputRef={weightRef}
      />
    </div>
  );
}
