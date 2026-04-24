import type { Workout } from "@/types/workout";

export type DashboardWorkoutsPayload = Workout[];

/** Query-param filters for the dashboard workout list. Excludes `draft` — that's a deep-link, not a filter. */
export type DashboardFilters = {
  datePreset?: string;
  search?: string;
  muscles?: string;
};
