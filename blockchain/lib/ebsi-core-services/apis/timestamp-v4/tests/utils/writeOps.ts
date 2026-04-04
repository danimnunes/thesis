import { describe, it } from "vitest";

export const describeWriteOps = () => {
  if (process.env.TEST_ENABLE_WRITE_OPS === "true") {
    return describe;
  }

  return describe.skip;
};

export const itWriteOps = () =>
  process.env.TEST_ENABLE_WRITE_OPS === "true" ? it : it.skip;

export const writeOps = () => process.env.TEST_ENABLE_WRITE_OPS === "true";
