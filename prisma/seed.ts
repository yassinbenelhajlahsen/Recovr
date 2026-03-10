import { config } from "dotenv";
config({ path: ".env" });

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import DEFAULT_EXERCISES from "./data/exercises.json";
import SEED_WORKOUTS from "./data/workouts.json";

const adapter = new PrismaPg({ connectionString: process.env["DATABASE_URL"]! });
const prisma = new PrismaClient({ adapter });

const SEED_USER_ID = "66894e73-822a-493f-9955-ef11a7378fb4";

async function seedExercises() {
  console.log("Seeding default exercises…");

  // Never delete — cascade would wipe WorkoutExercise + Set rows.
  // Instead: insert new exercises and update changed fields on existing ones.
  const existing = await prisma.exercise.findMany({
    where: { user_id: null },
    select: { id: true, name: true },
  });
  const existingByName = new Map(existing.map((e) => [e.name, e.id]));

  const toInsert = DEFAULT_EXERCISES.filter((e) => !existingByName.has(e.name));
  const toUpdate = DEFAULT_EXERCISES.filter((e) => existingByName.has(e.name));

  if (toInsert.length > 0) {
    await prisma.exercise.createMany({
      data: toInsert.map((e) => ({
        name: e.name,
        muscle_groups: e.muscle_groups,
        equipment: e.equipment,
        user_id: null,
      })),
    });
  }

  for (const e of toUpdate) {
    await prisma.exercise.update({
      where: { id: existingByName.get(e.name)! },
      data: { muscle_groups: e.muscle_groups, equipment: e.equipment },
    });
  }

  console.log(`Exercises — ${toInsert.length} inserted, ${toUpdate.length} updated.`);

  // Return fresh map for workout seeding to use
  const all = await prisma.exercise.findMany({
    where: { user_id: null },
    select: { id: true, name: true },
  });
  return new Map(all.map((e) => [e.name, e.id]));
}

async function seedWorkouts(exerciseIdByName: Map<string, string>) {
  console.log(`\nSeeding workouts for user ${SEED_USER_ID}…`);

  const user = await prisma.user.findUnique({ where: { id: SEED_USER_ID } });
  if (!user) {
    console.warn(`  User ${SEED_USER_ID} not found — skipping workout seed.`);
    return;
  }

  // Idempotent: skip workouts that were already seeded (identified by [seed] in notes)
  const existing = await prisma.workout.findMany({
    where: { user_id: SEED_USER_ID, notes: { contains: "[seed]" } },
    select: { notes: true },
  });
  const seededLabels = new Set(
    existing.map((w) => {
      const match = w.notes?.match(/^(.+?)\s*\[seed\]/);
      return match ? match[1].trim() : "";
    })
  );

  const now = Date.now();
  let inserted = 0;
  let skipped = 0;

  for (const workout of SEED_WORKOUTS) {
    // Extract label from notes (everything before " [seed]")
    const label = workout.notes.replace(" [seed]", "").trim();

    if (seededLabels.has(label)) {
      skipped++;
      continue;
    }

    // Resolve exercise IDs — skip exercises not in the DB
    const resolvedExercises = workout.exercises
      .map((ex, i) => ({ ...ex, order: i + 1, id: exerciseIdByName.get(ex.name) }))
      .filter((ex): ex is typeof ex & { id: string } => ex.id !== undefined);

    const missingNames = workout.exercises
      .filter((ex) => !exerciseIdByName.has(ex.name))
      .map((ex) => ex.name);
    if (missingNames.length > 0) {
      console.warn(`  [${label}] unknown exercises skipped: ${missingNames.join(", ")}`);
    }

    const workoutDate = new Date(now - workout.hoursAgo * 60 * 60 * 1000);

    await prisma.workout.create({
      data: {
        user_id: SEED_USER_ID,
        date: workoutDate,
        notes: workout.notes,
        duration_minutes: workout.duration_minutes,
        workout_exercises: {
          create: resolvedExercises.map((ex) => ({
            exercise_id: ex.id,
            order: ex.order,
            sets: {
              create: ex.sets.map((s, i) => ({
                set_number: i + 1,
                reps: s.reps,
                weight: s.weight,
              })),
            },
          })),
        },
      },
    });

    inserted++;
  }

  console.log(`Workouts — ${inserted} inserted, ${skipped} skipped.`);
}

async function main() {
  const exerciseIdByName = await seedExercises();
  await seedWorkouts(exerciseIdByName);
  console.log("\nDone.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());