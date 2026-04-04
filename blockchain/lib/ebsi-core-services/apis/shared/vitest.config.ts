import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      exclude: ["src/main.ts", "src/**/*.d.ts"],
      include: ["src"],
      reporter: ["text", "lcov"],
      reportsDirectory: "./coverage",
      thresholds: {
        branches: 80,
        functions: 65,
        lines: 70,
        statements: 70,
      },
    },
    environment: "node",
    fileParallelism: false,
    include: ["src/**/?(*.|*-)+(spec|test).ts"],
  },
});
