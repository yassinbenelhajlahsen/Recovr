"use client";

import Link from "next/link";
import { useProgressFilters } from "./hooks/useProgressFilters";
import { ExerciseSelector } from "./ExerciseSelector";
import { DateRangeSelector } from "./DateRangeSelector";
import { ProgressChart } from "./ProgressChart";
import type { ProgressClientProps } from "@/types/progress";

export function ProgressClient({ exercises, sessionsByExercise, bodyWeightHistory }: ProgressClientProps) {
  const {
    selectedExerciseId,
    setSelectedExerciseId,
    dateRange,
    setDateRange,
    chartData,
    bodyWeightChartData,
  } = useProgressFilters(exercises, sessionsByExercise, bodyWeightHistory);

  if (exercises.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <p className="text-lg font-medium text-primary mb-2">No workouts logged yet</p>
        <p className="text-sm text-muted mb-6">
          Log your first workout to start tracking progress.
        </p>
        <Link
          href="/"
          className="rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white hover:opacity-90 transition-opacity"
        >
          Go to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Shared date range filter */}
      <DateRangeSelector value={dateRange} onChange={setDateRange} />

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left: exercise selector + 1RM */}
        <div className="space-y-3">
          <ExerciseSelector
            exercises={exercises}
            selectedId={selectedExerciseId}
            onSelect={setSelectedExerciseId}
          />
          <ProgressChart
            chartKey={`${selectedExerciseId}-${dateRange}`}
            data={chartData}
            dataKey="estimated1RM"
            label="Estimated 1RM"
            color="var(--c-accent)"
            unit="lbs"
          />
        </div>

        {/* Right: body weight */}
        <ProgressChart
          chartKey={dateRange}
          data={bodyWeightChartData}
          dataKey="weight"
          label="Body Weight"
          color="var(--c-success)"
          unit="lbs"
          emptyMessage="Log your weight in a workout to start tracking"
        />
      </div>
    </div>
  );
}
