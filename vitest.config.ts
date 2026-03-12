import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      enabled: true,
      include: ["src/**/*.ts"],
      exclude: ["src/config.ts", "src/run.ts"],
    },
  },
});
