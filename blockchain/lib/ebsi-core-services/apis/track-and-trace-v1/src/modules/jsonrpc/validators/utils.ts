import type { RefinementCtx } from "zod";

import { isDid } from "@ebsiint-api/shared";
import validator from "validator";
import { z } from "zod";

import { hexToDid } from "../../../shared/utils.ts";

const validators = validator.default;

function isHexadecimal(
  value: string,
): { error: string; success: false } | { success: true } {
  if (!value.startsWith("0x")) {
    return {
      error: "Must start with 0x",
      success: false,
    };
  }

  if (!validators.isHexadecimal(value)) {
    return {
      error: "Must be hexadecimal",
      success: false,
    };
  }

  return { success: true };
}

function isSender(value: string) {
  if (!value.startsWith("0x")) {
    return {
      error: "Must start with 0x",
      success: false,
    };
  }

  if (!validators.isHexadecimal(value)) {
    return {
      error: "Must be hexadecimal",
      success: false,
    };
  }

  let did: string;

  try {
    did = hexToDid(value);
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "unknown error",
      success: false,
    };
  }

  return isDid(did);
}

export const refinements = {
  isHexadecimal: (val: string, ctx: RefinementCtx) => {
    const isValid = isHexadecimal(val);

    if (!isValid.success) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        fatal: true,
        message: isValid.error,
      });
    }
  },
  isSender: (val: string, ctx: RefinementCtx) => {
    const isValid = isSender(val);

    if (!isValid.success) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        fatal: true,
        message: isValid.error,
      });
    }
  },
};
