import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { GOALS } from "@/components/ui/GoalSelector";
import type { UnitSystem, UserProfile, Gender } from "@/types/user";
import {
  displayHeight,
  displayWeight,
  resolveHeightToInches,
  resolveWeightToLbs,
} from "@/lib/units";
import { normalizeGender } from "@/lib/utils";
import { fetchWithAuth } from "@/lib/fetch";

export function useFitnessForm(
  user: UserProfile | null,
  open: boolean,
  onClose: () => void,
) {
  const router = useRouter();

  const [unitSystem, setUnitSystem] = useState<UnitSystem>("imperial");
  const [height, setHeight] = useState(() => {
    if (!user) return "'";
    return user.height_inches ? displayHeight(user.height_inches, "imperial") : "'";
  });
  const [weight, setWeight] = useState(() => {
    if (!user) return "";
    return user.weight_lbs ? displayWeight(user.weight_lbs, "imperial") : "";
  });
  const [goals, setGoals] = useState<string[]>(() => {
    const g = user?.fitness_goals ?? [];
    const presets = g.filter((v) => (GOALS as readonly string[]).includes(v));
    return presets.length > 0 ? presets : [];
  });
  const [customGoal, setCustomGoal] = useState(() => {
    const g = user?.fitness_goals ?? [];
    const nonPreset = g.find((v) => !(GOALS as readonly string[]).includes(v));
    return nonPreset ?? "";
  });
  const [gender, setGender] = useState<Gender>(() => normalizeGender(user?.gender));
  const [saving, setSaving] = useState(false);

  const isCustomMode = customGoal.trim().length > 0;

  // Sync state when user prop or unitSystem changes
  useEffect(() => {
    if (!user) return;
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
    setGender(normalizeGender(user.gender));
  }, [user, unitSystem]);

  // Reset saving state when drawer closes
  useEffect(() => {
    if (!open) {
      setSaving(false);
    }
  }, [open]);

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

  const resolvedGoals = customGoal.trim() ? [customGoal.trim()] : goals;
  const resolvedHeight = resolveHeightToInches(height, unitSystem);
  const resolvedWeight = resolveWeightToLbs(weight, unitSystem);

  const arraysEqual = (a: string[], b: string[]) =>
    a.length === b.length && a.every((v, i) => v === b[i]);

  const userGender = normalizeGender(user?.gender);
  const isFitnessDirty =
    resolvedHeight !== (user?.height_inches ?? null) ||
    resolvedWeight !== (user?.weight_lbs ?? null) ||
    !arraysEqual(resolvedGoals, user?.fitness_goals ?? []) ||
    gender !== userGender;

  async function handleSaveFitness() {
    setSaving(true);
    const res = await fetchWithAuth("/api/user/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: user?.name ?? null,
        height_inches: resolvedHeight,
        weight_lbs: resolvedWeight,
        fitness_goals: resolvedGoals,
        gender,
      }),
    });
    setSaving(false);
    if (!res.ok) return;
    onClose();
    router.refresh();
  }

  return {
    unitSystem,
    setUnitSystem,
    height,
    setHeight,
    weight,
    setWeight,
    goals,
    setGoals,
    customGoal,
    setCustomGoal,
    gender,
    setGender,
    saving,
    isCustomMode,
    isFitnessDirty,
    toggleGoal,
    handleSaveFitness,
  };
}
