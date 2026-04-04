import { Address, BigInt, Bytes } from "@graphprotocol/graph-ts";
import {
  afterAll,
  assert,
  beforeAll,
  clearStore,
  describe,
  test,
} from "matchstick-as";

import {
  handlePolicyActivated,
  handlePolicyDeactivated,
  handlePolicyInserted,
  handlePolicyUpdated,
  handleUserAttributeDeleted,
  handleUserAttributeInserted,
} from "../src/trusted-policies-registry-v3/mappings";
import {
  createPolicyActivatedEvent,
  createPolicyDeactivatedEvent,
  createPolicyInsertedEvent,
  createPolicyUpdatedEvent,
  createUserAttributeDeletedEvent,
  createUserAttributeInsertedEvent,
} from "./trusted-policies-registry.utils";

describe("Trusted Policies Registry - entity assertions", () => {
  const policyId = "1";
  const policyName = "TIR:setAttributeMetadata";
  const user = "0x6309baa4eed7daed1db2b32cadabe3fe558c5ff3";

  beforeAll(() => {
    const event = createPolicyInsertedEvent(
      BigInt.fromString(policyId),
      policyName,
      "description TIR",
    );

    handlePolicyInserted(event);
  });

  afterAll(() => {
    clearStore();
  });

  test("Insert policy", () => {
    assert.entityCount("Policy", 1);
    assert.fieldEquals("Policy", policyName, "policyId", policyId);
    assert.fieldEquals("Policy", policyName, "description", "description TIR");
    assert.fieldEquals("Policy", policyName, "status", "true");

    assert.entityCount("PolicyById", 1);
    assert.fieldEquals("PolicyById", policyId, "policy", policyName);
  });

  test("Update policy", () => {
    const event = createPolicyUpdatedEvent(
      BigInt.fromString(policyId),
      "description TIR",
      "new description",
    );
    handlePolicyUpdated(event);

    assert.entityCount("Policy", 1);
    assert.fieldEquals("Policy", policyName, "description", "new description");
    assert.entityCount("PolicyById", 1);
  });

  test("Activate policy", () => {
    const event = createPolicyActivatedEvent(BigInt.fromString(policyId));
    handlePolicyActivated(event);

    assert.entityCount("Policy", 1);
    assert.fieldEquals("Policy", policyName, "status", "true");
    assert.entityCount("PolicyById", 1);
  });

  test("Deactivate policy", () => {
    const event = createPolicyDeactivatedEvent(BigInt.fromString(policyId));
    handlePolicyDeactivated(event);

    assert.entityCount("Policy", 1);
    assert.fieldEquals("Policy", policyName, "status", "false");
    assert.entityCount("PolicyById", 1);
  });

  test("Insert user attribute", () => {
    const userAddress = new Address(20);
    userAddress.set(Bytes.fromByteArray(Bytes.fromHexString(user)));
    let event = createUserAttributeInsertedEvent(userAddress, policyName);
    handleUserAttributeInserted(event);

    assert.entityCount("PolicySubject", 1);
    assert.fieldEquals(
      "PolicySubject",
      user,
      "attributes",
      "[TIR:setAttributeMetadata]",
    );

    event = createUserAttributeInsertedEvent(userAddress, "TSR:insertSchema");
    handleUserAttributeInserted(event);

    assert.entityCount("PolicySubject", 1);
    assert.fieldEquals(
      "PolicySubject",
      user,
      "attributes",
      "[TIR:setAttributeMetadata, TSR:insertSchema]",
    );
  });

  test("Delete user attribute", () => {
    const userAddress = new Address(20);
    userAddress.set(Bytes.fromByteArray(Bytes.fromHexString(user)));
    let event = createUserAttributeDeletedEvent(userAddress, policyName);
    handleUserAttributeDeleted(event);

    assert.entityCount("PolicySubject", 1);
    assert.fieldEquals(
      "PolicySubject",
      user,
      "attributes",
      "[TSR:insertSchema]",
    );

    event = createUserAttributeDeletedEvent(userAddress, "TSR:insertSchema");
    handleUserAttributeDeleted(event);

    assert.entityCount("PolicySubject", 1);
    assert.fieldEquals("PolicySubject", user, "attributes", "[]");
  });
});
