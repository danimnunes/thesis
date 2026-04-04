import { Address, BigInt, ethereum } from "@graphprotocol/graph-ts";
import { newMockEvent } from "matchstick-as";

import {
  PolicyActivated,
  PolicyDeactivated,
  PolicyInserted,
  PolicyUpdated,
  UserAttributeDeleted,
  UserAttributeInserted,
} from "../generated/TrustedPoliciesRegistry/TrustedPoliciesRegistry";

export function createPolicyActivatedEvent(policyId: BigInt): PolicyActivated {
  const event = changetype<PolicyActivated>(newMockEvent());
  event.parameters = [];
  event.parameters.push(
    new ethereum.EventParam(
      "policyId",
      ethereum.Value.fromUnsignedBigInt(policyId),
    ),
  );
  return event;
}

export function createPolicyDeactivatedEvent(
  policyId: BigInt,
): PolicyDeactivated {
  const event = changetype<PolicyDeactivated>(newMockEvent());
  event.parameters = [];
  event.parameters.push(
    new ethereum.EventParam(
      "policyId",
      ethereum.Value.fromUnsignedBigInt(policyId),
    ),
  );
  return event;
}

export function createPolicyInsertedEvent(
  policyId: BigInt,
  policyName: string,
  description: string,
): PolicyInserted {
  const event = changetype<PolicyInserted>(newMockEvent());
  event.parameters = [];
  event.parameters.push(
    new ethereum.EventParam(
      "policyId",
      ethereum.Value.fromUnsignedBigInt(policyId),
    ),
  );
  event.parameters.push(
    new ethereum.EventParam(
      "policyName",
      ethereum.Value.fromString(policyName),
    ),
  );
  event.parameters.push(
    new ethereum.EventParam(
      "description",
      ethereum.Value.fromString(description),
    ),
  );
  return event;
}

export function createPolicyUpdatedEvent(
  policyId: BigInt,
  oldDescription: string,
  newDescription: string,
): PolicyUpdated {
  const event = changetype<PolicyUpdated>(newMockEvent());
  event.parameters = [];
  event.parameters.push(
    new ethereum.EventParam(
      "policyId",
      ethereum.Value.fromUnsignedBigInt(policyId),
    ),
  );
  event.parameters.push(
    new ethereum.EventParam(
      "oldDescription",
      ethereum.Value.fromString(oldDescription),
    ),
  );
  event.parameters.push(
    new ethereum.EventParam(
      "newDescription",
      ethereum.Value.fromString(newDescription),
    ),
  );
  return event;
}

export function createUserAttributeDeletedEvent(
  user: Address,
  attribute: string,
): UserAttributeDeleted {
  const event = changetype<UserAttributeDeleted>(newMockEvent());
  event.parameters = [];
  event.parameters.push(
    new ethereum.EventParam("user", ethereum.Value.fromAddress(user)),
  );
  event.parameters.push(
    new ethereum.EventParam("attribute", ethereum.Value.fromString(attribute)),
  );
  return event;
}

export function createUserAttributeInsertedEvent(
  user: Address,
  attribute: string,
): UserAttributeInserted {
  const event = changetype<UserAttributeInserted>(newMockEvent());
  event.parameters = [];
  event.parameters.push(
    new ethereum.EventParam("user", ethereum.Value.fromAddress(user)),
  );
  event.parameters.push(
    new ethereum.EventParam("attribute", ethereum.Value.fromString(attribute)),
  );
  return event;
}
