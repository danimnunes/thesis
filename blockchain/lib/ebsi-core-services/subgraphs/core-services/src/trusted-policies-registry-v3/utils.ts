import { log } from "@graphprotocol/graph-ts";

import { Policy, PolicyById } from "../../generated/schema";

// eslint-disable-next-line perfectionist/sort-union-types
export function loadPolicyById(id: string): Policy | null {
  const policyById = PolicyById.load(id);

  if (!policyById) {
    log.error("Policy with ID {} not found", [id]);
    return null;
  }

  const policy = Policy.load(policyById.policy);

  if (!policy) {
    log.error("Policy with name {} not found", [policyById.policy]);
    return null;
  }

  return policy;
}
