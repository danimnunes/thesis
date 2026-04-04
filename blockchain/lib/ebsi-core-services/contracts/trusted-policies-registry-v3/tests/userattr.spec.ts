import { ethers } from "hardhat";

import type { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

import { expect } from "chai";

import { PolicyRegistry } from "../src/types";

describe("UserAttributesManagement", () => {
  let snapshotId: string;
  let policyContract: PolicyRegistry;
  let user: SignerWithAddress;
  let user2: SignerWithAddress;
  let user3: SignerWithAddress;

  const userAttr = ["attr1", "attr2", "attr3", "attr4", "attr5"];
  const OPERATOR_ROLE =
    "0x97667070c54ef182b0f5858b034beac1b6f3089aa2d3188bb1e8929f4fa9b929";

  before(async () => {
    const policyRegistryFactory = await ethers.getContractFactory(
      "PolicyRegistry",
      {},
    );
    policyContract = await policyRegistryFactory.deploy();

    await policyContract.initialize(10);
    expect(await policyContract.version()).to.equal(10);
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    expect(await policyContract.getAddress()).to.properAddress;

    await policyContract.insertPolicy("test policy 2", "registry 2");
    [user, user2, user3] = await ethers.getSigners();

    await policyContract.insertUserAttributes(user.address, userAttr);

    // Create a new user and remove its attribute
    await policyContract.insertUserAttributes(user3.address, ["attr1"]);
    await policyContract.deleteUserAttribute(user3.address, "attr1");
  });

  beforeEach(async () => {
    snapshotId = (await ethers.provider.send("evm_snapshot", [])) as string;
  });

  afterEach(async () => {
    await ethers.provider.send("evm_revert", [snapshotId]);
  });

  describe("insertUserAttributes", () => {
    it("should fail if user does not have OPERATOR_ROLE", async () => {
      await expect(
        policyContract
          .connect(user2)
          .insertUserAttributes(ethers.ZeroAddress, ["attr"]),
      )
        .to.be.revertedWithCustomError(
          policyContract,
          "AccessControlUnauthorizedAccount",
        )
        .withArgs(user2.address, OPERATOR_ROLE);
    });

    it("should fail for empty user", async () => {
      await expect(
        policyContract.insertUserAttributes(ethers.ZeroAddress, ["attr"]),
      ).to.be.revertedWith("Policy: invalid user address");
    });

    it("should fail for empty attributes list", async () => {
      await expect(
        policyContract.insertUserAttributes(user.address, []),
      ).to.be.revertedWith("Policy: invalid attr list");
    });

    it("should fail for attribute empty string", async () => {
      await expect(
        policyContract.insertUserAttributes(user.address, ["", "test"]),
      ).to.be.revertedWith("Attribute empty");
    });

    it("should fail for attribute already added", async () => {
      await expect(
        policyContract.insertUserAttributes(user.address, ["attr1"]),
      ).to.be.revertedWith("Attribute already defined");
    });

    it("should insert attribute", async () => {
      await expect(policyContract.insertUserAttributes(user.address, ["attrX"]))
        .to.emit(policyContract, "UserAttributeInserted")
        .withArgs(user.address, "attrX");
      const userAttributes = await policyContract.getUserAttributes(
        user.address,
        1,
        10,
      );
      expect(userAttributes.items).to.have.length(6);
    });
  });

  describe("deleteUserAttribute", () => {
    it("should fail if user does not have OPERATOR_ROLE", async () => {
      await expect(
        policyContract
          .connect(user2)
          .deleteUserAttribute(user2.address, "attr"),
      )
        .to.be.revertedWithCustomError(
          policyContract,
          "AccessControlUnauthorizedAccount",
        )
        .withArgs(user2.address, OPERATOR_ROLE);
    });

    it("should fail for invalid user address", async () => {
      await expect(
        policyContract.deleteUserAttribute(ethers.ZeroAddress, "attr1"),
      ).to.be.revertedWith("Policy: invalid user address");
    });

    it("should fail for empty/missing attribute", async () => {
      await expect(
        policyContract.deleteUserAttribute(user.address, "attr1111"),
      ).to.be.revertedWith("Policy: attr invalid");

      await expect(
        policyContract.deleteUserAttribute(user.address, ""),
      ).to.be.revertedWith("Policy: attr invalid");
    });

    it("should delete user attribute", async () => {
      await expect(policyContract.deleteUserAttribute(user.address, "attr3"))
        .to.emit(policyContract, "UserAttributeDeleted")
        .withArgs(user.address, "attr3");

      const userAttributes = await policyContract.getUserAttributes(
        user.address,
        1,
        10,
      );
      expect(userAttributes.items).to.deep.equal([
        "attr1",
        "attr2",
        "attr5",
        "attr4",
      ]);
    });
  });

  describe("getUsers", () => {
    it("should fail for invalid page size", async () => {
      await expect(policyContract.getUsers(1, 0)).to.be.revertedWith(
        "PSize not >0",
      );

      await expect(policyContract.getUsers(1, 51)).to.be.revertedWith(
        "PSize not <=50",
      );
    });

    it("should fail for invalid page", async () => {
      await expect(policyContract.getUsers(0, 1)).to.be.revertedWith(
        "Page not >0",
      );
    });

    it("should return user addresses", async () => {
      await policyContract.insertUserAttributes(user2.address, ["attr1"]);

      let result = await policyContract.getUsers(1, 1);
      expect(result.items).to.deep.equal([user.address]);
      expect(result.prev).to.equal(1);
      expect(result.next).to.equal(2);
      expect(result.total).to.equal(3);
      expect(result.howMany).to.equal(1);

      result = await policyContract.getUsers(2, 1);
      expect(result.items).to.deep.equal([user3.address]);
      expect(result.prev).to.equal(1);
      expect(result.next).to.equal(3);

      result = await policyContract.getUsers(3, 1);
      expect(result.items).to.deep.equal([user2.address]);
      expect(result.prev).to.equal(2);
      expect(result.next).to.equal(3);
    });
  });

  describe("getUserAttributes", () => {
    it("should fail for invalid page size", async () => {
      await expect(
        policyContract.getUserAttributes(user.address, 1, 0),
      ).to.be.revertedWith("PSize not >0");

      await expect(
        policyContract.getUserAttributes(user.address, 1, 51),
      ).to.be.revertedWith("PSize not <=50");
    });

    it("should fail for invalid page", async () => {
      await expect(
        policyContract.getUserAttributes(user.address, 0, 1),
      ).to.be.revertedWith("Page not >0");
    });

    it("should fail for missing user", async () => {
      await expect(
        policyContract.getUserAttributes(user2.address, 1, 1),
      ).to.be.revertedWith("Policy: user does not exist");

      await expect(
        policyContract.getUserAttributes(ethers.ZeroAddress, 1, 1),
      ).to.be.revertedWith("Policy: invalid user address");

      await expect(
        policyContract.getUserAttributes(user3.address, 1, 1),
      ).to.be.revertedWith("Policy: user has no attribute");
    });

    it("should return user attributes", async () => {
      let result = await policyContract.getUserAttributes(user.address, 1, 3);
      expect(result.items).to.deep.equal(["attr1", "attr2", "attr3"]);
      expect(result.next).to.equal(2);
      expect(result.prev).to.equal(1);
      expect(result.total).to.equal(5);

      result = await policyContract.getUserAttributes(user.address, 2, 3);
      expect(result.items).to.deep.equal(["attr4", "attr5"]);
      expect(result.next).to.equal(2);
      expect(result.prev).to.equal(1);
    });
  });

  describe("isUserAttribute", () => {
    it("should fail for missing user", async () => {
      await expect(
        policyContract.isUserAttribute(user2.address, "attr1"),
      ).to.be.revertedWith("Policy: user does not exist");

      await expect(
        policyContract.isUserAttribute(user3.address, "attr1"),
      ).to.be.revertedWith("Policy: user has no attribute");
    });

    it("should check if user has attribute", async () => {
      let result = await policyContract.isUserAttribute(user.address, "attr1");
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      expect(result).to.be.true;

      result = await policyContract.isUserAttribute(
        user.address,
        "bad-attribute",
      );
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      expect(result).to.be.false;
    });
  });

  describe("PolicyEngine", () => {
    it("should check user has access", async () => {
      await policyContract.insertPolicy(
        "test-policy-against-user",
        "check policy engine test",
      );

      await policyContract.insertUserAttributes(user.address, [
        "test-policy-against-user",
      ]);
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      expect(
        await policyContract["checkPolicy(uint256,address)"](2, user.address),
      ).to.be.true;
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      expect(
        await policyContract["checkPolicy(uint256,address)"](2, user2.address),
      ).to.be.false;
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      expect(
        await policyContract["checkPolicy(string,address)"](
          "test-policy-against-user",
          user.address,
        ),
      ).to.be.true;
      await expect(
        policyContract["checkPolicy(uint256,address)"](222, user2.address),
      ).to.be.revertedWith("Policy: inactive or not defined");
    });
  });
});
