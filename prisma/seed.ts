import { config } from "dotenv";
config({ path: ".env" });

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env["DATABASE_URL"]! });
const prisma = new PrismaClient({ adapter });

const DEFAULT_EXERCISES = [
  { name: "Bench Press", muscle_groups: ["chest", "triceps", "shoulders"], equipment: "barbell" },
  { name: "Incline Dumbbell Press", muscle_groups: ["chest", "triceps", "shoulders"], equipment: "dumbbell" },
  { name: "Cable Fly", muscle_groups: ["chest"], equipment: "cable" },
  { name: "Squat", muscle_groups: ["quadriceps", "glutes", "hamstrings"], equipment: "barbell" },
  { name: "Leg Press", muscle_groups: ["quadriceps", "glutes"], equipment: "machine" },
  { name: "Romanian Deadlift", muscle_groups: ["hamstrings", "glutes", "lower back"], equipment: "barbell" },
  { name: "Deadlift", muscle_groups: ["lower back", "hamstrings", "glutes", "traps"], equipment: "barbell" },
  { name: "Pull-Up", muscle_groups: ["back", "biceps"], equipment: "bodyweight" },
  { name: "Lat Pulldown", muscle_groups: ["back", "biceps"], equipment: "cable" },
  { name: "Seated Cable Row", muscle_groups: ["back", "biceps", "rear shoulders"], equipment: "cable" },
  { name: "Overhead Press", muscle_groups: ["shoulders", "triceps"], equipment: "barbell" },
  { name: "Lateral Raise", muscle_groups: ["shoulders"], equipment: "dumbbell" },
  { name: "Barbell Curl", muscle_groups: ["biceps"], equipment: "barbell" },
  { name: "Tricep Pushdown", muscle_groups: ["triceps"], equipment: "cable" },
  { name: "Leg Curl", muscle_groups: ["hamstrings"], equipment: "machine" },
  { name: "Leg Extension", muscle_groups: ["quadriceps"], equipment: "machine" },
  { name: "Calf Raise", muscle_groups: ["calves"], equipment: "machine" },
  { name: "Face Pull", muscle_groups: ["rear shoulders", "traps"], equipment: "cable" },
  { name: "Plank", muscle_groups: ["core"], equipment: "bodyweight" },
  { name: "Dumbbell Row", muscle_groups: ["back", "biceps"], equipment: "dumbbell" },
];

async function main() {
  console.log("Seeding default exercises…");

  // Delete existing defaults, then recreate (idempotent)
  await prisma.exercise.deleteMany({ where: { user_id: null } });
  await prisma.exercise.createMany({
    data: DEFAULT_EXERCISES.map((e) => ({
      name: e.name,
      muscle_groups: e.muscle_groups,
      equipment: e.equipment,
      user_id: null,
    })),
  });

  console.log(`Seeded ${DEFAULT_EXERCISES.length} default exercises.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
