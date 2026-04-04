import crypto from "node:crypto";

export function createPolicy(policyId: number, policyName: string) {
  const description = crypto.randomBytes(16).toString("hex");

  return {
    description,
    policyId,
    policyName,
    status: true,
  };
}
