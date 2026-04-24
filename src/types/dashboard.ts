import type { Workout } from "@/types/workout";

export type DashboardWorkoutsPayload = Workout[];

export type DashboardFilters = {
  datePreset?: string;
  search?: string;
  muscles?: string;
};
