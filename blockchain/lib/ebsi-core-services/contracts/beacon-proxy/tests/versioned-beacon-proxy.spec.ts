import { ethers } from "hardhat";

import type { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

import { expect } from "chai";

import type {
  MockImplementation,
  VersionedBeaconProxy,
  VersionedUpgradeableBeacon,
} from "../src/types/index.ts";

describe("VersionedUpgradeableBeacon and VersionedBeaconProxy", function () {
  let beacon: VersionedUpgradeableBeacon;
  let proxy: VersionedBeaconProxy;
  let implV1: MockImplementation;
  let implV2: MockImplementation;
  let implV3: MockImplementation;
  let owner: HardhatEthersSigner;
  let other: HardhatEthersSigner;

  /** Call versioned beacon's implementation(version) to avoid overload ambiguity with implementation(). */
  function beaconImplementationAt(version: bigint | number) {
    return beacon.getFunction("implementation(uint64)")(BigInt(version));
  }

  before(async function () {
    const signers = await ethers.getSigners();
    owner = signers[0];
    other = signers[1];
  });

  it("Should deploy VersionedUpgradeableBeacon with initial version 1", async function () {
    const MockImplementation =
      await ethers.getContractFactory("MockImplementation");
    implV1 = await MockImplementation.deploy();
    await implV1.waitForDeployment();

    const VersionedUpgradeableBeacon = await ethers.getContractFactory(
      "VersionedUpgradeableBeacon",
    );
    beacon = await VersionedUpgradeableBeacon.deploy(
      await implV1.getAddress(),
      owner.address,
    );
    await beacon.waitForDeployment();

    expect(await beacon.latestVersion()).to.equal(1n);
    expect(await beaconImplementationAt(1)).to.equal(await implV1.getAddress());
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    expect(await beacon.isVersionAvailable(1)).to.be.true;
    const versions = await beacon.getVersions();
    expect(versions.length).to.equal(1);
    expect(versions[0]).to.equal(1n);
  });

  it("Should add version 2 and 3 (beacon admin)", async function () {
    const MockImplementation =
      await ethers.getContractFactory("MockImplementation");
    implV2 = await MockImplementation.deploy();
    await implV2.waitForDeployment();
    implV3 = await MockImplementation.deploy();
    await implV3.waitForDeployment();

    await beacon.addVersion(2, await implV2.getAddress());
    expect(await beacon.latestVersion()).to.equal(2n);
    expect(await beaconImplementationAt(2)).to.equal(await implV2.getAddress());
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    expect(await beacon.isVersionAvailable(2)).to.be.true;

    await beacon.addVersion(3, await implV3.getAddress());
    expect(await beacon.latestVersion()).to.equal(3n);
    expect(await beaconImplementationAt(3)).to.equal(await implV3.getAddress());

    const versions = await beacon.getVersions();
    expect(versions.length).to.equal(3);
    expect(versions).to.deep.equal([1n, 2n, 3n]);
  });

  it("Should deploy VersionedBeaconProxy at beacon latest version and initialize", async function () {
    const initData = ethers.AbiCoder.defaultAbiCoder().encode(
      ["string"],
      ["V1"],
    );
    const initSelector = ethers.id("initialize(string)").slice(0, 10);
    // eslint-disable-next-line unicorn/prefer-spread
    const finalInitData = ethers.concat([initSelector, initData]);

    const VersionedBeaconProxy = await ethers.getContractFactory(
      "VersionedBeaconProxy",
    );
    proxy = await VersionedBeaconProxy.deploy(
      await beacon.getAddress(),
      finalInitData,
    );
    await proxy.waitForDeployment();

    expect(await proxy.beacon()).to.equal(await beacon.getAddress());
    expect(await proxy.version()).to.equal(await beacon.latestVersion());
    expect(await proxy.proxyOwner()).to.equal(owner.address);

    const mockImpl = await ethers.getContractAt(
      "MockImplementation",
      await proxy.getAddress(),
    );
    expect(await mockImpl.name()).to.equal("V1");
  });

  it("Should not upgrade proxy when called by non-owner", async function () {
    await expect(
      proxy.connect(other).upgradeToVersion(2, "0x"),
    ).to.be.revertedWith("Proxy: caller is not the proxy owner");
  });

  it("Should upgrade proxy to version 2 (opt-in) when owner calls upgradeToVersion", async function () {
    const mockImplBefore = await ethers.getContractAt(
      "MockImplementation",
      await proxy.getAddress(),
    );
    expect(await mockImplBefore.name()).to.equal("V1");

    const fromVersion = await proxy.version();
    await expect(proxy.upgradeToVersion(2, "0x"))
      .to.emit(proxy, "ProxyUpgraded")
      .withArgs(fromVersion, 2n, await implV2.getAddress());

    expect(await proxy.version()).to.equal(2n);
    // Implementation changed; storage is per-implementation so name may still be "V1" from V1's storage
    // unless we re-initialize. For this mock we're just checking delegation switched to V2.
    const implAddr = await beaconImplementationAt(2);
    expect(implAddr).to.equal(await implV2.getAddress());
  });

  it("Should upgrade proxy to version 3", async function () {
    await proxy.upgradeToVersion(3, "0x");
    expect(await proxy.version()).to.equal(3n);
  });

  it("Should revert upgradeToVersion when version not available", async function () {
    await expect(
      proxy.upgradeToVersion(99, "0x"),
    ).to.be.revertedWithCustomError(proxy, "VersionNotAvailable");
  });

  it("Should deprecate version 2; isVersionAvailable(2) false", async function () {
    await beacon.deprecateVersion(2);
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    expect(await beacon.isVersionAvailable(2)).to.be.false;
    // Proxy on v3 is unaffected
    expect(await proxy.version()).to.equal(3n);
  });

  it("Should revert upgradeToVersion to deprecated version", async function () {
    // Deploy another proxy (starts at latest v3), try to upgrade to deprecated v2
    const initData = ethers.AbiCoder.defaultAbiCoder().encode(
      ["string"],
      ["Other"],
    );
    const initSelector = ethers.id("initialize(string)").slice(0, 10);
    const VersionedBeaconProxy = await ethers.getContractFactory(
      "VersionedBeaconProxy",
    );
    const proxy2 = await VersionedBeaconProxy.deploy(
      await beacon.getAddress(),
      // eslint-disable-next-line unicorn/prefer-spread
      ethers.concat([initSelector, initData]),
    );
    await proxy2.waitForDeployment();
    await expect(
      proxy2.connect(owner).upgradeToVersion(2, "0x"),
    ).to.be.revertedWithCustomError(proxy2, "VersionNotAvailable");
  });

  it("Should transfer proxy ownership and emit event", async function () {
    await expect(proxy.transferProxyOwnership(other.address))
      .to.emit(proxy, "ProxyOwnerChanged")
      .withArgs(owner.address, other.address);
    expect(await proxy.proxyOwner()).to.equal(other.address);
    await expect(
      proxy.connect(owner).upgradeToVersion(3, "0x"),
    ).to.be.revertedWith("Proxy: caller is not the proxy owner");
    await proxy.connect(other).upgradeToVersion(3, "0x");
    expect(await proxy.version()).to.equal(3n);
  });

  it("Should revert addVersion when version does not increase", async function () {
    const MockImplementation =
      await ethers.getContractFactory("MockImplementation");
    const impl = await MockImplementation.deploy();
    await impl.waitForDeployment();
    await expect(
      beacon.addVersion(3, await impl.getAddress()),
    ).to.be.revertedWithCustomError(beacon, "VersionMustIncrease");
  });
});
