import type { JSONSchema } from "@apidevtools/json-schema-ref-parser";
import type { RefinementCtx } from "zod";

import {
  computeId,
  computeId__deprecated,
  prefixWith0x,
  remove0xPrefix,
} from "@ebsiint-api/shared";
import validator from "validator";
import { z } from "zod";

const validators = validator.default;

const validateSchemaId = async (
  hexJsonSchema: string,
  expectedSchemaId: string,
): Promise<{ error: string; success: false } | { success: true }> => {
  // 1. Hex JSON -> JSON
  const jsonSchema = JSON.parse(
    Buffer.from(remove0xPrefix(hexJsonSchema), "hex").toString("utf8"),
  ) as JSONSchema;

  // 2. Compute schema ID
  const schemaId = await computeId(jsonSchema);
  const schemaId__deprecated = await computeId__deprecated(jsonSchema, false);
  const schemaId__deprecated2 = await computeId__deprecated(jsonSchema, true);
  const actualSchemaId = prefixWith0x(schemaId.toString("hex"));

  // 3. Compare
  if (
    actualSchemaId !== expectedSchemaId &&
    prefixWith0x(schemaId__deprecated.toString("hex")) !== expectedSchemaId &&
    prefixWith0x(schemaId__deprecated2.toString("hex")) !== expectedSchemaId
  ) {
    return {
      error: `"${expectedSchemaId}" is different from the actual schema ID "${actualSchemaId}"`,
      success: false,
    };
  }

  return { success: true };
};

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

function isHexadecimalJSON(
  value: string,
): { error: string; success: false } | { success: true } {
  const isValidHexadecimal = isHexadecimal(value);

  if (!isValidHexadecimal.success) {
    return isValidHexadecimal;
  }

  // Length must be even
  if (value.length % 2 !== 0) {
    return {
      error: "Length must be even",
      success: false,
    };
  }

  if (
    !validators.isJSON(
      Buffer.from(remove0xPrefix(value), "hex").toString("utf8"),
    )
  ) {
    return {
      error: "Must be a JSON object encoded in hexadecimal",
      success: false,
    };
  }

  return { success: true };
}

export const refinements = {
  hasValidSchemaId: async (
    val: { schema: string; schemaId: string },
    ctx: RefinementCtx,
  ) => {
    const isValid = await validateSchemaId(val.schema, val.schemaId);
    if (!isValid.success) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: isValid.error,
        path: ["schemaId"],
      });
    }
  },
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
  isHexadecimalJSON: (val: string, ctx: RefinementCtx) => {
    const isValid = isHexadecimalJSON(val);

    if (!isValid.success) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        fatal: true,
        message: isValid.error,
      });
    }
  },
};
