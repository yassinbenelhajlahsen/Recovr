import { prisma } from "@/lib/prisma";

type ExerciseRow = { id: string; name: string; muscle_groups: string[] };

/**
 * Resolves an exercise name to a DB exercise ID.
 * Tries exact match → substring match → creates a custom exercise.
 * Mutates `allExercises` on creation so subsequent calls don't duplicate.
 */
export async function resolveExercise(
  name: string,
  muscleGroups: string[],
  allExercises: ExerciseRow[],
  userId: string,
): Promise<{ id: string; name: string; muscleGroups: string[]; created: boolean }> {
  const lowerName = name.toLowerCase();

  // Exact match
  const exact = allExercises.find((e) => e.name.toLowerCase() === lowerName);
  if (exact) return { id: exact.id, name: exact.name, muscleGroups: exact.muscle_groups, created: false };

  // Substring match (either direction)
  const fuzzy = allExercises.find(
    (e) =>
      e.name.toLowerCase().includes(lowerName) ||
      lowerName.includes(e.name.toLowerCase()),
  );
  if (fuzzy) return { id: fuzzy.id, name: fuzzy.name, muscleGroups: fuzzy.muscle_groups, created: false };

  // Create a custom exercise for this user and add to allExercises so subsequent
  // iterations don't create duplicates for the same unknown name.
  const created = await prisma.exercise.create({
    data: {
      name,
      muscle_groups: muscleGroups,
      user_id: userId,
    },
    select: { id: true },
  });
  allExercises.push({ id: created.id, name, muscle_groups: muscleGroups });
  return { id: created.id, name, muscleGroups, created: true };
}
