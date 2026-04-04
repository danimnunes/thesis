import { ethers } from "hardhat";

import { assert, expect } from "chai";

import type { AnchorV1 } from "../src/types";

describe("anchorV1", () => {
  describe("initialize", () => {
    it("can not be initialized twice", async () => {
      const [proxyOwner, anchorOwner] = await ethers.getSigners();
      const anchorFactory = await ethers.getContractFactory("Anchor");
      const implV0 = await anchorFactory.deploy();
      await implV0.waitForDeployment();
      const proxyFactory = await ethers.getContractFactory(
        "OwnedUpgradeabilityProxy",
      );
      const proxy = await proxyFactory.connect(proxyOwner).deploy();
      await proxy.waitForDeployment();

      const fs: string[] = [];
      for (let i = 0; i < 32; i += 1) {
        fs.push(ethers.encodeBytes32String(`20160528${i}`));
      }

      const initializeData = implV0.interface.encodeFunctionData(
        "initialize(bytes32[],string,string,uint8,address[])",
        [fs, "chameauCoin", "DTC", 10, [anchorOwner.address]],
      );

      // Initialize proxy with token address and call initialize function 'inittoken' that replace the constructor
      await proxy["initialize(address,address,bytes)"](
        await implV0.getAddress(),
        proxyOwner.address,
        initializeData,
      );

      const anchorV1Factory = await ethers.getContractFactory("AnchorV1");
      const implV1 = await anchorV1Factory.deploy();
      await proxy.upgradeTo(await implV1.getAddress());

      const anchor = anchorV1Factory
        .attach(await proxy.getAddress())
        .connect(anchorOwner) as AnchorV1;

      await expect(
        anchor["initialize(bytes32[],string,string,uint8,address[])"](
          [
            ethers.encodeBytes32String("0"),
            ethers.encodeBytes32String("yolo"),
            ethers.encodeBytes32String("yeah"),
          ],
          "chameauCoin",
          "DTC",
          10,
          [anchorOwner.address],
        ),
      ).to.be.revertedWith("Initializable: contract is already initialized");
    });
  });

  describe("owner", () => {
    it("has an owner", async () => {
      const [proxyOwner, anchorOwner] = await ethers.getSigners();
      const anchorFactory = await ethers.getContractFactory("Anchor");
      const implV0 = await anchorFactory.deploy();
      await implV0.waitForDeployment();
      const proxyFactory = await ethers.getContractFactory(
        "OwnedUpgradeabilityProxy",
      );
      const proxy = await proxyFactory.connect(proxyOwner).deploy();
      await proxy.waitForDeployment();

      const fs: string[] = [];
      for (let i = 0; i < 32; i += 1) {
        fs.push(ethers.encodeBytes32String(`20160528${i}`));
      }

      const initializeData = implV0.interface.encodeFunctionData(
        "initialize(bytes32[],string,string,uint8,address[])",
        [fs, "chameauCoin", "DTC", 10, [anchorOwner.address]],
      );

      // Initialize proxy with token address and call initialize function 'inittoken' that replace the constructor
      await proxy["initialize(address,address,bytes)"](
        await implV0.getAddress(),
        proxyOwner.address,
        initializeData,
      );

      const anchorV1Factory = await ethers.getContractFactory("AnchorV1");
      const implV1 = await anchorV1Factory.deploy();
      await proxy.upgradeTo(await implV1.getAddress());

      const anchor = anchorV1Factory
        .attach(await proxy.getAddress())
        .connect(anchorOwner) as AnchorV1;

      const results: Promise<string>[] = [];
      for (let i = 0; i < 32; i += 1) {
        results.push(anchor.fields(i));
      }

      const res = await Promise.all(results);
      res.map((owner, i) =>
        assert.equal(ethers.decodeBytes32String(owner), `20160528${i}`),
      );
    });
  });

  describe("setRole", () => {
    it("get role", async () => {
      const [proxyOwner, anchorOwner, owner] = await ethers.getSigners();
      const anchorFactory = await ethers.getContractFactory("Anchor");
      const implV0 = await anchorFactory.deploy();
      await implV0.waitForDeployment();
      const proxyFactory = await ethers.getContractFactory(
        "OwnedUpgradeabilityProxy",
      );
      const proxy = await proxyFactory.connect(proxyOwner).deploy();
      await proxy.waitForDeployment();

      const fs: string[] = [];
      for (let i = 0; i < 32; i += 1) {
        fs.push(ethers.encodeBytes32String(`20160528${i}`));
      }

      const initializeData = implV0.interface.encodeFunctionData(
        "initialize(bytes32[],string,string,uint8,address[])",
        [fs, "chameauCoin", "DTC", 10, [anchorOwner.address]],
      );

      // Initialize proxy with token address and call initialize function 'inittoken' that replace the constructor
      await proxy["initialize(address,address,bytes)"](
        await implV0.getAddress(),
        proxyOwner.address,
        initializeData,
      );

      const anchorV1Factory = await ethers.getContractFactory("AnchorV1");
      const implV1 = await anchorV1Factory.deploy();
      await proxy.upgradeTo(await implV1.getAddress());

      const anchor = anchorV1Factory
        .attach(await proxy.getAddress())
        .connect(owner) as AnchorV1;

      const r: string[] = [];
      for (let i = 0; i < 32; i += 1) {
        r.push(ethers.encodeBytes32String(`yolo${i}`));
      }

      await anchor.setRole(r);
      const l = await anchor.getRole(0);
      for (let i = 0; i < 32; i += 1) {
        assert.equal(ethers.decodeBytes32String(l[i]), `yolo${i}`);
      }
    });
  });
});
