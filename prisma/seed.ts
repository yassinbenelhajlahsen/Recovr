import { config } from "dotenv";
config({ path: ".env" });

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env["DATABASE_URL"]! });
const prisma = new PrismaClient({ adapter });

const DEFAULT_EXERCISES = [
  // CHEST
  { name: "Bench Press", muscle_groups: ["chest", "triceps", "shoulders"], equipment: "barbell" },
  { name: "Incline Bench Press", muscle_groups: ["chest", "triceps", "shoulders"], equipment: "barbell" },
  { name: "Decline Bench Press", muscle_groups: ["chest", "triceps"], equipment: "barbell" },
  { name: "Incline Dumbbell Press", muscle_groups: ["chest", "triceps", "shoulders"], equipment: "dumbbell" },
  { name: "Dumbbell Fly", muscle_groups: ["chest"], equipment: "dumbbell" },
  { name: "Cable Fly", muscle_groups: ["chest"], equipment: "cable" },
  { name: "Chest Dip", muscle_groups: ["chest", "triceps", "shoulders"], equipment: "bodyweight" },
  { name: "Push-Up", muscle_groups: ["chest", "triceps", "shoulders"], equipment: "bodyweight" },
  { name: "Pec Deck", muscle_groups: ["chest"], equipment: "machine" },
  { name: "Cable Crossover", muscle_groups: ["chest"], equipment: "cable" },

  // BACK
  { name: "Deadlift", muscle_groups: ["lower back", "hamstrings", "glutes", "traps"], equipment: "barbell" },
  { name: "Pull-Up", muscle_groups: ["back", "biceps"], equipment: "bodyweight" },
  { name: "Chin-Up", muscle_groups: ["back", "biceps"], equipment: "bodyweight" },
  { name: "Lat Pulldown", muscle_groups: ["back", "biceps"], equipment: "cable" },
  { name: "Seated Cable Row", muscle_groups: ["back", "biceps", "rear shoulders"], equipment: "cable" },
  { name: "Dumbbell Row", muscle_groups: ["back", "biceps"], equipment: "dumbbell" },
  { name: "Barbell Row", muscle_groups: ["back", "biceps", "rear shoulders"], equipment: "barbell" },
  { name: "T-Bar Row", muscle_groups: ["back", "biceps"], equipment: "barbell" },
  { name: "Chest-Supported Row", muscle_groups: ["back", "biceps", "rear shoulders"], equipment: "dumbbell" },
  { name: "Straight-Arm Pulldown", muscle_groups: ["back"], equipment: "cable" },
  { name: "Hyperextension", muscle_groups: ["lower back", "glutes", "hamstrings"], equipment: "bodyweight" },

  // SHOULDERS
  { name: "Overhead Press", muscle_groups: ["shoulders", "triceps"], equipment: "barbell" },
  { name: "Dumbbell Shoulder Press", muscle_groups: ["shoulders", "triceps"], equipment: "dumbbell" },
  { name: "Arnold Press", muscle_groups: ["shoulders", "triceps"], equipment: "dumbbell" },
  { name: "Lateral Raise", muscle_groups: ["shoulders"], equipment: "dumbbell" },
  { name: "Cable Lateral Raise", muscle_groups: ["shoulders"], equipment: "cable" },
  { name: "Face Pull", muscle_groups: ["rear shoulders", "traps"], equipment: "cable" },
  { name: "Reverse Fly", muscle_groups: ["rear shoulders", "traps"], equipment: "dumbbell" },
  { name: "Upright Row", muscle_groups: ["shoulders", "traps"], equipment: "barbell" },
  { name: "Shrug", muscle_groups: ["traps"], equipment: "barbell" },
  { name: "Dumbbell Shrug", muscle_groups: ["traps"], equipment: "dumbbell" },

  // LEGS
  { name: "Squat", muscle_groups: ["quadriceps", "glutes", "hamstrings"], equipment: "barbell" },
  { name: "Front Squat", muscle_groups: ["quadriceps", "glutes"], equipment: "barbell" },
  { name: "Hack Squat", muscle_groups: ["quadriceps", "glutes"], equipment: "machine" },
  { name: "Leg Press", muscle_groups: ["quadriceps", "glutes"], equipment: "machine" },
  { name: "Romanian Deadlift", muscle_groups: ["hamstrings", "glutes", "lower back"], equipment: "barbell" },
  { name: "Leg Curl", muscle_groups: ["hamstrings"], equipment: "machine" },
  { name: "Leg Extension", muscle_groups: ["quadriceps"], equipment: "machine" },
  { name: "Lunge", muscle_groups: ["quadriceps", "glutes", "hamstrings"], equipment: "dumbbell" },
  { name: "Bulgarian Split Squat", muscle_groups: ["quadriceps", "glutes", "hamstrings"], equipment: "dumbbell" },
  { name: "Hip Thrust", muscle_groups: ["glutes", "hamstrings"], equipment: "barbell" },
  { name: "Glute Bridge", muscle_groups: ["glutes", "hamstrings"], equipment: "bodyweight" },
  { name: "Step-Up", muscle_groups: ["quadriceps", "glutes"], equipment: "dumbbell" },
  { name: "Sumo Deadlift", muscle_groups: ["hamstrings", "glutes", "lower back", "quadriceps"], equipment: "barbell" },
  { name: "Calf Raise", muscle_groups: ["calves"], equipment: "machine" },
  { name: "Seated Calf Raise", muscle_groups: ["calves"], equipment: "machine" },
  { name: "Donkey Calf Raise", muscle_groups: ["calves"], equipment: "bodyweight" },

  // BICEPS
  { name: "Barbell Curl", muscle_groups: ["biceps"], equipment: "barbell" },
  { name: "Dumbbell Curl", muscle_groups: ["biceps"], equipment: "dumbbell" },
  { name: "Hammer Curl", muscle_groups: ["biceps", "forearms"], equipment: "dumbbell" },
  { name: "Incline Dumbbell Curl", muscle_groups: ["biceps"], equipment: "dumbbell" },
  { name: "Cable Curl", muscle_groups: ["biceps"], equipment: "cable" },
  { name: "Preacher Curl", muscle_groups: ["biceps"], equipment: "barbell" },
  { name: "Concentration Curl", muscle_groups: ["biceps"], equipment: "dumbbell" },
  { name: "EZ-Bar Curl", muscle_groups: ["biceps", "forearms"], equipment: "barbell" },

  // TRICEPS
  { name: "Tricep Pushdown", muscle_groups: ["triceps"], equipment: "cable" },
  { name: "Overhead Tricep Extension", muscle_groups: ["triceps"], equipment: "dumbbell" },
  { name: "Skull Crusher", muscle_groups: ["triceps"], equipment: "barbell" },
  { name: "Close-Grip Bench Press", muscle_groups: ["triceps", "chest"], equipment: "barbell" },
  { name: "Tricep Dip", muscle_groups: ["triceps", "chest", "shoulders"], equipment: "bodyweight" },
  { name: "Cable Overhead Tricep Extension", muscle_groups: ["triceps"], equipment: "cable" },
  { name: "Diamond Push-Up", muscle_groups: ["triceps", "chest"], equipment: "bodyweight" },

  // CORE
  { name: "Plank", muscle_groups: ["core"], equipment: "bodyweight" },
  { name: "Crunch", muscle_groups: ["core"], equipment: "bodyweight" },
  { name: "Cable Crunch", muscle_groups: ["core"], equipment: "cable" },
  { name: "Hanging Leg Raise", muscle_groups: ["core", "hip flexors"], equipment: "bodyweight" },
  { name: "Ab Rollout", muscle_groups: ["core"], equipment: "bodyweight" },
  { name: "Russian Twist", muscle_groups: ["core"], equipment: "bodyweight" },
  { name: "Decline Sit-Up", muscle_groups: ["core"], equipment: "bodyweight" },
  { name: "Side Plank", muscle_groups: ["core"], equipment: "bodyweight" },
  { name: "Dead Bug", muscle_groups: ["core"], equipment: "bodyweight" },
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
