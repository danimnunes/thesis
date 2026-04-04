import type { ValidationResult } from "./types.ts";

export function isBaseDocument(value: unknown): ValidationResult {
  if (typeof value !== "string" || value === "") {
    return {
      error: "baseDocument must be a stringified JSON document",
      success: false,
    };
  }

  let baseDocument: Record<string, unknown>;

  try {
    baseDocument = JSON.parse(value) as Record<string, unknown>;
  } catch {
    return {
      error: "baseDocument must be a stringified JSON document",
      success: false,
    };
  }

  const context = baseDocument["@context"];

  if (!context) {
    return {
      error: "'@context' attribute is missing",
      success: false,
    };
  }

  if (
    (typeof context !== "string" ||
      context !== "https://www.w3.org/ns/did/v1") &&
    (!Array.isArray(context) ||
      context.length === 0 ||
      context[0] !== "https://www.w3.org/ns/did/v1")
  ) {
    return {
      error:
        "'@context' attribute must be 'https://www.w3.org/ns/did/v1' or an array with 'https://www.w3.org/ns/did/v1' as first element",
      success: false,
    };
  }

  const keys = Object.keys(baseDocument);

  const restrictedKeys = [
    "id",
    "controller",
    "verificationMethod",
    "authentication",
    "assertionMethod",
    "keyAgreement",
    "capabilityInvocation",
    "capabilityDelegation",
  ];

  const includedRestrictedKeys = restrictedKeys.filter((key) =>
    keys.includes(key),
  );

  if (includedRestrictedKeys.length > 0) {
    return {
      error: `attribute${
        includedRestrictedKeys.length > 1 ? "s" : ""
      } '${includedRestrictedKeys.join("', '")}' ${
        includedRestrictedKeys.length > 1 ? "are" : "is"
      } not allowed`,
      success: false,
    };
  }

  return { success: true };
}
