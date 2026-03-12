"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  BodyWeightChartPoint,
  BodyWeightEntry,
  ChartDataPoint,
  DateRangePreset,
  ExerciseSession,
  MetricMode,
  PerformedExercise,
} from "@/types/progress";

// Proxy weight for bodyweight exercises (matches recovery.ts BODYWEIGHT_PROXY)
const BODYWEIGHT_PROXY = 75;

function epley1RM(weight: number, reps: number): number {
  const w = weight > 0 ? weight : BODYWEIGHT_PROXY;
  if (reps === 1) return w;
  if (reps === 0) return 0;
  return w * (1 + reps / 30);
}

function getDateThreshold(preset: DateRangePreset): Date | null {
  const now = new Date();
  switch (preset) {
    case "30d":
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    case "90d":
      return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    case "6m":
      return new Date(now.getTime() - 182 * 24 * 60 * 60 * 1000);
    case "1y":
      return new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
    case "all":
    default:
      return null;
  }
}

function formatChartDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function sessionsToChartData(sessions: ExerciseSession[]): ChartDataPoint[] {
  return sessions.map((s) => {
    const validSets = s.sets.filter((set) => set.reps > 0);
    const best1RM = validSets.reduce((best, set) => {
      const val = epley1RM(set.weight, set.reps);
      return val > best ? val : best;
    }, 0);
    const maxWeight = s.sets.reduce(
      (max, set) => (set.weight > max ? set.weight : max),
      0,
    );
    return {
      date: formatChartDate(s.date),
      dateRaw: s.date,
      estimated1RM: Math.round(best1RM * 10) / 10,
      maxWeight,
      totalSets: s.sets.length,
    };
  });
}

export function useProgressFilters(
  exercises: PerformedExercise[],
  sessionsByExercise: Record<string, ExerciseSession[]>,
  bodyWeightHistory: BodyWeightEntry[],
) {
  const [selectedExerciseId, setSelectedExerciseId] = useState<string>(
    exercises[0]?.id ?? "",
  );
  const [dateRange, setDateRange] = useState<DateRangePreset>("90d");
  const [metricMode, setMetricMode] = useState<MetricMode>("1rm");

  // When data arrives from SWR (exercises goes from [] → populated), initialize selection
  useEffect(() => {
    if (selectedExerciseId === "" && exercises.length > 0) {
      setSelectedExerciseId(exercises[0].id);
    }
  }, [exercises, selectedExerciseId]);

  const chartData = useMemo<ChartDataPoint[]>(() => {
    const sessions = sessionsByExercise[selectedExerciseId] ?? [];
    const threshold = getDateThreshold(dateRange);
    const filtered = threshold
      ? sessions.filter((s) => new Date(s.date) >= threshold)
      : sessions;
    return sessionsToChartData(filtered);
  }, [selectedExerciseId, dateRange, sessionsByExercise]);

  const bodyWeightChartData = useMemo<BodyWeightChartPoint[]>(() => {
    const threshold = getDateThreshold(dateRange);
    const filtered = threshold
      ? bodyWeightHistory.filter((e) => new Date(e.date) >= threshold)
      : bodyWeightHistory;
    return filtered.map((e) => ({
      date: formatChartDate(e.date),
      dateRaw: e.date,
      weight: e.weight,
    }));
  }, [dateRange, bodyWeightHistory]);

  const stats = useMemo(() => {
    if (chartData.length === 0) {
      return { best1RM: 0, best1RMDate: null, sessions: 0 };
    }
    const best = chartData.reduce(
      (b, d) => (d.estimated1RM > b.estimated1RM ? d : b),
      chartData[0],
    );
    return {
      best1RM: best.estimated1RM,
      best1RMDate: best.date,
      sessions: chartData.length,
    };
  }, [chartData]);

  return {
    selectedExerciseId,
    setSelectedExerciseId,
    dateRange,
    setDateRange,
    metricMode,
    setMetricMode,
    chartData,
    bodyWeightChartData,
    stats,
  };
}
