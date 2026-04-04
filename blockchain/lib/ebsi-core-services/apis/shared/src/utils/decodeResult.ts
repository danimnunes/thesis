import type { ethers } from "ethers";

export function decodeResult(result: ethers.Result): Record<string, unknown> {
  // Recursively fix the result object
  return fixObject(result.toObject(true));
}

function fixObject(result: Record<string, unknown>): Record<string, unknown> {
  const keys = Object.keys(result);

  const res: Record<string, unknown> = {};
  for (const key of keys) {
    const val = result[key];
    res[key] = fixValue(val);
  }

  return res;
}

function fixValue(val: unknown): unknown {
  if (typeof val !== "object" || val === null) {
    return val;
  }

  if (Array.isArray(val)) {
    return val.map((v) => fixValue(v));
  }

  // Replace empty objects with empty arrays
  if (Object.keys(val).length === 0) {
    return [];
  }

  // When ethers.js returns an object with only one key "_", it should be converted into a single-item array
  if (Object.keys(val).length === 1 && "_" in val) {
    return [fixValue(val._)];
  }

  return fixObject(val as Record<string, unknown>);
}
