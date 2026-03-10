export type UnitSystem = "imperial" | "metric";

export interface UserProfile {
  email: string;
  name?: string | null;
  height_inches?: number | null;
  weight_lbs?: number | null;
  fitness_goals?: string[];
  providers?: string[];
}

export type Tab = "account" | "fitness";
