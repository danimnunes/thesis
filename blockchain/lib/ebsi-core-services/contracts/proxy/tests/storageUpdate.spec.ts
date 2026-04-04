import { ethers } from "hardhat";

import type { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

import { assert, expect } from "chai";

import type {
  OwnedUpgradeabilityProxy,
  Tir,
  TirV1,
  TirV2,
  TirV2Breaking,
} from "../src/types";

const initializeData = async (pauser: SignerWithAddress) => {
  const tirFactory = await ethers.getContractFactory("Tir");
  return tirFactory.interface.encodeFunctionData(
    "initialize(uint256,address[])",
    ["1", [pauser.address]],
  );
};

const setupProxy = async (
  initializeDataString: string,
  proxyOwner: SignerWithAddress,
  proxyAdmin: SignerWithAddress,
) => {
  const proxyFactory = await ethers.getContractFactory(
    "OwnedUpgradeabilityProxy",
  );
  const proxy = (await proxyFactory
    .connect(proxyOwner)
    .deploy()) as OwnedUpgradeabilityProxy;
  await proxy.waitForDeployment();

  const implV0 = (await (
    await ethers.getContractFactory("Tir")
  ).deploy()) as Tir;
  const implV1 = (await (
    await ethers.getContractFactory("TirV1")
  ).deploy()) as TirV1;
  const implV2 = (await (
    await ethers.getContractFactory("TirV2")
  ).deploy()) as TirV2;
  const implV2Breaking = (await (
    await ethers.getContractFactory("TirV2Breaking")
  ).deploy()) as TirV2Breaking;

  const proxyAddress = await proxy.getAddress();
  const tir = (await ethers.getContractFactory("Tir")).attach(
    proxyAddress,
  ) as Tir;
  const tirV1 = (await ethers.getContractFactory("TirV1")).attach(
    proxyAddress,
  ) as TirV1;
  const tirV2 = (await ethers.getContractFactory("TirV2")).attach(
    proxyAddress,
  ) as TirV2;
  const tirV2Breaking = (
    await ethers.getContractFactory("TirV2Breaking")
  ).attach(proxyAddress) as TirV2Breaking;

  await proxy["initialize(address,address,bytes)"](
    await implV0.getAddress(),
    proxyAdmin.address,
    initializeDataString,
  );

  return {
    implV0,
    implV1,
    implV2,
    implV2Breaking,
    proxy,
    tir,
    tirV1,
    tirV2,
    tirV2Breaking,
  };
};

describe("upgrade and call new version struct", () => {
  it("works when new parameters has been added at the end of the struct", async () => {
    const [proxyOwner, proxyAdmin, anotherAccount, anchorOwner] =
      await ethers.getSigners();

    const { implV1, implV2, proxy, tir, tirV1, tirV2 } = await setupProxy(
      await initializeData(anchorOwner),
      proxyOwner,
      proxyAdmin,
    );

    const adm = await proxy.connect(proxyAdmin).admin.staticCall();

    assert.equal(adm, proxyAdmin.address);

    const v0 = await tir.version.call({ from: anotherAccount });
    const v1 = await tirV1.version.call({ from: anotherAccount });

    assert.deepStrictEqual(v0, v1);

    await proxy.connect(proxyAdmin).upgradeTo(await implV1.getAddress());

    const did = "did";

    await tir.connect(anotherAccount).pushDid(did);

    const dids = await tirV1.connect(anotherAccount).getDids();
    assert.deepStrictEqual(dids, ["did"]);

    await proxy.connect(proxyAdmin).upgradeTo(await implV2.getAddress());
    await tirV2.connect(anotherAccount).setMessage("1");
    await tirV2.connect(anotherAccount).getMessage();
    await tir.connect(anotherAccount).pushDid("did2");
    await tir.connect(anotherAccount).pushDid("did3");
    await tirV2.connect(anotherAccount).setMessage("2");
    await tirV2.connect(anotherAccount).setMessage("3");
    await tirV2.connect(anotherAccount).setMessage("4");
    await tirV2.connect(anotherAccount).setMessage("5");
    await tirV2.connect(anotherAccount).setMessage("6");
    await tirV2.connect(anotherAccount).setMessage("7");

    const count2 = await tirV2.connect(anotherAccount).getMessage();
    const dids2 = await tirV2.connect(anotherAccount).getDids2();

    assert.deepStrictEqual(dids2, ["did", "did2", "did3"]);
    assert.equal(count2.toString(), "7");

    await tirV2.connect(anotherAccount).pushDid("newDid");

    const newDids = await tirV2.connect(anotherAccount).getDids2();
    assert.deepStrictEqual(newDids, ["did", "did2", "did3", "newDid"]);
  });

  it("fails when new parameters has been added in the middle of the struct", async () => {
    const [proxyOwner, proxyAdmin, anotherAccount, anchorOwner] =
      await ethers.getSigners();
    const { implV1, implV2Breaking, proxy, tir, tirV1, tirV2Breaking } =
      await setupProxy(
        await initializeData(anchorOwner),
        proxyOwner,
        proxyAdmin,
      );

    const adm = await proxy.connect(proxyAdmin).admin.staticCall();

    assert.equal(adm, proxyAdmin.address);

    const v0 = await tir.version.call({ from: anotherAccount });
    const v1 = await tirV1.version.call({ from: anotherAccount });

    assert.deepStrictEqual(v0, v1);

    await proxy.connect(proxyAdmin).upgradeTo(await implV1.getAddress());

    const did = "did";
    await tir.connect(anotherAccount).pushDid(did);

    const firstDid = await tirV1.connect(anotherAccount).getDids();
    assert.deepStrictEqual(firstDid, ["did"]);

    await proxy
      .connect(proxyAdmin)
      .upgradeTo(await implV2Breaking.getAddress());

    const message = `incredibillylongmesagmesaggeincredibilylongmesaggeincredibilylongmesaggeincredibilylongmesaggeincredibilylongmesaggeincredibilylongmesaggeincredibilylongmesaggesincredibilylongmesaggeincredibilylongmesaggeincredibilylongmesaggeincredibilylongmesaggeincredibilylongmesaggeincredibilylongmesaggeincredibilylongmesaggeincredibilylongmesaggeincredibilylongmesaggeincredibilylongmesaggeincredibilylongmesaggeincredibilylongmesaggeincredibilylongmesaggeincredibilylongmesaggeincredibilylongmesaggesincredibilylongmesaggeincredibilylongmesaggeincredibilylongmesaggeincredibilylongmesaggeincredibilylongmesaggeincredibilylongmesaggeincredibilylongmesaggeincredibilylongmesaggeincredibilylongmesaggeincredibilylongmesaggeincredibilylongmesaggeincredibilylongmesaggeincredibilylongmesaggeincredibilylongmesaggeincredibilylongmesaggesincredibilylongmesaggeincredibilylongmesaggeincredibilylongmesaggeincredibilylongmesaggeincredibilylongmesaggeincredibilylongmesaggeincredibilylongmesaggeincredibilylongmesaggeincredibilylongmesaggeincredibilylongmesaggeincredibilylongmesaggeincredibilylongmesaggeincredibilylongmesaggeincredibilylongmesaggeincredibilylongmesaggesincredibilylongmesaggeincredibilylongmesaggeincredibilylongmesaggeincredibilylongmesaggeincredibilylongmesaggeincredibilylongmesaggeincredibilylongmesaggeincredibilylongmesaggeincredibilylongmesaggeincredibilylongmesaggeincredibilylongmesaggeincredibilylongmesaggeincredibilylongmesaggeincredibilylongmesaggeincredibilylongmesaggesincredibilylongmesaggeincredibilylongmesaggeincredibilylongmesaggeincredibilylongmesaggeincredibilylongmesaggeincredibilylongmesaggeincredibilylongmesaggeincredibilylongmesaggeincredibilylongmesaggeincredibilylongmesaggeincredibilylongmesaggeincredibilylongmesaggeincredibilylongmesaggeincredibilylongmesaggeincredibilylongmesaggesylongmesaggeincredibilylongmesaggeincredibilylongmesaggeincredibilylongmesaggeincredibilylongmesaggeincredibilylongmesaggeincredibilylongmesaggeincredibilylongmesagges`;
    await proxy.connect(proxyAdmin).implementation();

    await expect(tirV2Breaking.connect(anotherAccount).setMessage(message)).to
      .be.reverted;
    await expect(tirV2Breaking.connect(anotherAccount).getMessage()).to.be
      .reverted;

    const dids2 = await tirV2Breaking.connect(anotherAccount).getDids2();
    assert.deepStrictEqual(dids2, []);
    await tirV2Breaking.connect(anotherAccount).pushDid2("did2");
    const secondDid = await tirV1.connect(anotherAccount).getDids();
    assert.deepStrictEqual(firstDid, secondDid);
  });
});
