import { config } from "dotenv";
import { defineConfig } from "prisma/config";

// Load .env for Next.js projects
config({ path: ".env" });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env["DIRECT_URL"]!,
  },
});
