import type { UnitSystem } from "@/types/user";

/** Parse "5'10" format into total inches. Returns null if no digits. */
export function parseFeetInches(input: string): number | null {
  const match = input.match(/^(\d*)'(\d*)$/);
  if (!match) return null;
  const ft = match[1] ? parseInt(match[1]) : 0;
  const inches = match[2] ? parseInt(match[2]) : 0;
  if (ft === 0 && inches === 0) return null;
  return ft * 12 + inches;
}

/** Convert cm to inches */
export function cmToInches(cm: number): number {
  return Math.round(cm / 2.54);
}

/** Convert inches to cm */
export function inchesToCm(inches: number): number {
  return Math.round(inches * 2.54);
}

/** Convert stored inches to ft/in display string */
export function inchesToFtIn(inches: number): string {
  const ft = Math.floor(inches / 12);
  const rem = inches % 12;
  return `${ft}'${rem}`;
}

/** Convert kg to lbs */
export function kgToLbs(kg: number): number {
  return Math.round(kg * 2.20462);
}

/** Convert lbs to kg */
export function lbsToKg(lbs: number): number {
  return Math.round(lbs / 2.20462);
}

/** Resolve height string + unit system to inches for storage */
export function resolveHeightToInches(
  height: string,
  system: UnitSystem,
): number | null {
  if (system === "imperial") {
    return parseFeetInches(height);
  }
  const num = parseFloat(height);
  if (isNaN(num) || num <= 0) return null;
  return cmToInches(num);
}

/** Resolve weight string + unit system to lbs for storage */
export function resolveWeightToLbs(
  weight: string,
  system: UnitSystem,
): number | null {
  const num = parseFloat(weight);
  if (isNaN(num) || num <= 0) return null;
  return system === "metric" ? kgToLbs(num) : Math.round(num);
}

/** Convert stored inches to display string for given system */
export function displayHeight(inches: number, system: UnitSystem): string {
  return system === "imperial" ? inchesToFtIn(inches) : String(inchesToCm(inches));
}

/** Convert stored lbs to display string for given system */
export function displayWeight(lbs: number, system: UnitSystem): string {
  return system === "imperial" ? String(lbs) : String(lbsToKg(lbs));
}
