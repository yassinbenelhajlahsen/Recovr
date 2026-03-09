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
    url: process.env["DATABASE_URL"]!,
    // @ts-expect-error -- directUrl not yet in types but required by Prisma 7 at runtime
    directUrl: process.env["DIRECT_URL"],
  },
});
