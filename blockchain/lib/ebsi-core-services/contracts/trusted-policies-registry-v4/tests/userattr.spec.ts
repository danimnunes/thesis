import { ethers, upgrades } from "hardhat";

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

  before(async () => {
    const policyRegistryFactory = await ethers.getContractFactory(
      "PolicyRegistry",
      {},
    );
    policyContract = await upgrades.deployProxy(policyRegistryFactory, [], {
      kind: "uups",
    });

    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    expect(await policyContract.getAddress()).to.properAddress;

    await policyContract.insertPolicy("test policy 2", "registry 2");
    for (const name of userAttr) {
      await policyContract.insertPolicy(name, `policy ${name}`);
    }
    await policyContract.insertPolicy("attrX", "policy attrX");
    [user, user2, user3] = await ethers.getSigners();

    await policyContract.insertUserAttributes(user.address, userAttr);

    // Create user3 with two attributes then remove one (so user3 stays in registry with one attribute)
    await policyContract.insertUserAttributes(user3.address, [
      "attr1",
      "attr2",
    ]);
    await policyContract.deleteUserAttributes(user3.address, ["attr1"]);
  });

  beforeEach(async () => {
    snapshotId = (await ethers.provider.send("evm_snapshot", [])) as string;
  });

  afterEach(async () => {
    await ethers.provider.send("evm_revert", [snapshotId]);
  });

  describe("insertUserAttributes", () => {
    it("should fail if user does not have OPERATOR_ROLE", async () => {
      const OPERATOR_ROLE =
        "0x97667070c54ef182b0f5858b034beac1b6f3089aa2d3188bb1e8929f4fa9b929";
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
      ).to.be.revertedWithCustomError(policyContract, "InvalidUserAddress");
    });

    it("should not revert for empty attributes list", async () => {
      await expect(policyContract.insertUserAttributes(user.address, [])).to.not
        .be.reverted;
    });

    it("should fail for attribute empty string", async () => {
      await expect(
        policyContract.insertUserAttributes(user.address, ["", "test"]),
      ).to.be.revertedWithCustomError(policyContract, "AttributeEmpty");
    });

    it("should not revert when attribute already added (idempotent)", async () => {
      await expect(policyContract.insertUserAttributes(user.address, ["attr1"]))
        .to.not.be.reverted;
    });

    it("should insert attribute", async () => {
      await expect(policyContract.insertUserAttributes(user.address, ["attrX"]))
        .to.emit(policyContract, "UserAttributeInserted")
        .withArgs(user.address, "attrX", ethers.ZeroAddress);
      const userAttributes = await policyContract.getUserAttributes(
        user.address,
        1,
        10,
      );
      expect(userAttributes.items).to.have.length(6);
    });
  });

  describe("deleteUserAttributes", () => {
    it("should fail if user does not have OPERATOR_ROLE", async () => {
      const OPERATOR_ROLE =
        "0x97667070c54ef182b0f5858b034beac1b6f3089aa2d3188bb1e8929f4fa9b929";
      await expect(
        policyContract
          .connect(user2)
          .deleteUserAttributes(user2.address, ["attr"]),
      )
        .to.be.revertedWithCustomError(
          policyContract,
          "AccessControlUnauthorizedAccount",
        )
        .withArgs(user2.address, OPERATOR_ROLE);
    });

    it("should fail for invalid user address", async () => {
      await expect(
        policyContract.deleteUserAttributes(ethers.ZeroAddress, ["attr1"]),
      ).to.be.revertedWithCustomError(policyContract, "InvalidUserAddress");
    });

    it("should not revert for empty attributes list", async () => {
      await expect(policyContract.deleteUserAttributes(user.address, [])).to.not
        .be.reverted;
    });

    it("should fail for empty/missing attribute", async () => {
      await expect(
        policyContract.deleteUserAttributes(user.address, ["attr1111"]),
      ).to.be.revertedWithCustomError(policyContract, "AttrInvalid");

      await expect(
        policyContract.deleteUserAttributes(user.address, [""]),
      ).to.be.revertedWithCustomError(policyContract, "AttrInvalid");
    });

    it("should delete user attribute", async () => {
      await expect(policyContract.deleteUserAttributes(user.address, ["attr3"]))
        .to.emit(policyContract, "UserAttributeDeleted")
        .withArgs(user.address, "attr3", ethers.ZeroAddress);

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
      await expect(policyContract.getUsers(1, 0)).to.be.revertedWithCustomError(
        policyContract,
        "PageSizeZero",
      );

      await expect(
        policyContract.getUsers(1, 51),
      ).to.be.revertedWithCustomError(policyContract, "PageSizeTooLarge");
    });

    it("should fail for invalid page", async () => {
      await expect(policyContract.getUsers(0, 1)).to.be.revertedWithCustomError(
        policyContract,
        "PageZero",
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
      ).to.be.revertedWithCustomError(policyContract, "PageSizeZero");

      await expect(
        policyContract.getUserAttributes(user.address, 1, 51),
      ).to.be.revertedWithCustomError(policyContract, "PageSizeTooLarge");
    });

    it("should fail for invalid page", async () => {
      await expect(
        policyContract.getUserAttributes(user.address, 0, 1),
      ).to.be.revertedWithCustomError(policyContract, "PageZero");
    });

    it("should fail for missing user", async () => {
      await expect(
        policyContract.getUserAttributes(user2.address, 1, 1),
      ).to.be.revertedWithCustomError(policyContract, "UserDoesNotExist");

      await expect(
        policyContract.getUserAttributes(ethers.ZeroAddress, 1, 1),
      ).to.be.revertedWithCustomError(policyContract, "InvalidUserAddress");

      // user3 exists and has attributes; use a 4th signer with no attributes to get "user does not exist"
      const noAttrUser = (await ethers.getSigners())[3];
      await expect(
        policyContract.getUserAttributes(noAttrUser.address, 1, 1),
      ).to.be.revertedWithCustomError(policyContract, "UserDoesNotExist");
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
      ).to.be.revertedWithCustomError(
        policyContract,
        "PolicyInactiveOrNotDefined",
      );
    });
  });
});
