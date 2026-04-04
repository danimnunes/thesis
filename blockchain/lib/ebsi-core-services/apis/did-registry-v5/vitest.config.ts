import swc from "unplugin-swc";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    swc.vite(), // This is required to build the test files with SWC
  ],
  test: {
    coverage: {
      exclude: ["src/main.ts", "src/**/*.d.ts"],
      include: ["src"],
      reporter: ["text", "lcov"],
      reportsDirectory: "./coverage",
      thresholds: {
        branches: 80,
        functions: 80,
        lines: 80,
        statements: 80,
      },
    },
    environment: "node",
    fileParallelism: false,
    globalSetup: "./tests/globalSetup.unit.ts",
    include: ["src/**/?(*.|*-)+(spec|test).ts"],
    testTimeout: 30_000,
  },
});
