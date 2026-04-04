import type { EbsiEnvConfiguration } from "@europeum-ebsi/verifiable-credential";
import type { AxiosResponse } from "axios";

import axios, { isAxiosError } from "axios";
import validator from "validator";

import {
  checkVcdm11BitstringStatusListCredential,
  checkVcdm20BitstringStatusListCredential,
} from "./isBitstringStatusListCredential.ts";
import { checkStatusList2021Credential } from "./isStatusList2021Credential.ts";

const validators = validator.default;

const allowedRequestHeaders = new Set(
  [
    /**
     * Authentication
     * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers#authentication
     */
    "Authorization",
    /**
     * Caching
     * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers#caching
     */
    "Cache-Control",
  ].map((i) => i.toLowerCase()),
);

export async function isIssuerProxy(
  value: string,
  ebsiEnvConfig: EbsiEnvConfiguration,
  reqId: string,
  timeout: number,
): Promise<{ error: string; success: false } | { success: true }> {
  let proxyAsObject: unknown;

  try {
    proxyAsObject = JSON.parse(value);
  } catch {
    return { error: "Not a JSON object", success: false };
  }

  if (!proxyAsObject || typeof proxyAsObject !== "object") {
    return { error: "Proxy must be an object", success: false };
  }

  const { headers, prefix, testSuffix } = proxyAsObject as Record<
    string,
    unknown
  >;

  // Validate prefix
  if (!prefix || typeof prefix !== "string") {
    return { error: "Missing prefix", success: false };
  }

  if (
    // Only allow URLs with https protocol and without query components or fragments
    !validators.isURL(prefix, {
      allow_fragments: false,
      allow_query_components: false,
      protocols: ["https"],
      require_protocol: true,
    })
  ) {
    return {
      error:
        "Invalid prefix: it must be a valid URL starting with https:// and without query components or fragments",
      success: false,
    };
  }

  // Validate headers
  if (!headers || typeof headers !== "object") {
    return { error: "Missing headers", success: false };
  }

  if (
    Object.values(headers).some(
      (val) =>
        typeof val !== "string" &&
        typeof val !== "number" &&
        typeof val !== "boolean",
    )
  ) {
    return {
      error: "Some headers contain invalid values",
      success: false,
    };
  }

  const invalidHeaders = Object.keys(headers).filter(
    (key) => !allowedRequestHeaders.has(key.toLowerCase()),
  );
  if (invalidHeaders.length > 0) {
    return {
      error: `The following headers are not allowed: "${invalidHeaders.join('", "')}"`,
      success: false,
    };
  }

  // Validate prefix + testSuffix
  if (!testSuffix || typeof testSuffix !== "string") {
    return {
      error: "Missing testSuffix",
      success: false,
    };
  }

  if (
    !validators.isURL(prefix + testSuffix, {
      allow_fragments: false, // do not allow fragments in testSuffix
      allow_query_components: true, // allow query components in testSuffix
      protocols: ["https"],
      require_protocol: true,
    })
  ) {
    return {
      error: "Invalid testSuffix",
      success: false,
    };
  }

  let testResponse: AxiosResponse;
  try {
    // Check if prefix+testSuffix returns a valid StatusList2021Credential
    // https://w3c-ccg.github.io/vc-status-list-2021/#statuslist2021credential
    testResponse = await axios.get(prefix + testSuffix, {
      headers,
      timeout,
    });
  } catch (error) {
    return {
      error: `Error while loading ${prefix + testSuffix}${isAxiosError(error) ? `: ${error.message}` : ""}`,
      success: false,
    };
  }

  if (testResponse.status !== 200) {
    return {
      error: `Error while loading ${
        prefix + testSuffix
      }: response status must be 200`,
      success: false,
    };
  }

  let res = await checkStatusList2021Credential(
    testResponse.data,
    ebsiEnvConfig,
    reqId,
    {
      timeout,
    },
  );

  if (res.success) return res;

  res = await checkVcdm11BitstringStatusListCredential(
    testResponse.data,
    ebsiEnvConfig,
    reqId,
    {
      timeout,
    },
  );

  if (res.success) return res;

  return await checkVcdm20BitstringStatusListCredential(
    testResponse.data,
    ebsiEnvConfig,
    reqId,
    {
      timeout,
    },
  );
}
