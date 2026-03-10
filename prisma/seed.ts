import { config } from "dotenv";
config({ path: ".env" });

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import DEFAULT_EXERCISES from "./data/exercises.json";

const adapter = new PrismaPg({ connectionString: process.env["DATABASE_URL"]! });
const prisma = new PrismaClient({ adapter });

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