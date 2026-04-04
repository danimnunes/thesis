import { config, ethers, network } from "hardhat";

import { expect } from "chai";

import type { DidRegistry, PolicyRegistryMock } from "../src/types";

import { testTprAddress } from "./testAddress";
import { decodeResult, rollArgs } from "./utils";

const MAX_CONTROLLERS = 10;

type AddVerificationMethodArgs = [string, string, string, boolean];
type AddVerificationRelationshipArgs = [string, string, string, number, number];
type InsertDidDocumentArgs = [
  string,
  string,
  string,
  string,
  boolean,
  number,
  number,
];

describe("Did Documents", () => {
  let reg: DidRegistry;
  let policyContractMock: PolicyRegistryMock;

  const acc = config.networks.hardhat.accounts as {
    mnemonic: string;
    path: string;
  };

  const hd = ethers.HDNodeWallet.fromMnemonic(
    ethers.Mnemonic.fromPhrase(acc.mnemonic),
    acc.path,
  );

  let user = hd.derivePath("1");
  let user2 = hd.derivePath("2");
  let user3 = hd.derivePath("3");

  const did = "did:ebsi:zpUnevx4dP2R2BvbjFEnnFF";
  const baseDocument =
    '{"@context":["https://www.w3.org/ns/did/v1","https://w3id.org/security/suites/jws-2020/v1"]}';
  const vMethodId = "H5RhB6vyFgl2Uizk8IjL_9AkB5mfqgn5ApgfHUbkqdQ";
  const notBefore = Math.floor(Date.now() / 1000);
  const notAfter = notBefore + 3600;

  before(async () => {
    const signers = await ethers.getSigners();
    const admin = signers[0];
    if (!admin.provider) throw new Error("provider not defined");
    user = user.connect(admin.provider);
    user2 = user2.connect(admin.provider);
    user3 = user3.connect(admin.provider);

    const policyRegistryFactory =
      await ethers.getContractFactory("PolicyRegistryMock");
    const tempPolicyContract = await policyRegistryFactory.deploy();

    const bytecodeTpr = await ethers.provider.getCode(
      await tempPolicyContract.getAddress(),
    );
    await network.provider.send("hardhat_setCode", [
      testTprAddress,
      bytecodeTpr,
    ]);

    policyContractMock = policyRegistryFactory.attach(
      testTprAddress,
    ) as PolicyRegistryMock;
  });

  beforeEach(async () => {
    const vRelationshipsFactory =
      await ethers.getContractFactory("VRelationshipsLib");
    const vRelationshipsLib = await vRelationshipsFactory.deploy();

    const didDocumentFactory = await ethers.getContractFactory(
      "DidDocumentLib",
      {
        libraries: {
          VRelationshipsLib: await vRelationshipsLib.getAddress(),
        },
      },
    );
    const didDocumentLib = await didDocumentFactory.deploy();

    const controllersFactory = await ethers.getContractFactory(
      "ControllersLib",
      {},
    );
    const controllersLib = await controllersFactory.deploy();

    const contractFactory = await ethers.getContractFactory("DidRegistry", {
      libraries: {
        ControllersLib: await controllersLib.getAddress(),
        DidDocumentLib: await didDocumentLib.getAddress(),
      },
    });

    reg = (await contractFactory.deploy(testTprAddress)).connect(user);

    await policyContractMock.setPolicyResult(false);
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    expect(await reg.getAddress()).to.be.properAddress;
  });

  it("should insertDidDocument", async () => {
    await expect(
      reg.insertDidDocument(
        did,
        baseDocument,
        vMethodId,
        user.signingKey.publicKey,
        true,
        notBefore,
        notAfter,
      ),
    ).to.emit(reg, "DidDocumentInserted");
  });

  it("should reject bad params for insertDidDocument", async () => {
    const args: InsertDidDocumentArgs = [
      did,
      baseDocument,
      vMethodId,
      user.signingKey.publicKey,
      true,
      notBefore,
      notAfter,
    ];

    args[0] = "";
    await expect(reg.insertDidDocument(...args)).to.be.revertedWith(
      "invalid did",
    );
    args[0] = did;

    args[1] = "";
    await expect(reg.insertDidDocument(...args)).to.be.revertedWith(
      "invalid baseDocument",
    );
    args[1] = baseDocument;

    args[2] = "";
    await expect(reg.insertDidDocument(...args)).to.be.revertedWith(
      "invalid vMethodId",
    );
    args[2] = vMethodId;

    args[3] = "0x";
    await expect(reg.insertDidDocument(...args)).to.be.revertedWith(
      "invalid publicKey",
    );
    args[3] = user.signingKey.publicKey;

    args[4] = false;
    await expect(reg.insertDidDocument(...args)).to.be.revertedWith(
      "first publicKey must be for secp256k1",
    );
    args[4] = true;

    args[5] = notAfter + 10;
    await expect(reg.insertDidDocument(...args)).to.be.revertedWith(
      "invalid dates",
    );
  });

  it("should reject insertDidDocument if the did already exists", async () => {
    const args: InsertDidDocumentArgs = [
      did,
      baseDocument,
      vMethodId,
      user.signingKey.publicKey,
      true,
      notBefore,
      notAfter,
    ];
    await expect(reg.insertDidDocument(...args)).to.emit(
      reg,
      "DidDocumentInserted",
    );

    await expect(reg.insertDidDocument(...args)).to.be.revertedWith(
      "did already exists",
    );
  });

  it("should update baseDocument", async () => {
    await reg.insertDidDocument(
      did,
      baseDocument,
      vMethodId,
      user.signingKey.publicKey,
      true,
      notBefore,
      notAfter,
    );
    await expect(reg.updateBaseDocument(did, "{}")).to.emit(
      reg,
      "BaseDocumentUpdated",
    );
  });

  it("should check access control for updateBaseDocument", async () => {
    await reg.insertDidDocument(
      did,
      baseDocument,
      vMethodId,
      user.signingKey.publicKey,
      true,
      notBefore,
      notAfter,
    );

    // restriction to user2
    await expect(
      reg.connect(user2).updateBaseDocument(did, "{}"),
    ).to.be.revertedWith(
      "not controller and not authorized for policy DID:updateBaseDocument",
    );

    // user2 can update if it's in the TPR
    await policyContractMock.setPolicyResult(true);
    await expect(reg.connect(user2).updateBaseDocument(did, "{}")).to.emit(
      reg,
      "BaseDocumentUpdated",
    );
  });

  it("should reject bad params of updateBaseDocument", async () => {
    await expect(
      reg.connect(user2).updateBaseDocument("did:ebsi:unknown", "{}"),
    ).to.be.revertedWith("did doesn't exist");
  });

  it("should add a controller", async () => {
    await reg.insertDidDocument(
      did,
      baseDocument,
      vMethodId,
      user.signingKey.publicKey,
      true,
      notBefore,
      notAfter,
    );

    for (let i = 0; i < MAX_CONTROLLERS; i++) {
      await reg.insertDidDocument(
        `did:ebsi:new_controller${i}`,
        baseDocument,
        vMethodId,
        ethers.Wallet.createRandom().signingKey.publicKey,
        true,
        notBefore,
        notAfter,
      );
      await (i < MAX_CONTROLLERS - 1
        ? expect(reg.addController(did, `did:ebsi:new_controller${i}`)).to.emit(
            reg,
            "ControllerAdded",
          )
        : expect(
            reg.addController(did, `did:ebsi:new_controller${i}`),
          ).to.be.revertedWith("max number of controllers"));
    }
  });

  it("should check access control for addController", async () => {
    await reg.insertDidDocument(
      did,
      baseDocument,
      vMethodId,
      user.signingKey.publicKey,
      true,
      notBefore,
      notAfter,
    );
    await reg.insertDidDocument(
      "did:ebsi:new_controller",
      baseDocument,
      vMethodId,
      ethers.Wallet.createRandom().signingKey.publicKey,
      true,
      notBefore,
      notAfter,
    );

    // restriction to user2
    await expect(
      reg.connect(user2).addController(did, "did:ebsi:new_controller"),
    ).to.be.revertedWith(
      "not controller and not authorized for policy DID:addController",
    );

    // user2 can update if it's in the TPR
    await policyContractMock.setPolicyResult(true);
    await expect(
      reg.connect(user2).addController(did, "did:ebsi:new_controller"),
    ).to.emit(reg, "ControllerAdded");
  });

  it("should reject bad params of addController", async () => {
    await reg.insertDidDocument(
      did,
      baseDocument,
      vMethodId,
      user.signingKey.publicKey,
      true,
      notBefore,
      notAfter,
    );

    await expect(
      reg.addController("did:ebsi:unknown", "did:ebsi:new_controller"),
    ).to.be.revertedWith("did doesn't exist");

    await expect(reg.addController(did, "did:ebsi:unknown")).to.be.revertedWith(
      "controller doesn't exist",
    );

    await expect(reg.addController(did, did)).to.be.revertedWith(
      "it is already a controller",
    );
  });

  it("should revoke a controller", async () => {
    await reg.insertDidDocument(
      did,
      baseDocument,
      vMethodId,
      user.signingKey.publicKey,
      true,
      notBefore,
      notAfter,
    );
    await reg.insertDidDocument(
      "did:ebsi:c2",
      baseDocument,
      vMethodId,
      user.signingKey.publicKey,
      true,
      notBefore,
      notAfter,
    );
    await reg.addController(did, "did:ebsi:c2");
    await expect(reg.revokeController(did, did)).to.emit(
      reg,
      "ControllerRevoked",
    );
    await expect(reg.revokeController(did, did)).to.be.revertedWith(
      "controller not found",
    );

    const didDocument = await reg.getDidDocument(did);
    expect(decodeResult(didDocument)).to.deep.equal({
      baseDocument,
      controllers: ["did:ebsi:c2"],
      vMethodIds: [vMethodId],
      vMethods: [
        {
          isSecp256k1: true,
          publicKey: user.signingKey.publicKey,
          revoked: false,
        },
      ],
      vRelationships: [
        {
          indexDid: "0",
          name: "authentication",
          notAfter: Number(notAfter).toString(),
          notBefore: Number(notBefore).toString(),
          vMethodId,
        },
        {
          indexDid: "0",
          name: "capabilityInvocation",
          notAfter: Number(notAfter).toString(),
          notBefore: Number(notBefore).toString(),
          vMethodId,
        },
      ],
    });
  });

  it("should check access control for revokeController", async () => {
    await reg.insertDidDocument(
      did,
      baseDocument,
      vMethodId,
      user.signingKey.publicKey,
      true,
      notBefore,
      notAfter,
    );

    // restriction to user2
    await expect(
      reg.connect(user2).revokeController(did, did),
    ).to.be.revertedWith(
      "not controller and not authorized for policy DID:revokeController",
    );

    // user2 can update if it's in the TPR
    await policyContractMock.setPolicyResult(true);
    await expect(reg.connect(user2).revokeController(did, did)).to.emit(
      reg,
      "ControllerRevoked",
    );
  });

  it("should reject bad params of revokeController", async () => {
    await reg.insertDidDocument(
      did,
      baseDocument,
      vMethodId,
      user.signingKey.publicKey,
      true,
      notBefore,
      notAfter,
    );

    await expect(
      reg.revokeController("did:ebsi:unknown", "did:ebsi:unknown"),
    ).to.be.revertedWith("did doesn't exist");

    await expect(
      reg.revokeController(did, "did:ebsi:unknown"),
    ).to.be.revertedWith("controller not found");
  });

  it("should add a verification method", async () => {
    await reg.insertDidDocument(
      did,
      baseDocument,
      vMethodId,
      user.signingKey.publicKey,
      true,
      notBefore,
      notAfter,
    );
    await expect(
      reg.addVerificationMethod(
        did,
        "O_EWDo1JUm3glFxTw3a9f2YfeKwbLuvG9kdGrb6gzHE",
        user2.signingKey.publicKey,
        true,
      ),
    ).to.emit(reg, "VerificationMethodAdded");
  });

  it("should check access control for addVerificationMethod", async () => {
    await reg.insertDidDocument(
      did,
      baseDocument,
      vMethodId,
      user.signingKey.publicKey,
      true,
      notBefore,
      notAfter,
    );

    // restriction to user2
    await expect(
      reg
        .connect(user2)
        .addVerificationMethod(
          did,
          "O_EWDo1JUm3glFxTw3a9f2YfeKwbLuvG9kdGrb6gzHE",
          user2.signingKey.publicKey,
          true,
        ),
    ).to.be.revertedWith(
      "not controller and not authorized for policy DID:addVerificationMethod",
    );

    // user2 can update if it's in the TPR
    await policyContractMock.setPolicyResult(true);
    await expect(
      reg
        .connect(user2)
        .addVerificationMethod(
          did,
          "O_EWDo1JUm3glFxTw3a9f2YfeKwbLuvG9kdGrb6gzHE",
          user2.signingKey.publicKey,
          true,
        ),
    ).to.emit(reg, "VerificationMethodAdded");
  });

  it("should reject bad params of addVerificationMethod", async () => {
    await reg.insertDidDocument(
      did,
      baseDocument,
      vMethodId,
      user.signingKey.publicKey,
      true,
      notBefore,
      notAfter,
    );

    const newVMethodId = "O_EWDo1JUm3glFxTw3a9f2YfeKwbLuvG9kdGrb6gzHE";

    const args: AddVerificationMethodArgs = [
      did,
      newVMethodId,
      user.signingKey.publicKey,
      true,
    ];

    args[0] = "did:ebsi:unknown";
    await expect(reg.addVerificationMethod(...args)).to.be.revertedWith(
      "did doesn't exist",
    );
    args[0] = did;

    args[1] = "";
    await expect(reg.addVerificationMethod(...args)).to.be.revertedWith(
      "invalid vMethodId",
    );
    args[1] = vMethodId;
    await expect(reg.addVerificationMethod(...args)).to.be.revertedWith(
      "vMethodId already exists",
    );
    args[1] = newVMethodId;

    args[2] = "0x";
    await expect(reg.addVerificationMethod(...args)).to.be.revertedWith(
      "invalid publicKey",
    );
  });

  it("should add a verification relationship", async () => {
    await reg.insertDidDocument(
      did,
      baseDocument,
      vMethodId,
      user.signingKey.publicKey,
      true,
      notBefore,
      notAfter,
    );
    await expect(
      reg.addVerificationRelationship(
        did,
        "assertionMethod",
        vMethodId,
        notBefore,
        notAfter,
      ),
    ).to.emit(reg, "VerificationRelationshipAdded");
    await expect(
      reg.addVerificationRelationship(
        did,
        "badRelationMethodName",
        vMethodId,
        notBefore,
        notAfter,
      ),
    ).to.be.revertedWith("invalid verification method");
  });

  it("should check access control for addVerificationRelationship", async () => {
    await reg.insertDidDocument(
      did,
      baseDocument,
      vMethodId,
      user.signingKey.publicKey,
      true,
      notBefore,
      notAfter,
    );

    // restriction to user2
    await expect(
      reg
        .connect(user2)
        .addVerificationRelationship(
          did,
          "assertionMethod",
          vMethodId,
          notBefore,
          notAfter,
        ),
    ).to.be.revertedWith(
      "not controller and not authorized for policy DID:addVerificationRelationship",
    );

    // user2 can update if it's in the TPR
    await policyContractMock.setPolicyResult(true);
    await expect(
      reg
        .connect(user2)
        .addVerificationRelationship(
          did,
          "assertionMethod",
          vMethodId,
          notBefore,
          notAfter,
        ),
    ).to.emit(reg, "VerificationRelationshipAdded");
  });

  it("should reject bad params of addVerificationRelationship", async () => {
    const name = "assertionMethod";
    const args: AddVerificationRelationshipArgs = [
      did,
      name,
      vMethodId,
      notBefore,
      notAfter,
    ];

    await reg.insertDidDocument(
      did,
      baseDocument,
      vMethodId,
      user.signingKey.publicKey,
      true,
      notBefore,
      notAfter,
    );

    await reg.addVerificationRelationship(
      did,
      "assertionMethod",
      vMethodId,
      notBefore,
      notAfter,
    );

    args[0] = "";
    await expect(reg.addVerificationRelationship(...args)).to.be.revertedWith(
      "did doesn't exist",
    );
    args[0] = "did:ebsi:unknown";
    await expect(reg.addVerificationRelationship(...args)).to.be.revertedWith(
      "did doesn't exist",
    );
    args[0] = did;

    args[1] = "";
    await expect(reg.addVerificationRelationship(...args)).to.be.revertedWith(
      "invalid name",
    );
    args[1] = "capabilityInvocation";
    await expect(reg.addVerificationRelationship(...args)).to.be.revertedWith(
      "capabilityInvocation already exists",
    );
    args[1] = "assertionMethod";
    await expect(reg.addVerificationRelationship(...args)).to.be.revertedWith(
      "relationship already exists",
    );
    args[1] = name;

    args[2] = "";
    await expect(reg.addVerificationRelationship(...args)).to.be.revertedWith(
      "vMethodId doesn't exist",
    );
    args[2] = "unknown method";
    await expect(reg.addVerificationRelationship(...args)).to.be.revertedWith(
      "vMethodId doesn't exist",
    );
    args[2] = vMethodId;

    args[3] = notAfter + 10;
    await expect(reg.addVerificationRelationship(...args)).to.be.revertedWith(
      "invalid dates",
    );
  });

  it("should revoke a verification method", async () => {
    await reg.insertDidDocument(
      did,
      baseDocument,
      vMethodId,
      user.signingKey.publicKey,
      true,
      notBefore,
      notAfter,
    );

    await expect(reg.revokeVerificationMethod(did, vMethodId, 3000)).to.emit(
      reg,
      "VerificationMethodRevoked",
    );

    const didDocument = await reg.getDidDocument(did);
    expect(decodeResult(didDocument)).to.eql({
      baseDocument,
      controllers: [did],
      vMethodIds: [],
      vMethods: [],
      vRelationships: [],
    });
  });

  it("should check access control for revokeVerificationMethod", async () => {
    await reg.insertDidDocument(
      did,
      baseDocument,
      vMethodId,
      user.signingKey.publicKey,
      true,
      notBefore,
      notAfter,
    );

    // restriction to user2
    await expect(
      reg.connect(user2).revokeVerificationMethod(did, vMethodId, 3000),
    ).to.be.revertedWith(
      "not controller and not authorized for policy DID:revokeVerificationMethod",
    );

    // user2 can update if it's in the TPR
    await policyContractMock.setPolicyResult(true);
    await expect(
      reg.connect(user2).revokeVerificationMethod(did, vMethodId, 3000),
    ).to.emit(reg, "VerificationMethodRevoked");
  });

  it("should reject bad params of revokeVerificationMethod", async () => {
    await reg.insertDidDocument(
      did,
      baseDocument,
      vMethodId,
      user.signingKey.publicKey,
      true,
      notBefore,
      notAfter,
    );

    await expect(
      reg.revokeVerificationMethod("did:ebsi:unknown", vMethodId, 3000),
    ).to.be.revertedWith("did doesn't exist");

    await expect(
      reg.revokeVerificationMethod(did, "unknown", 3000),
    ).to.be.revertedWith("vMethodId doesn't exist");

    await expect(
      reg.revokeVerificationMethod(did, vMethodId, notAfter + 3600),
    ).to.be.revertedWith("invalid notAfter");

    // try to revoke 2 times
    const publicKey2 = Buffer.from(
      '{"kty":"OKP","crv":"Ed25519","x":"dEb1y-9idZ2zR3AUTIJ_z-no_dVMHRf9qiD5GQg1zbI"}',
    );
    const vMethodId2 = "O_EWDo1JUm3glFxTw3a9f2YfeKwbLuvG9kdGrb6gzHE";
    await reg.addVerificationMethod(did, vMethodId2, publicKey2, false);
    await reg.revokeVerificationMethod(did, vMethodId2, notBefore + 1);
    await expect(
      reg.revokeVerificationMethod(did, vMethodId2, notBefore - 1),
    ).to.be.revertedWith("vMethodId already revoked");
  });

  it("should expire a verification method", async () => {
    await reg.insertDidDocument(
      did,
      baseDocument,
      vMethodId,
      user.signingKey.publicKey,
      true,
      notBefore,
      notAfter,
    );

    await expect(
      reg.expireVerificationMethod(did, vMethodId, notAfter + 3000),
    ).to.emit(reg, "VerificationMethodExpired");

    const didDocument = await reg.getDidDocument(did);
    expect(decodeResult(didDocument)).to.deep.equal({
      baseDocument,
      controllers: [did],
      vMethodIds: [vMethodId],
      vMethods: [
        {
          isSecp256k1: true,
          publicKey: user.signingKey.publicKey,
          revoked: false,
        },
      ],
      vRelationships: [
        {
          indexDid: "0",
          name: "authentication",
          notAfter: Number(notAfter + 3000).toString(),
          notBefore: Number(notBefore).toString(),
          vMethodId,
        },
        {
          indexDid: "0",
          name: "capabilityInvocation",
          notAfter: Number(notAfter + 3000).toString(),
          notBefore: Number(notBefore).toString(),
          vMethodId,
        },
      ],
    });
  });

  it("should check access control for expireVerificationMethod", async () => {
    await reg.insertDidDocument(
      did,
      baseDocument,
      vMethodId,
      user.signingKey.publicKey,
      true,
      notBefore,
      notAfter,
    );

    // restriction to user2
    await expect(
      reg
        .connect(user2)
        .expireVerificationMethod(did, vMethodId, notAfter + 3000),
    ).to.be.revertedWith(
      "not controller and not authorized for policy DID:expireVerificationMethod",
    );

    // user2 can update if it's in the TPR
    await policyContractMock.setPolicyResult(true);
    await expect(
      reg
        .connect(user2)
        .expireVerificationMethod(did, vMethodId, notAfter + 3000),
    ).to.emit(reg, "VerificationMethodExpired");
  });

  it("should reject bad params of expireVerificationMethod", async () => {
    await reg.insertDidDocument(
      did,
      baseDocument,
      vMethodId,
      user.signingKey.publicKey,
      true,
      notBefore,
      notAfter,
    );

    await expect(
      reg.expireVerificationMethod(
        "did:ebsi:unknown",
        vMethodId,
        notBefore + 3000,
      ),
    ).to.be.revertedWith("did doesn't exist");

    await expect(
      reg.expireVerificationMethod(did, "unknown", notBefore + 3000),
    ).to.be.revertedWith("vMethodId doesn't exist");

    await expect(
      reg.expireVerificationMethod(did, vMethodId, notBefore - 3600),
    ).to.be.revertedWith("invalid notAfter");
  });

  it("should roll a verification method", async () => {
    await reg.insertDidDocument(
      did,
      baseDocument,
      vMethodId,
      user.signingKey.publicKey,
      true,
      notBefore,
      notAfter,
    );

    const publicKey2 = Buffer.from(
      '{"kty":"OKP","crv":"Ed25519","x":"dEb1y-9idZ2zR3AUTIJ_z-no_dVMHRf9qiD5GQg1zbI"}',
    );
    const vMethodId2 = "O_EWDo1JUm3glFxTw3a9f2YfeKwbLuvG9kdGrb6gzHE";
    const newNotBefore = notBefore + 2;
    const newNotAfter = newNotBefore + 5000;

    await expect(
      reg.rollVerificationMethod(
        rollArgs(
          did,
          vMethodId2,
          publicKey2,
          false,
          newNotBefore,
          newNotAfter,
          vMethodId,
          0,
        ),
      ),
    ).to.emit(reg, "VerificationMethodRolled");

    const didDocument = await reg.getDidDocument(did);
    expect(decodeResult(didDocument)).to.deep.equal({
      baseDocument,
      controllers: [did],
      vMethodIds: [vMethodId2],
      vMethods: [
        {
          isSecp256k1: false,
          publicKey: `0x${publicKey2.toString("hex")}`,
          revoked: false,
        },
      ],
      vRelationships: [
        {
          indexDid: "0",
          name: "authentication",
          notAfter: Number(newNotAfter).toString(),
          notBefore: Number(newNotBefore).toString(),
          vMethodId: vMethodId2,
        },
        {
          indexDid: "0",
          name: "capabilityInvocation",
          notAfter: Number(newNotAfter).toString(),
          notBefore: Number(newNotBefore).toString(),
          vMethodId: vMethodId2,
        },
      ],
    });
  });

  it("should roll a verification method with a transition period", async () => {
    await reg.insertDidDocument(
      did,
      baseDocument,
      vMethodId,
      user.signingKey.publicKey,
      true,
      notBefore,
      notAfter,
    );

    const publicKey2 = Buffer.from(
      '{"kty":"OKP","crv":"Ed25519","x":"dEb1y-9idZ2zR3AUTIJ_z-no_dVMHRf9qiD5GQg1zbI"}',
    );
    const vMethodId2 = "O_EWDo1JUm3glFxTw3a9f2YfeKwbLuvG9kdGrb6gzHE";
    const newNotBefore = notBefore + 2;
    const newNotAfter = newNotBefore + 5000;

    await expect(
      reg.rollVerificationMethod(
        rollArgs(
          did,
          vMethodId2,
          publicKey2,
          false,
          newNotBefore,
          newNotAfter,
          vMethodId,
          1234,
        ),
      ),
    ).to.emit(reg, "VerificationMethodRolled");

    const didDocument = await reg.getDidDocument(did);
    expect(decodeResult(didDocument)).to.deep.equal({
      baseDocument,
      controllers: [did],
      vMethodIds: [vMethodId, vMethodId2],
      vMethods: [
        {
          isSecp256k1: true,
          publicKey: user.signingKey.publicKey,
          revoked: false,
        },
        {
          isSecp256k1: false,
          publicKey: `0x${publicKey2.toString("hex")}`,
          revoked: false,
        },
      ],
      vRelationships: [
        {
          indexDid: "0",
          name: "authentication",
          notAfter: Number(newNotBefore + 1234).toString(),
          notBefore: Number(notBefore).toString(),
          vMethodId,
        },
        {
          indexDid: "0",
          name: "authentication",
          notAfter: Number(newNotAfter).toString(),
          notBefore: Number(newNotBefore).toString(),
          vMethodId: vMethodId2,
        },
        {
          indexDid: "0",
          name: "capabilityInvocation",
          notAfter: Number(newNotBefore + 1234).toString(),
          notBefore: Number(notBefore).toString(),
          vMethodId,
        },
        {
          indexDid: "0",
          name: "capabilityInvocation",
          notAfter: Number(newNotAfter).toString(),
          notBefore: Number(newNotBefore).toString(),
          vMethodId: vMethodId2,
        },
      ],
    });
  });

  it("should check access control for rollVerificationMethod", async () => {
    await reg.insertDidDocument(
      did,
      baseDocument,
      vMethodId,
      user.signingKey.publicKey,
      true,
      notBefore,
      notAfter,
    );

    const publicKey2 = Buffer.from(
      '{"kty":"OKP","crv":"Ed25519","x":"dEb1y-9idZ2zR3AUTIJ_z-no_dVMHRf9qiD5GQg1zbI"}',
    );
    const vMethodId2 = "O_EWDo1JUm3glFxTw3a9f2YfeKwbLuvG9kdGrb6gzHE";

    // restriction to user2
    await expect(
      reg
        .connect(user2)
        .rollVerificationMethod(
          rollArgs(
            did,
            vMethodId2,
            publicKey2,
            false,
            notBefore,
            notAfter + 3600,
            vMethodId,
            0,
          ),
        ),
    ).to.be.revertedWith(
      "not controller and not authorized for policy DID:rollVerificationMethod",
    );

    // user2 can update if it's in the TPR
    await policyContractMock.setPolicyResult(true);
    await expect(
      reg
        .connect(user2)
        .rollVerificationMethod(
          rollArgs(
            did,
            vMethodId2,
            publicKey2,
            false,
            notBefore,
            notAfter + 3600,
            vMethodId,
            0,
          ),
        ),
    ).to.emit(reg, "VerificationMethodRolled");
  });

  it("should reject bad params of rollVerificationMethod", async () => {
    await reg.insertDidDocument(
      did,
      baseDocument,
      vMethodId,
      user.signingKey.publicKey,
      true,
      notBefore,
      notAfter,
    );

    const publicKey2 = Buffer.from(
      '{"kty":"OKP","crv":"Ed25519","x":"dEb1y-9idZ2zR3AUTIJ_z-no_dVMHRf9qiD5GQg1zbI"}',
    );
    const vMethodId2 = "O_EWDo1JUm3glFxTw3a9f2YfeKwbLuvG9kdGrb6gzHE";

    await expect(
      reg.rollVerificationMethod(
        rollArgs(
          "did:ebsi:unknown",
          vMethodId2,
          publicKey2,
          false,
          notBefore,
          notAfter + 3600,
          vMethodId,
          0,
        ),
      ),
    ).to.be.revertedWith("did doesn't exist");

    await expect(
      reg.rollVerificationMethod(
        rollArgs(
          did,
          vMethodId,
          publicKey2,
          false,
          notBefore,
          notAfter + 3600,
          vMethodId,
          0,
        ),
      ),
    ).to.be.revertedWith("vMethodId already exists");

    await expect(
      reg.rollVerificationMethod(
        rollArgs(
          did,
          vMethodId2,
          "0x",
          false,
          notBefore,
          notAfter + 3600,
          vMethodId,
          0,
        ),
      ),
    ).to.be.revertedWith("invalid publicKey");

    await expect(
      reg.rollVerificationMethod(
        rollArgs(
          did,
          vMethodId2,
          publicKey2,
          false,
          notBefore,
          notBefore - 1,
          vMethodId,
          0,
        ),
      ),
    ).to.be.revertedWith("invalid dates");

    await expect(
      reg.rollVerificationMethod(
        rollArgs(
          did,
          vMethodId2,
          publicKey2,
          false,
          notBefore,
          notAfter + 3600,
          "",
          0,
        ),
      ),
    ).to.be.revertedWith("oldVMethodId doesn't exist");
  });

  it("should get a list of dids", async () => {
    const args: InsertDidDocumentArgs = [
      did,
      baseDocument,
      vMethodId,
      user.signingKey.publicKey,
      true,
      notBefore,
      notAfter,
    ];

    args[0] = "did:ebsi:test1";
    await reg.insertDidDocument(...args);
    args[0] = "did:ebsi:test2";
    await reg.insertDidDocument(...args);
    args[0] = "did:ebsi:test3";
    await reg.insertDidDocument(...args);
    args[0] = "did:ebsi:test4";
    await reg.insertDidDocument(...args);
    args[0] = "did:ebsi:test5";
    await reg.insertDidDocument(...args);
    args[0] = "did:ebsi:test6";
    await reg.insertDidDocument(...args);
    args[0] = "did:ebsi:test7";
    await reg.insertDidDocument(...args);

    const dids = await reg.getDids(3, 2);
    expect(decodeResult(dids)).to.deep.equal({
      howMany: "2",
      items: ["did:ebsi:test5", "did:ebsi:test6"],
      next: "4",
      prev: "2",
      total: "7",
    });

    await expect(reg.getDids(1, 51)).to.be.revertedWith(
      "pageSize must be <= 50",
    );
  });

  it("should get dids by controller", async () => {
    const args: InsertDidDocumentArgs = [
      "did:ebsi:1",
      baseDocument,
      vMethodId,
      user.signingKey.publicKey,
      true,
      notBefore,
      notAfter,
    ];
    await reg.insertDidDocument(...args);
    args[0] = "did:ebsi:2";
    await reg.insertDidDocument(...args);
    args[0] = "did:ebsi:3";
    await reg.insertDidDocument(...args);
    args[0] = "did:ebsi:4";
    await reg.insertDidDocument(...args);
    args[0] = "did:ebsi:5";
    await reg.insertDidDocument(...args);
    await reg.addController("did:ebsi:3", "did:ebsi:1");
    await reg.addController("did:ebsi:3", "did:ebsi:2");
    await reg.addController("did:ebsi:4", "did:ebsi:2");
    await reg.addController("did:ebsi:5", "did:ebsi:2");
    await reg.revokeController("did:ebsi:5", "did:ebsi:2");

    let dids = await reg.getDidsByController("did:ebsi:1", 1, 10);
    expect(decodeResult(dids)).to.deep.equal({
      howMany: "2",
      items: ["did:ebsi:1", "did:ebsi:3"],
      next: "1",
      prev: "1",
      total: "2",
    });

    dids = await reg.getDidsByController("did:ebsi:2", 1, 10);
    expect(decodeResult(dids)).to.deep.equal({
      howMany: "3",
      items: ["did:ebsi:2", "did:ebsi:3", "did:ebsi:4"],
      next: "1",
      prev: "1",
      total: "3",
    });

    dids = await reg.getDidsByController("did:ebsi:3", 1, 10);
    expect(decodeResult(dids)).to.deep.equal({
      howMany: "1",
      items: ["did:ebsi:3"],
      next: "1",
      prev: "1",
      total: "1",
    });

    dids = await reg.getDidsByController("did:ebsi:4", 1, 10);
    expect(decodeResult(dids)).to.deep.equal({
      howMany: "1",
      items: ["did:ebsi:4"],
      next: "1",
      prev: "1",
      total: "1",
    });

    dids = await reg.getDidsByController("did:ebsi:5", 1, 10);
    expect(decodeResult(dids)).to.deep.equal({
      howMany: "1",
      items: ["did:ebsi:5"],
      next: "1",
      prev: "1",
      total: "1",
    });

    await expect(
      reg.getDidsByController("did:ebsi:5", 1, 51),
    ).to.be.revertedWith("pageSize must be <= 50");

    await expect(
      reg.getDidsByController("did:ebsi:unknown", 1, 10),
    ).to.be.revertedWith("controller doesn't exist");
  });

  it("should get dids by verification relationship", async () => {
    const args: InsertDidDocumentArgs = [
      did,
      baseDocument,
      vMethodId,
      user.signingKey.publicKey,
      true,
      notBefore,
      notAfter,
    ];
    const newWallet = ethers.Wallet.createRandom();
    const publicKey2 = newWallet.signingKey.publicKey;

    const vMethodId2 = "O_EWDo1JUm3glFxTw3a9f2YfeKwbLuvG9kdGrb6gzHE";
    const args2: InsertDidDocumentArgs = [
      did,
      baseDocument,
      vMethodId2,
      publicKey2,
      true,
      notBefore,
      notAfter,
    ];

    args[0] = "did:ebsi:test1";
    await reg.insertDidDocument(...args);
    args[0] = "did:ebsi:test2";
    await reg.insertDidDocument(...args);
    args[0] = "did:ebsi:test3";
    await reg.insertDidDocument(...args);
    args[0] = "did:ebsi:test4";
    await reg.insertDidDocument(...args);

    args[0] = "did:ebsi:different-pub-key";
    await reg.insertDidDocument(...args2);

    args[0] = "did:ebsi:test5";
    await reg.insertDidDocument(...args);
    args[0] = "did:ebsi:test6";
    await reg.insertDidDocument(...args);
    args[0] = "did:ebsi:test7";
    await reg.insertDidDocument(...args);

    const didsWithPeriod = await reg.getDidsByVerificationRelationship(
      vMethodId,
      "capabilityInvocation",
      3,
      2,
    );
    expect(decodeResult(didsWithPeriod)).to.deep.equal({
      howMany: "2",
      items: [
        {
          did: "did:ebsi:test5",
          notAfter: Number(notAfter).toString(),
          notBefore: Number(notBefore).toString(),
        },
        {
          did: "did:ebsi:test6",
          notAfter: Number(notAfter).toString(),
          notBefore: Number(notBefore).toString(),
        },
      ],
      next: "4",
      prev: "2",
      total: "7",
    });
  });

  it("should fail authorization for expired capabilityInvocation", async () => {
    const args: InsertDidDocumentArgs = [
      did,
      baseDocument,
      vMethodId,
      user.signingKey.publicKey,
      true,
      1000,
      2000,
    ];
    const vMethodId2 = "O_EWDo1JUm3glFxTw3a9f2YfeKwbLuvG9kdGrb6gzHE";
    const publicKey2 = ethers.Wallet.createRandom().signingKey.publicKey;
    await reg.insertDidDocument(...args);
    await expect(
      reg.addVerificationMethod(did, vMethodId2, publicKey2, true),
    ).to.be.revertedWith(
      "not controller and not authorized for policy DID:addVerificationMethod",
    );
  });

  it("should get a did document by timestamp", async () => {
    const now = Math.floor(Date.now() / 1000);
    const args: InsertDidDocumentArgs = [
      did,
      baseDocument,
      vMethodId,
      user.signingKey.publicKey,
      true,
      now,
      now + 1000,
    ];
    const vMethodId2 = "O_EWDo1JUm3glFxTw3a9f2YfeKwbLuvG9kdGrb6gzHE";
    const publicKey2 = ethers.Wallet.createRandom().signingKey.publicKey;
    await reg.insertDidDocument(...args);
    await reg.addVerificationMethod(did, vMethodId2, publicKey2, true);
    await reg.addVerificationRelationship(
      did,
      "capabilityInvocation",
      vMethodId2,
      notBefore + 1000,
      notAfter + 1000,
    );

    let didDocument = await reg.getDidDocumentByTimestamp(did, now + 500);
    expect(decodeResult(didDocument)).to.deep.equal({
      baseDocument,
      controllers: [did],
      vMethodIds: [vMethodId],
      vMethods: [
        {
          isSecp256k1: true,
          publicKey: user.signingKey.publicKey,
          revoked: false,
        },
      ],
      vRelationships: [
        {
          indexDid: "0",
          name: "authentication",
          notAfter: Number(now + 1000).toString(),
          notBefore: Number(now).toString(),
          vMethodId,
        },
        {
          indexDid: "0",
          name: "capabilityInvocation",
          notAfter: Number(now + 1000).toString(),
          notBefore: Number(now).toString(),
          vMethodId,
        },
      ],
    });

    didDocument = await reg.getDidDocumentByTimestamp(did, now + 3600);
    expect(decodeResult(didDocument)).to.deep.equal({
      baseDocument,
      controllers: [did],
      vMethodIds: [vMethodId2],
      vMethods: [
        {
          isSecp256k1: true,
          publicKey: publicKey2,
          revoked: false,
        },
      ],
      vRelationships: [
        {
          indexDid: "0",
          name: "capabilityInvocation",
          notAfter: Number(notAfter + 1000).toString(),
          notBefore: Number(notBefore + 1000).toString(),
          vMethodId: vMethodId2,
        },
      ],
    });
  });

  it("should check if an address is a controller", async () => {
    const vMethodId2 = "vMethodId2";
    const vMethodId3 = "vMethodId3";
    await reg.insertDidDocument(
      did,
      baseDocument,
      vMethodId,
      user.signingKey.publicKey,
      true,
      notBefore,
      notAfter,
    );
    await reg.insertDidDocument(
      "did:ebsi:c2",
      baseDocument,
      vMethodId2,
      user2.signingKey.publicKey,
      true,
      notBefore,
      notAfter,
    );
    await reg.insertDidDocument(
      "did:ebsi:c3",
      baseDocument,
      vMethodId3,
      user3.signingKey.publicKey,
      true,
      notBefore,
      notAfter,
    );
    await reg.addController(did, "did:ebsi:c2");
    /* eslint-disable @typescript-eslint/no-unused-expressions */
    expect(await reg["checkController(string,address)"](did, user.address)).to
      .be.true;
    expect(await reg["checkController(string,address)"](did, user2.address)).to
      .be.true;
    expect(await reg["checkController(string,address)"](did, user3.address)).to
      .be.false;
    expect(
      await reg["checkController(string,address)"](
        did,
        ethers.Wallet.createRandom().address,
      ),
    ).to.be.false;

    const didHex = `0x${Buffer.from(did).toString("hex")}`;
    expect(await reg["checkController(bytes,address)"](didHex, user.address)).to
      .be.true;
    expect(await reg["checkController(bytes,address)"](didHex, user2.address))
      .to.be.true;
    expect(await reg["checkController(bytes,address)"](didHex, user3.address))
      .to.be.false;
    expect(
      await reg["checkController(bytes,address)"](
        didHex,
        ethers.Wallet.createRandom().address,
      ),
    ).to.be.false;
    /* eslint-enable @typescript-eslint/no-unused-expressions */
  });

  it("should follow expected usage flow", async () => {
    await reg.insertDidDocument(
      did,
      baseDocument,
      vMethodId,
      user.signingKey.publicKey,
      true,
      notBefore,
      notAfter,
    );
    await reg.addVerificationRelationship(
      did,
      "assertionMethod",
      vMethodId,
      notBefore,
      notAfter,
    );

    const publicKey2 = Buffer.from(
      '{"kty":"OKP","crv":"Ed25519","x":"dEb1y-9idZ2zR3AUTIJ_z-no_dVMHRf9qiD5GQg1zbI"}',
    );
    const vMethodId2 = "O_EWDo1JUm3glFxTw3a9f2YfeKwbLuvG9kdGrb6gzHE";

    const publicKey3 = Buffer.from(
      '{"kty":"EC","crv":"P-256","x":"rG8XLCoehck238fGvts8Zn5_G9P5JeXTyVysKibu6qI","y":"90y-6hJf_ZKnh1nhCsc5d204xji2hhfgyPSTc6WZs6s"}',
    );
    const vMethodId3 = "HbSpfp_l-njw22UGE_DeWvNpx3BrCmyRLwZ7hMVVkSw";

    await reg.addVerificationMethod(did, vMethodId2, publicKey2, false);
    await reg.addVerificationRelationship(
      did,
      "assertionMethod",
      vMethodId2,
      notBefore,
      notAfter,
    );

    let didDocument = await reg.getDidDocument(did);
    expect(decodeResult(didDocument)).to.deep.equal({
      baseDocument,
      controllers: [did],
      vMethodIds: [vMethodId, vMethodId2],
      vMethods: [
        {
          isSecp256k1: true,
          publicKey: user.signingKey.publicKey,
          revoked: false,
        },
        {
          isSecp256k1: false,
          publicKey: `0x${publicKey2.toString("hex")}`,
          revoked: false,
        },
      ],
      vRelationships: [
        {
          indexDid: "0",
          name: "authentication",
          notAfter: Number(notAfter).toString(),
          notBefore: Number(notBefore).toString(),
          vMethodId,
        },
        {
          indexDid: "0",
          name: "assertionMethod",
          notAfter: Number(notAfter).toString(),
          notBefore: Number(notBefore).toString(),
          vMethodId,
        },
        {
          indexDid: "0",
          name: "assertionMethod",
          notAfter: Number(notAfter).toString(),
          notBefore: Number(notBefore).toString(),
          vMethodId: vMethodId2,
        },
        {
          indexDid: "0",
          name: "capabilityInvocation",
          notAfter: Number(notAfter).toString(),
          notBefore: Number(notBefore).toString(),
          vMethodId,
        },
      ],
    });

    // add a new key
    const notBefore3 = Math.floor(Date.now() / 1000);
    const notAfter3 = notBefore3 + 24 * 3600;
    await reg.addVerificationMethod(did, vMethodId3, publicKey3, false);
    await reg.addVerificationRelationship(
      did,
      "authentication",
      vMethodId3,
      notBefore3,
      notAfter3,
    );

    didDocument = await reg.getDidDocument(did);
    expect(decodeResult(didDocument)).to.deep.equal({
      baseDocument,
      controllers: [did],
      vMethodIds: [vMethodId, vMethodId2, vMethodId3],
      vMethods: [
        {
          isSecp256k1: true,
          publicKey: user.signingKey.publicKey,
          revoked: false,
        },
        {
          isSecp256k1: false,
          publicKey: `0x${publicKey2.toString("hex")}`,
          revoked: false,
        },
        {
          isSecp256k1: false,
          publicKey: `0x${publicKey3.toString("hex")}`,
          revoked: false,
        },
      ],
      vRelationships: [
        {
          indexDid: "0",
          name: "authentication",
          notAfter: Number(notAfter).toString(),
          notBefore: Number(notBefore).toString(),
          vMethodId,
        },
        {
          indexDid: "0",
          name: "assertionMethod",
          notAfter: Number(notAfter).toString(),
          notBefore: Number(notBefore).toString(),
          vMethodId,
        },
        {
          indexDid: "0",
          name: "assertionMethod",
          notAfter: Number(notAfter).toString(),
          notBefore: Number(notBefore).toString(),
          vMethodId: vMethodId2,
        },
        {
          indexDid: "0",
          name: "authentication",
          notAfter: Number(notAfter3).toString(),
          notBefore: Number(notBefore3).toString(),
          vMethodId: vMethodId3,
        },
        {
          indexDid: "0",
          name: "capabilityInvocation",
          notAfter: Number(notAfter).toString(),
          notBefore: Number(notBefore).toString(),
          vMethodId,
        },
      ],
    });

    // revoke key 2
    await reg.revokeVerificationMethod(did, vMethodId2, notBefore + 1);
    didDocument = await reg.getDidDocument(did);
    expect(decodeResult(didDocument)).to.deep.equal({
      baseDocument,
      controllers: [did],
      vMethodIds: [vMethodId, vMethodId3],
      vMethods: [
        {
          isSecp256k1: true,
          publicKey: user.signingKey.publicKey,
          revoked: false,
        },
        {
          isSecp256k1: false,
          publicKey: `0x${publicKey3.toString("hex")}`,
          revoked: false,
        },
      ],
      vRelationships: [
        {
          indexDid: "0",
          name: "authentication",
          notAfter: Number(notAfter).toString(),
          notBefore: Number(notBefore).toString(),
          vMethodId,
        },
        {
          indexDid: "0",
          name: "assertionMethod",
          notAfter: Number(notAfter).toString(),
          notBefore: Number(notBefore).toString(),
          vMethodId,
        },
        {
          indexDid: "0",
          name: "authentication",
          notAfter: Number(notAfter3).toString(),
          notBefore: Number(notBefore3).toString(),
          vMethodId: vMethodId3,
        },
        {
          indexDid: "0",
          name: "capabilityInvocation",
          notAfter: Number(notAfter).toString(),
          notBefore: Number(notBefore).toString(),
          vMethodId,
        },
      ],
    });

    // roll key1
    const vMethodId4 = "qXMFeOMwDRe8ul_MiIffWYpD5ndjNhqfVDXhuDApBh4";
    const notBefore4 = notBefore + 2;
    const notAfter4 = notBefore4 + 5000;
    const publicKey4 = ethers.Wallet.createRandom().signingKey.publicKey;
    await reg.rollVerificationMethod(
      rollArgs(
        did,
        vMethodId4,
        publicKey4,
        true,
        notBefore4,
        notAfter4,
        vMethodId,
        0,
      ),
    );
    didDocument = await reg.getDidDocument(did);
    expect(decodeResult(didDocument)).to.deep.equal({
      baseDocument,
      controllers: [did],
      vMethodIds: [vMethodId3, vMethodId4],
      vMethods: [
        {
          isSecp256k1: false,
          publicKey: `0x${publicKey3.toString("hex")}`,
          revoked: false,
        },
        {
          isSecp256k1: true,
          publicKey: publicKey4,
          revoked: false,
        },
      ],
      vRelationships: [
        {
          indexDid: "0",
          name: "authentication",
          notAfter: Number(notAfter3).toString(),
          notBefore: Number(notBefore3).toString(),
          vMethodId: vMethodId3,
        },
        {
          indexDid: "0",
          name: "authentication",
          notAfter: Number(notAfter4).toString(),
          notBefore: Number(notBefore4).toString(),
          vMethodId: vMethodId4,
        },
        {
          indexDid: "0",
          name: "assertionMethod",
          notAfter: Number(notAfter4).toString(),
          notBefore: Number(notBefore4).toString(),
          vMethodId: vMethodId4,
        },
        {
          indexDid: "0",
          name: "capabilityInvocation",
          notAfter: Number(notAfter4).toString(),
          notBefore: Number(notBefore4).toString(),
          vMethodId: vMethodId4,
        },
      ],
    });
  });
});
