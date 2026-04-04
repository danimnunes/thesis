import { Policy, PolicyById, PolicySubject } from "../../generated/schema";
import {
  PolicyActivated,
  PolicyDeactivated,
  PolicyInserted,
  PolicyUpdated,
  UserAttributeDeleted,
  UserAttributeInserted,
} from "../../generated/TrustedPoliciesRegistry/TrustedPoliciesRegistry";
import { loadPolicyById } from "./utils";

export function handlePolicyActivated(event: PolicyActivated): void {
  const policy = loadPolicyById(event.params.policyId.toString());
  if (!policy) return;
  policy.status = true;
  policy.save();
}

export function handlePolicyDeactivated(event: PolicyDeactivated): void {
  const policy = loadPolicyById(event.params.policyId.toString());
  if (!policy) return;
  policy.status = false;
  policy.save();
}

export function handlePolicyInserted(event: PolicyInserted): void {
  const policy = new Policy(event.params.policyName);

  policy.policyId = event.params.policyId.toString();
  policy.description = event.params.description;
  policy.status = true;

  policy.save();

  // Create "PolicyById" entity for ID-based access
  const policyById = new PolicyById(event.params.policyId.toString());
  policyById.policy = policy.id;
  policyById.save();
}

export function handlePolicyUpdated(event: PolicyUpdated): void {
  const policy = loadPolicyById(event.params.policyId.toString());
  if (!policy) return;
  policy.description = event.params.newDescription;
  policy.save();
}

export function handleUserAttributeDeleted(event: UserAttributeDeleted): void {
  const user = PolicySubject.load(event.params.user);
  if (!user) return;
  const attributes: string[] = user.attributes;
  for (let i = 0; i < attributes.length; i += 1) {
    if (attributes[i] == event.params.attribute) {
      attributes.splice(i, 1);
      break;
    }
  }
  user.attributes = attributes;
  user.save();
}

export function handleUserAttributeInserted(
  event: UserAttributeInserted,
): void {
  let user = PolicySubject.load(event.params.user);
  let attributes: string[] = [];
  if (user) {
    attributes = user.attributes;
  } else {
    user = new PolicySubject(event.params.user);
  }
  attributes.push(event.params.attribute);
  user.attributes = attributes;
  user.save();
}
