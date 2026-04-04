import { ethers, upgrades } from "hardhat";

import type { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

import { expect } from "chai";

import type {
  MockVersionedBeaconProxy,
  MockVersionedBeaconProxy__factory,
  PolicyRegistry,
} from "../src/types";

describe("Scoped delegation (operator or proxy owner)", () => {
  let snapshotId: string;
  let policyContract: PolicyRegistry;
  let mockProxy: MockVersionedBeaconProxy;
  let proxyOwner: SignerWithAddress;
  let stranger: SignerWithAddress;
  let mockProxyAddress: string;

  const policyName = "scoped-policy";

  before(async () => {
    const signers = await ethers.getSigners();
    proxyOwner = signers[1];
    stranger = signers[2];

    const policyRegistryFactory = await ethers.getContractFactory(
      "PolicyRegistry",
      {},
    );
    policyContract = await upgrades.deployProxy(policyRegistryFactory, [], {
      kind: "uups",
    });

    const mockFactory: MockVersionedBeaconProxy__factory =
      await ethers.getContractFactory("MockVersionedBeaconProxy", {});
    mockProxy = await mockFactory.deploy(proxyOwner.address);
    await mockProxy.waitForDeployment();
    mockProxyAddress = await mockProxy.getAddress();

    await policyContract.insertPolicy(policyName, "Scoped policy for tests");
  });

  beforeEach(async () => {
    snapshotId = (await ethers.provider.send("evm_snapshot", [])) as string;
  });

  afterEach(async () => {
    await ethers.provider.send("evm_revert", [snapshotId]);
  });

  describe("insertScopedUserAttributes", () => {
    it("OPERATOR can insert scoped attributes for any target", async () => {
      await expect(
        policyContract.insertScopedUserAttributes(
          stranger.address,
          [policyName],
          mockProxyAddress,
        ),
      )
        .to.emit(policyContract, "UserAttributeInserted")
        .withArgs(stranger.address, policyName, mockProxyAddress);
    });

    it("proxy owner can insert scoped attributes for their proxy", async () => {
      await expect(
        policyContract
          .connect(proxyOwner)
          .insertScopedUserAttributes(
            stranger.address,
            [policyName],
            mockProxyAddress,
          ),
      )
        .to.emit(policyContract, "UserAttributeInserted")
        .withArgs(stranger.address, policyName, mockProxyAddress);
    });

    it("reverts when non-operator and non-proxy-owner calls", async () => {
      await expect(
        policyContract
          .connect(stranger)
          .insertScopedUserAttributes(
            proxyOwner.address,
            [policyName],
            mockProxyAddress,
          ),
      ).to.be.revertedWithCustomError(policyContract, "NotOperatorOrOwner");
    });

    it("reverts when proxy owner tries global scope (address(0))", async () => {
      await expect(
        policyContract
          .connect(proxyOwner)
          .insertScopedUserAttributes(
            stranger.address,
            [policyName],
            ethers.ZeroAddress,
          ),
      ).to.be.revertedWithCustomError(policyContract, "NotOperatorOrOwner");
    });
  });

  describe("deleteScopedUserAttributes", () => {
    beforeEach(async () => {
      await policyContract
        .connect(proxyOwner)
        .insertScopedUserAttributes(
          stranger.address,
          [policyName],
          mockProxyAddress,
        );
    });

    it("OPERATOR can delete scoped attribute", async () => {
      await expect(
        policyContract.deleteScopedUserAttributes(
          stranger.address,
          [policyName],
          mockProxyAddress,
        ),
      )
        .to.emit(policyContract, "UserAttributeDeleted")
        .withArgs(stranger.address, policyName, mockProxyAddress);
    });

    it("proxy owner can delete scoped attribute for their proxy", async () => {
      await expect(
        policyContract
          .connect(proxyOwner)
          .deleteScopedUserAttributes(
            stranger.address,
            [policyName],
            mockProxyAddress,
          ),
      )
        .to.emit(policyContract, "UserAttributeDeleted")
        .withArgs(stranger.address, policyName, mockProxyAddress);
    });

    it("reverts when non-operator and non-proxy-owner deletes", async () => {
      await expect(
        policyContract
          .connect(stranger)
          .deleteScopedUserAttributes(
            stranger.address,
            [policyName],
            mockProxyAddress,
          ),
      ).to.be.revertedWithCustomError(policyContract, "NotOperatorOrOwner");
    });
  });

  describe("target without IVersionedBeaconProxy", () => {
    it("only OPERATOR can insert for a non-proxy contract address", async () => {
      const arbitraryAddress = stranger.address;

      await expect(
        policyContract.insertScopedUserAttributes(
          proxyOwner.address,
          [policyName],
          arbitraryAddress,
        ),
      )
        .to.emit(policyContract, "UserAttributeInserted")
        .withArgs(proxyOwner.address, policyName, arbitraryAddress);

      await expect(
        policyContract
          .connect(proxyOwner)
          .insertScopedUserAttributes(
            stranger.address,
            [policyName],
            arbitraryAddress,
          ),
      ).to.be.revertedWithCustomError(policyContract, "NotOperatorOrOwner");
    });
  });
});
