"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { FloatingInput } from "@/components/ui/FloatingInput";
import { MetricsInputs } from "@/components/onboarding/MetricsInputs";
import { SectionHeader } from "./SectionHeader";
import type { UnitSystem } from "@/types/user";
import {
  displayHeight,
  displayWeight,
  resolveHeightToInches,
  resolveWeightToLbs,
} from "@/lib/units";
import type { UserProfile } from "@/types/user";
import type { FitnessTabProps } from "@/types/ui";

const GOALS = ["Strength", "Hypertrophy", "Endurance", "Fat Loss"] as const;

export function FitnessTab({ user, onClose }: FitnessTabProps) {
  const router = useRouter();

  const [unitSystem, setUnitSystem] = useState<UnitSystem>("imperial");
  const [height, setHeight] = useState(() =>
    user.height_inches
      ? displayHeight(user.height_inches, "imperial")
      : "'"
  );
  const [weight, setWeight] = useState(() =>
    user.weight_lbs ? displayWeight(user.weight_lbs, "imperial") : ""
  );
  const [goals, setGoals] = useState<string[]>(() => {
    const g = user.fitness_goals ?? [];
    const presets = g.filter((v) => (GOALS as readonly string[]).includes(v));
    return presets.length > 0 ? presets : [];
  });
  const [customGoal, setCustomGoal] = useState(() => {
    const g = user.fitness_goals ?? [];
    const nonPreset = g.find((v) => !(GOALS as readonly string[]).includes(v));
    return nonPreset ?? "";
  });
  const [saving, setSaving] = useState(false);
  const isCustomMode = customGoal.trim().length > 0;

  function toggleGoal(g: string) {
    setCustomGoal("");
    setGoals((prev) =>
      prev.includes(g)
        ? prev.filter((x) => x !== g)
        : prev.length < 3
          ? [...prev, g]
          : prev
    );
  }

  // Sync state when user prop changes
  useEffect(() => {
    setHeight(
      user.height_inches
        ? displayHeight(user.height_inches, unitSystem)
        : unitSystem === "imperial"
          ? "'"
          : ""
    );
    setWeight(
      user.weight_lbs ? displayWeight(user.weight_lbs, unitSystem) : ""
    );
    const g = user.fitness_goals ?? [];
    const presets = g.filter((v) => (GOALS as readonly string[]).includes(v));
    const nonPreset = g.find((v) => !(GOALS as readonly string[]).includes(v));
    setGoals(presets);
    setCustomGoal(nonPreset ?? "");
  }, [user, unitSystem]);

  const resolvedGoals = customGoal.trim() ? [customGoal.trim()] : goals;
  const resolvedHeight = resolveHeightToInches(height, unitSystem);
  const resolvedWeight = resolveWeightToLbs(weight, unitSystem);

  const arraysEqual = (a: string[], b: string[]) =>
    a.length === b.length && a.every((v, i) => v === b[i]);

  const isFitnessDirty =
    resolvedHeight !== (user.height_inches ?? null) ||
    resolvedWeight !== (user.weight_lbs ?? null) ||
    !arraysEqual(resolvedGoals, user.fitness_goals ?? []);

  async function handleSaveFitness() {
    setSaving(true);
    await fetch("/api/user/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: user.name ?? null,
        height_inches: resolvedHeight,
        weight_lbs: resolvedWeight,
        fitness_goals: resolvedGoals,
      }),
    });
    setSaving(false);
    onClose();
    router.refresh();
  }

  return (
    <>
      {/* ── Body Metrics ── */}
      <section>
        <SectionHeader title="Body Metrics" />
        <MetricsInputs
          idPrefix="settings"
          height={height}
          onHeightChange={setHeight}
          weight={weight}
          onWeightChange={setWeight}
          unitSystem={unitSystem}
          onUnitSystemChange={setUnitSystem}
        />
      </section>

      {/* ── Goals ── */}
      <section>
        <SectionHeader title="Goals" />
        <div className="grid grid-cols-2 gap-3">
          {GOALS.map((g) => {
            const selected = goals.includes(g);
            const disabled = !selected && goals.length >= 3;
            return (
              <button
                key={g}
                type="button"
                onClick={() => toggleGoal(g)}
                disabled={disabled || isCustomMode}
                className={`px-4 py-3 rounded-xl border text-sm font-medium transition-colors duration-150 ${
                  selected
                    ? "bg-accent text-white border-accent"
                    : "bg-surface border-border-subtle text-primary hover:border-border disabled:opacity-40 disabled:pointer-events-none"
                }`}
              >
                {g}
              </button>
            );
          })}
        </div>
        <div className="mt-3">
          <FloatingInput
            id="settings-custom-goal"
            type="text"
            label="Custom goal"
            value={customGoal}
            onChange={(e) => {
              setCustomGoal(e.target.value);
              if (e.target.value.trim()) setGoals([]);
            }}
            required={false}
          />
        </div>
        <p className="mt-2 text-xs text-muted leading-relaxed">
          Recovery tracking will adapt to your goal.
        </p>
      </section>

      <button
        className="w-full px-4 py-3 rounded-xl bg-accent text-white text-sm font-semibold transition-opacity disabled:opacity-40 enabled:hover:opacity-90"
        disabled={!isFitnessDirty || saving}
        onClick={handleSaveFitness}
      >
        {saving ? "Saving…" : "Save changes"}
      </button>
    </>
  );
}
