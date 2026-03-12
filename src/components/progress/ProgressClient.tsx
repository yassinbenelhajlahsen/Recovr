"use client";

import Link from "next/link";
import { useProgressFilters } from "./hooks/useProgressFilters";
import { ExerciseSelector } from "./ExerciseSelector";
import { DateRangeSelector } from "./DateRangeSelector";
import { MetricSelector } from "./MetricSelector";
import { ProgressChart } from "./ProgressChart";
import { useProgress } from "@/lib/hooks";

const CHART_BLUE = "#5B8DEF";

function getChartLines(metricMode: "1rm" | "topWeight" | "both") {
  if (metricMode === "1rm") {
    return [{ dataKey: "estimated1RM", color: "var(--c-accent)", label: "Est. 1RM" }];
  }
  if (metricMode === "topWeight") {
    return [{ dataKey: "maxWeight", color: CHART_BLUE, label: "Top Weight" }];
  }
  return [
    { dataKey: "estimated1RM", color: "var(--c-accent)", label: "Est. 1RM" },
    { dataKey: "maxWeight", color: CHART_BLUE, label: "Top Weight" },
  ];
}

function getChartLabel(metricMode: "1rm" | "topWeight" | "both") {
  if (metricMode === "1rm") return "Estimated 1RM";
  if (metricMode === "topWeight") return "Top Weight";
  return "Est. 1RM & Top Weight";
}

export function ProgressClient() {
  const { data, isLoading } = useProgress();

  const exercises = data?.exercises ?? [];
  const sessionsByExercise = data?.sessionsByExercise ?? {};
  const bodyWeightHistory = data?.bodyWeightHistory ?? [];

  const {
    selectedExerciseId,
    setSelectedExerciseId,
    dateRange,
    setDateRange,
    metricMode,
    setMetricMode,
    chartData,
    bodyWeightChartData,
  } = useProgressFilters(exercises, sessionsByExercise, bodyWeightHistory);

  if (isLoading) {
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="skeleton flex-1 h-10 rounded-full" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="space-y-3">
            <div className="skeleton h-10 w-full rounded-lg" />
            <div className="skeleton h-72 w-full rounded-xl" />
          </div>
          <div className="skeleton h-[340px] w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (exercises.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <p className="text-lg font-medium text-primary mb-2">No workouts logged yet</p>
        <p className="text-sm text-muted mb-6">
          Log your first workout to start tracking progress.
        </p>
        <Link
          href="/dashboard"
          className="rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white hover:opacity-90 transition-opacity"
        >
          Go to Dashboard
        </Link>
      </div>
    );
  }

  const chartLines = getChartLines(metricMode);
  const chartLabel = getChartLabel(metricMode);

  return (
    <div className="space-y-5">
      {/* Shared date range filter */}
      <DateRangeSelector value={dateRange} onChange={setDateRange} />

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left: exercise selector + metric toggle + chart */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <ExerciseSelector
                exercises={exercises}
                selectedId={selectedExerciseId}
                onSelect={setSelectedExerciseId}
              />
            </div>
            <MetricSelector value={metricMode} onChange={setMetricMode} />
          </div>
          <ProgressChart
            chartKey={`${selectedExerciseId}-${dateRange}-${metricMode}`}
            data={chartData}
            label={chartLabel}
            unit="lbs"
            lines={chartLines}
          />
        </div>

        {/* Right: body weight — flex col so chart fills grid row height */}
        <div className="flex flex-col">
          <ProgressChart
            chartKey={dateRange}
            data={bodyWeightChartData}
            dataKey="weight"
            label="Body Weight"
            color="var(--c-success)"
            unit="lbs"
            emptyMessage="Log your weight in a workout to start tracking"
            grow
          />
        </div>
      </div>
    </div>
  );
}
