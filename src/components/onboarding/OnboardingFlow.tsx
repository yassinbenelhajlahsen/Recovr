"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { FloatingInput } from "@/components/ui/FloatingInput";
import { GoalSelector } from "@/components/ui/GoalSelector";
import { MetricsInputs } from "./MetricsInputs";
import { useAppStore } from "@/store/appStore";
import { createClient } from "@/lib/supabase/client";
import type { UnitSystem } from "@/types/user";
import { resolveHeightToInches, resolveWeightToLbs } from "@/lib/units";

const slideVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? 80 : -80, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? -80 : 80, opacity: 0 }),
};

function StepDots({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={`w-2 h-2 rounded-full transition-colors duration-300 ${
            i <= current ? "bg-accent" : "bg-border"
          }`}
        />
      ))}
    </div>
  );
}

export function OnboardingFlow({ initialName }: { initialName: string }) {
  const router = useRouter();
  const setOnboarding = useAppStore((s) => s.setOnboarding);
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setOnboarding(true);
    return () => setOnboarding(false);
  }, [setOnboarding]);

  const [name, setName] = useState(initialName);
  const [unitSystem, setUnitSystem] = useState<UnitSystem>("imperial");
  const [height, setHeight] = useState("'");
  const [weight, setWeight] = useState("");
  const [goals, setGoals] = useState<string[]>([]);
  const [customGoal, setCustomGoal] = useState("");
  const isCustomMode = customGoal.trim().length > 0;

  function toggleGoal(g: string) {
    setCustomGoal("");
    setGoals((prev) =>
      prev.includes(g)
        ? prev.filter((x) => x !== g)
        : prev.length < 3
          ? [...prev, g]
          : prev,
    );
  }

  function next() {
    setDirection(1);
    setStep((s) => s + 1);
  }

  async function finish() {
    setSaving(true);
    const trimmedName = name.trim() || null;
    const fitnessGoals = customGoal.trim() ? [customGoal.trim()] : goals;
    const supabase = createClient();
    await Promise.all([
      fetch("/api/user/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmedName,
          height_inches: resolveHeightToInches(height, unitSystem),
          weight_lbs: resolveWeightToLbs(weight, unitSystem),
          fitness_goals: fitnessGoals,
          onboarding_completed: true,
        }),
      }),
      supabase.auth.updateUser({ data: { full_name: trimmedName } }),
    ]);
    router.push("/");
    router.refresh();
  }

  return (
    <div className="min-h-[calc(100dvh-65px)] flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-[420px]">
        <StepDots current={step} total={3} />

        <AnimatePresence mode="wait" custom={direction}>
          {step === 0 && (
            <motion.div
              key="step-0"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="text-center space-y-1 mb-8">
                <h1 className="font-display text-4xl italic text-primary">
                  Welcome to Recovr
                </h1>
                <p className="text-sm text-muted">
                  Let&apos;s set up your profile
                </p>
              </div>

              <div className="space-y-4">
                <FloatingInput
                  id="onboarding-name"
                  type="text"
                  label="Name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required={false}
                  autoComplete="name"
                  autoCapitalize="words"
                />

                <motion.button
                  type="button"
                  onClick={next}
                  whileTap={{ scale: 0.97 }}
                  className="w-full rounded-xl bg-accent hover:bg-accent-hover text-white text-[15px] font-semibold py-[13px] transition-colors duration-150"
                >
                  Continue
                </motion.button>
              </div>
            </motion.div>
          )}

          {step === 1 && (
            <motion.div
              key="step-1"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="text-center space-y-1 mb-8">
                <h1 className="font-display text-4xl italic text-primary">
                  Body metrics
                </h1>
                <p className="text-sm text-muted">
                  Helps personalize your experience
                </p>
              </div>

              <div className="space-y-4">
                <MetricsInputs
                  idPrefix="onboarding"
                  height={height}
                  onHeightChange={setHeight}
                  weight={weight}
                  onWeightChange={setWeight}
                  unitSystem={unitSystem}
                  onUnitSystemChange={setUnitSystem}
                />

                <motion.button
                  type="button"
                  onClick={next}
                  whileTap={{ scale: 0.97 }}
                  className="w-full rounded-xl bg-accent hover:bg-accent-hover text-white text-[15px] font-semibold py-[13px] transition-colors duration-150"
                >
                  Continue
                </motion.button>
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step-2"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="text-center space-y-1 mb-8">
                <h1 className="font-display text-4xl italic text-primary">
                  What&apos;s your goal?
                </h1>
                <p className="text-sm text-muted">
                  Recovery tracking will adapt to your focus
                </p>
                <p className="text-xs text-muted">
                  Select up to 3
                </p>
              </div>

              <div className="space-y-4">
                <GoalSelector
                  goals={goals}
                  customGoal={customGoal}
                  onToggleGoal={toggleGoal}
                  onCustomGoalChange={(value) => {
                    setCustomGoal(value);
                    if (value.trim()) setGoals([]);
                  }}
                  isCustomMode={isCustomMode}
                  inputId="onboarding-custom-goal"
                  showDivider={true}
                />

                <motion.button
                  type="button"
                  onClick={finish}
                  disabled={saving}
                  whileTap={{ scale: 0.97 }}
                  className="w-full rounded-xl bg-accent hover:bg-accent-hover text-white text-[15px] font-semibold py-[13px] transition-colors duration-150 disabled:opacity-50"
                >
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.span
                      key={String(saving)}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.14 }}
                      className="block"
                    >
                      {saving ? "Setting up…" : "Get started"}
                    </motion.span>
                  </AnimatePresence>
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
