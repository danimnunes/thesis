import swc from "unplugin-swc";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    swc.vite(), // This is required to build the test files with SWC
  ],
  test: {
    environment: "node",
    fileParallelism: false,
    hookTimeout: 30_000,
    include: ["tests/**/?(*.|*-)+(spec|test).ts"],
    testTimeout: 60_000,
  },
});
