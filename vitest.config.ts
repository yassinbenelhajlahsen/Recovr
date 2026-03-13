import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      // Specific mock aliases must come BEFORE the generic @ alias
      {
        find: "@/generated/prisma/client",
        replacement: path.resolve(
          __dirname,
          "./src/test/mocks/prisma-generated.ts",
        ),
      },
      {
        find: "@/lib/prisma",
        replacement: path.resolve(__dirname, "./src/test/mocks/prisma.ts"),
      },
      {
        find: "@/lib/supabase/server",
        replacement: path.resolve(
          __dirname,
          "./src/test/mocks/supabase-server.ts",
        ),
      },
      {
        find: "@/lib/supabase/client",
        replacement: path.resolve(
          __dirname,
          "./src/test/mocks/supabase-client.ts",
        ),
      },
      {
        find: "@/lib/openai",
        replacement: path.resolve(__dirname, "./src/test/mocks/openai.ts"),
      },
      {
        find: "@/lib/groq",
        replacement: path.resolve(__dirname, "./src/test/mocks/groq.ts"),
      },
      {
        find: "@/lib/redis",
        replacement: path.resolve(__dirname, "./src/test/mocks/redis.ts"),
      },
      {
        find: "@/lib/logger",
        replacement: path.resolve(__dirname, "./src/test/mocks/logger.ts"),
      },
      // Generic @ alias last
      { find: "@", replacement: path.resolve(__dirname, "./src") },
    ],
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    exclude: [
      "node_modules",
      "e2e/**",
      "dist/**",
      ".next/**",
      "src/components/",
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/test/**",
        "src/**/*.test.{ts,tsx}",
        "src/generated/**",
        "src/app/**/page.tsx",
        "src/app/**/layout.tsx",
        "src/app/**/loading.tsx",
        "src/components/**",
        'src/types/**'
      ],
    },
  },
});
