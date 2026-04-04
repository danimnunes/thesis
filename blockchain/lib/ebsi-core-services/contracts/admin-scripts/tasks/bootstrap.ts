import { task } from "hardhat/config";

import type { DidRegistry } from "@ebsiint-sc/did-registry-v5";
import type { Tir } from "@ebsiint-sc/trusted-issuers-registry-v5";
import type { PolicyRegistry } from "@ebsiint-sc/trusted-policies-registry-v3";
import type { SchemaSCRegistry } from "@ebsiint-sc/trusted-schemas-registry-v3";

/* eslint-disable perfectionist/sort-imports */
import schema1 from "@europeum-ebsi/vcdm1.1-accreditation-schema";
import schema2 from "@europeum-ebsi/vcdm1.1-alliance-id-schema";
import schema3 from "@europeum-ebsi/vcdm1.1-attestation-schema";
import schema4 from "@europeum-ebsi/vcdm1.1-ct-qualification-schema";
import schema5 from "@europeum-ebsi/vcdm1.1-e-origin-customs-clearance-representative-schema";
import schema6 from "@europeum-ebsi/vcdm1.1-e-origin-vat-representation-schema";
import schema7 from "@europeum-ebsi/vcdm1.1-e-origin-verifiable-business-card-schema";
import schema8 from "@europeum-ebsi/vcdm1.1-e-origin-verifiable-importer-schema";
import schema9 from "@europeum-ebsi/vcdm1.1-verifiable-education-id-schema";
import schema10 from "@europeum-ebsi/vcdm1.1-essp-pda1-schema";
import schema11 from "@europeum-ebsi/vcdm1.1-euipo-certificate-of-trademark-registration-schema";
import schema12 from "@europeum-ebsi/vcdm1.1-europass-edc-schema";
import schema13 from "@europeum-ebsi/vcdm1.1-hr-ds-3-badge-schema";
import schema14 from "@europeum-ebsi/vcdm1.1-idunion-odi-schema";
import schema15 from "@europeum-ebsi/vcdm1.1-idunion-poa-schema";
import schema16 from "@europeum-ebsi/vcdm1.1-multi-uni-pilot-education-verifiable-accreditation-records-schema";
import schema17 from "@europeum-ebsi/vcdm1.1-multi-uni-pilot-my-academic-id-schema";
import schema18 from "@europeum-ebsi/vcdm1.1-multi-uni-pilot-verifiable-attestation-individual-id-schema";
import schema19 from "@europeum-ebsi/vcdm1.1-multi-uni-pilot-verifiable-attestation-organisational-id-schema";
import schema20 from "@europeum-ebsi/vcdm1.1-multi-uni-pilot-verifiable-diploma-schema";
import schema21 from "@europeum-ebsi/vcdm1.1-pm2-credential-schema";
import schema22 from "@europeum-ebsi/vcdm1.1-presentation-schema";
import schema23 from "@europeum-ebsi/vcdm1.1-revocation-statuslist-schema";
import schema24 from "@europeum-ebsi/vcdm1.1-trusted-nodes-list-schema";
import schema25 from "@europeum-ebsi/vcdm1.1-type-extensions-credential-status-status-list-2021-schema";
import schema26 from "@europeum-ebsi/vcdm1.1-type-extensions-terms-of-use-accreditation-policy-schema";
import schema27 from "@europeum-ebsi/vcdm1.1-type-extensions-terms-of-use-issuance-certificate-schema";
import schema28 from "@europeum-ebsi/vcdm1.1-type-extensions-terms-of-use-trust-framework-policy-schema";
import schema29 from "@europeum-ebsi/vcdm1.1-vid-legal-entity-schema";
import schema30 from "@europeum-ebsi/vcdm1.1-vid-natural-person-schema";
import schema31 from "@europeum-ebsi/vcdm1.1-vid-verifiable-authorisation-schema";
import schema32 from "@europeum-ebsi/vcdm1.1-w3id-traceability-commercial-invoice-credential-schema";
import schema33 from "@europeum-ebsi/vcdm2.0-attestation-schema";
import schema34 from "@europeum-ebsi/vcdm2.0-delegated-authorisation-schema";
import schema35 from "@europeum-ebsi/vcdm2.0-europass-edc-schema";
import schema36 from "@europeum-ebsi/vcdm2.0-verifiable-education-id-schema";
import schema37 from "@europeum-ebsi/vcdm2.0-key-attestations-schema";
import schema38 from "@europeum-ebsi/vcdm2.0-lpid-schema";
import schema39 from "@europeum-ebsi/vcdm2.0-multi-uni-pilot-employment-attestation-schema";
import schema40 from "@europeum-ebsi/vcdm2.0-multi-uni-pilot-work-certificate-schema";
import schema41 from "@europeum-ebsi/vcdm2.0-pm2-credential-schema";
import schema42 from "@europeum-ebsi/vcdm2.0-presentation-schema";
import schema43 from "@europeum-ebsi/vcdm2.0-timestamp-token-schema";
import schema44 from "@europeum-ebsi/vcdm2.0-trust-model-schema";
import schema45 from "@europeum-ebsi/vcdm2.0-type-extensions-evidence-authorisation-delegation-schema";
import schema46 from "@europeum-ebsi/vcdm2.0-type-extensions-terms-of-use-attestation-policy-schema";
import schema47 from "@europeum-ebsi/vcdm2.0-vid-legal-entity-schema";
import schema48 from "@europeum-ebsi/vcdm2.0-vid-natural-person-schema";
import schema49 from "@europeum-ebsi/vcdm2.0-w3id-traceability-commercial-invoice-credential-schema";
/* eslint-enable perfectionist/sort-imports */
import * as dotenv from "dotenv";
import { BaseWallet } from "ethers";
import { SignJWT } from "jose";
import { randomBytes, randomUUID } from "node:crypto";
import fs from "node:fs/promises";

import { generateDidParams, UserData } from "../utils/generateDidParams";

const pathName = __dirname + "/../wallets.env";
dotenv.config();

const schemas = [
  schema1,
  schema2,
  schema3,
  schema4,
  schema5,
  schema6,
  schema7,
  schema8,
  schema9,
  schema10,
  schema11,
  schema12,
  schema13,
  schema14,
  schema15,
  schema16,
  schema17,
  schema18,
  schema19,
  schema20,
  schema21,
  schema22,
  schema23,
  schema24,
  schema25,
  schema26,
  schema27,
  schema28,
  schema29,
  schema30,
  schema31,
  schema32,
  schema33,
  schema34,
  schema35,
  schema36,
  schema37,
  schema38,
  schema39,
  schema40,
  schema41,
  schema42,
  schema43,
  schema44,
  schema45,
  schema46,
  schema47,
  schema48,
  schema49,
];

interface OwnedUpgradeabilityProxyLike {
  admin(): Promise<string>;
  changeAdmin(
    newAdmin: string,
  ): Promise<{ wait: (confirmations?: number) => Promise<unknown> }>;
}

// follows ETH/BTC's BIP 39 protocol
// https://iancoleman.io/bip39/
// and matches the one hardhat uses when using { accounts: { mnemonic }}
task(
  "bootstrap",
  "generate 2 operator wallets - TPR operator (tprOp), and Support Office (SO).",
).setAction(async (_taskArgs, { ethers }) => {
  if (!process.env.EBSI_DOMAIN) {
    // Example: EBSI_DOMAIN=https://api-pilot.ebsi.eu
    console.log("EBSI_DOMAIN is not defined");
    return;
  }
  const domain = process.env.EBSI_DOMAIN;

  if (
    !process.env.TPR_SC_V3_ADDRESS ||
    !process.env.DIDR_SC_V5_ADDRESS ||
    !process.env.TIMESTAMP_SC_V4_ADDRESS ||
    !process.env.TIR_SC_V5_ADDRESS ||
    !process.env.TSR_SC_V3_ADDRESS
  ) {
    console.log("deploy contracts first");
    return;
  }
  // load from wallets.env
  console.log(`load or generate new wallets and save to path ${pathName}`);
  let soOp, tprOp;
  if (
    process.env.TPR_OPERATOR_WALLET_ADDRESS_PRIVATE_KEY &&
    process.env.SUPPORT_OFFICE_WALLET_ADDRESS_PRIVATE_KEY
  ) {
    console.log(`wallet already exists in ${pathName}`);
    tprOp = new ethers.Wallet(
      process.env.TPR_OPERATOR_WALLET_ADDRESS_PRIVATE_KEY,
    );
    soOp = new ethers.Wallet(
      process.env.SUPPORT_OFFICE_WALLET_ADDRESS_PRIVATE_KEY,
    );
  } else {
    tprOp = ethers.Wallet.createRandom();
    soOp = ethers.Wallet.createRandom();
    await fs.appendFile(
      pathName,
      `TPR_OPERATOR_WALLET_ADDRESS=${tprOp.address}\n`,
      "utf8",
    );
    await fs.appendFile(
      pathName,
      `TPR_OPERATOR_WALLET_ADDRESS_PRIVATE_KEY=${tprOp.privateKey}\n`,
      "utf8",
    );
    await fs.appendFile(
      pathName,
      `SUPPORT_OFFICE_WALLET_ADDRESS=${soOp.address}\n`,
      "utf8",
    );
    await fs.appendFile(
      pathName,
      `SUPPORT_OFFICE_WALLET_ADDRESS_PRIVATE_KEY=${soOp.privateKey}\n`,
      "utf8",
    );
  }

  console.log(`load signers...`);
  const tprSigner = tprOp.connect(ethers.provider);
  const soSigner = soOp.connect(ethers.provider);

  const tprContract = (await ethers.getContractAt(
    "contracts/trusted-policies-registry-v3/trusted-policies-registry/PolicyRegistry.sol:PolicyRegistry",
    process.env.TPR_SC_V3_ADDRESS,
  )) as unknown as PolicyRegistry;

  // move admin to next signer
  const tprContractProxy = (await ethers.getContractAt(
    "OwnedUpgradeabilityProxy",
    process.env.TPR_SC_V3_ADDRESS,
  )) as unknown as OwnedUpgradeabilityProxyLike;
  if (
    (await tprContractProxy.admin()) === (await ethers.getSigners())[0].address
  ) {
    console.log(
      `move admin to next address so there is no conflict in proxyAdmin and delegate call...`,
    );
    const nextAdmin = (await ethers.getSigners())[1];
    await (await tprContractProxy.changeAdmin(nextAdmin.address)).wait(1);
  }

  const operatorRole = await tprContract.OPERATOR_ROLE();
  // grant role
  if (await tprContract.hasRole(operatorRole, tprOp.address)) {
    console.log(`access already granted to ${tprOp.address}`);
  } else {
    console.log(`grant operator role for tprOp...`);
    await (await tprContract.grantRole(operatorRole, tprOp.address)).wait(1);
  }

  // insert Policy for SO
  // Use the tprOp create policies in the TPR (insertPolicy) and assign these policies to the SO (insertUserAttributes)
  // insertPolicy
  // tpr Signer

  const policies = [
    "DID:updateBaseDocument",
    "DID:addController",
    "DID:revokeController",
    "DID:addVerificationMethod",
    "DID:addVerificationRelationship",
    "DID:revokeVerificationMethod",
    "DID:expireVerificationMethod",
    "DID:rollVerificationMethod",
    "TIR:updateIssuer",
    "TIR:setAttributeMetadata",
    "TS:insertHashAlgorithm",
    "TS:updateHashAlgorithm",
    "TSR:insertSchema",
    "TSR:updateSchema",
    "TSR:updateMetadata",
    "TNT:authoriseDid",
  ];
  console.log(`insert policies...`);
  for (const policy of policies) {
    try {
      await (
        await tprContract.connect(tprSigner).insertPolicy(policy, policy)
      ).wait(0);
    } catch {
      console.log(`policy ${policy} already exists`);
    }
  }

  // insert so user attributes
  try {
    console.log(`trying to insert user attributes...`);
    await (
      await tprContract
        .connect(tprSigner)
        .insertUserAttributes(soOp.address, policies)
    ).wait();
  } catch {
    console.log(`user attributes already exists for ${soOp.address}`);
  }

  // Register DIDs for tprOp and SO in the did registry

  const didrContract = (await ethers.getContractAt(
    "contracts/did-registry-v5/did-registry/DidRegistry.sol:DidRegistry",
    process.env.DIDR_SC_V5_ADDRESS,
  )) as unknown as DidRegistry;

  async function registerDidDocument(userData: UserData, signer: BaseWallet) {
    try {
      await (
        await didrContract
          .connect(signer)
          .insertDidDocument(
            userData.did,
            userData.baseDocument,
            userData.ES256K.vMethodId,
            userData.ES256K.publicKeyHex,
            true,
            userData.notBefore,
            userData.notAfter,
          )
      ).wait();
    } catch {
      console.log(`error registering ES256K key in DID document`);
    }

    try {
      await (
        await didrContract
          .connect(signer)
          .addVerificationMethod(
            userData.did,
            userData.ES256.vMethodId,
            userData.ES256.publicKeyHex,
            false,
          )
      ).wait();
    } catch {
      console.log(`error registering ES256 key in DID document`);
    }

    try {
      await (
        await didrContract
          .connect(signer)
          .addVerificationRelationship(
            userData.did,
            "authentication",
            userData.ES256.vMethodId,
            userData.notBefore,
            userData.notAfter,
          )
      ).wait();
    } catch {
      console.log(
        `error registering authentication relationship in DID document`,
      );
    }

    try {
      await (
        await didrContract
          .connect(signer)
          .addVerificationRelationship(
            userData.did,
            "assertionMethod",
            userData.ES256.vMethodId,
            userData.notBefore,
            userData.notAfter,
          )
      ).wait();
    } catch {
      console.log(
        `error registering assertionMethod relationship in DID document`,
      );
    }
  }

  // register tprOp DID
  console.log(`registering tprOp DID...`);
  const tprOpDidParams = await generateDidParams(tprOp);
  await registerDidDocument(tprOpDidParams, tprSigner);

  // register so DID
  console.log(`registering soOp DID...`);
  const soOpDidParams = await generateDidParams(soOp);
  await registerDidDocument(soOpDidParams, soSigner);

  // insert hash algs in timestamp
  console.log(`inserting hash algs in timestamp...`);
  const timestampContract = await ethers.getContractAt(
    "contracts/timestamp-v4/timestamp/Timestamp.sol:Timestamp",
    process.env.TIMESTAMP_SC_V4_ADDRESS,
    soSigner,
  );

  const hashAlgs = [
    ["256", "sha-256", "2.16.840.1.101.3.4.2.1", "1", "sha2-256"],
    ["384", "sha-384", "2.16.840.1.101.3.4.2.2", "1", "sha2-384"],
    ["512", "sha-512", "2.16.840.1.101.3.4.2.3", "1", "sha2-512"],
    ["224", "sha3-224", "2.16.840.1.101.3.4.2.7", "1", "sha3-224"],
    ["256", "sha3-256", "2.16.840.1.101.3.4.2.8", "1", "sha3-256"],
    ["384", "sha3-384", "2.16.840.1.101.3.4.2.9", "1", "sha3-384"],
    ["512", "sha3-512", "2.16.840.1.101.3.4.2.10", "1", "sha3-512"],
  ];
  for (const hashAlg of hashAlgs) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      await (
        await timestampContract.insertHashAlgorithm(
          hashAlg[0],
          hashAlg[1],
          hashAlg[2],
          hashAlg[3],
          hashAlg[4],
        )
      )
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        .wait();
    } catch {
      console.log(`hash alg ${hashAlg[1]} already exists`);
    }
  }

  // register SO as root tao in tir

  const tirContract = (await ethers.getContractAt(
    "contracts/trusted-issuers-registry-v5/tir/Tir.sol:Tir",
    process.env.TIR_SC_V5_ADDRESS,
    tprSigner,
  )) as unknown as Tir;

  async function registerUserAsSupportOffice(
    userData: UserData,
    signer: BaseWallet,
  ) {
    const reservedAttributeId = randomBytes(32).toString("hex");
    const iat = Math.floor(Date.now() / 1000) - 10;
    const exp = iat + 5 * 365 * 24 * 3600;
    const issuanceDate = `${new Date(iat * 1000).toISOString().slice(0, -5)}Z`;
    const expirationDate = `${new Date(exp * 1000)
      .toISOString()
      .slice(0, -5)}Z`;
    const jti = `urn:uuid:${randomUUID()}`;
    const payload = {
      exp,
      iat,
      iss: userData.did,
      jti,
      nbf: iat,
      sub: userData.did,
      vc: {
        "@context": ["https://www.w3.org/2018/credentials/v1"],
        credentialSchema: {
          id: `${domain}/trusted-schemas-registry/v3/schemas/zjVFNvbEBPAr3a724DttioZpgZmNr75BBtRzZqk7pkDe`,
          type: "FullJsonSchemaValidator2021",
        },
        credentialSubject: {
          accreditedFor: [
            {
              schemaId: `${domain}/trusted-schemas-registry/v3/schemas/z3MgUFUkb722uq4x3dv5yAJmnNmzDFeK5UC8x83QoeLJM`,
              types: [
                "VerifiableCredential",
                "VerifiableAttestation",
                "VerifiableAuthorisationForTrustChain",
              ],
            },
          ],
          id: userData.did,
          reservedAttributeId,
        },
        expirationDate,
        id: jti,
        issuanceDate,
        issued: issuanceDate,
        issuer: userData.did,
        type: [
          "VerifiableCredential",
          "VerifiableAttestation",
          "VerifiableAccreditation",
          "VerifiableAccreditationToAttest",
        ],
        validFrom: issuanceDate,
      },
    };
    const header = {
      alg: "ES256",
      kid: `${userData.did}#${userData.ES256.vMethodId}`,
      typ: "JWT",
    };
    const vcJwtSelfAttestation = await new SignJWT(payload)
      .setProtectedHeader(header)
      .sign(userData.ES256.privateKey);

    try {
      await (
        await tirContract.connect(signer).setAttributeMetadata(
          userData.did,
          `0x${reservedAttributeId}`,
          1, // roottao
          userData.did,
          `0x${reservedAttributeId}`,
        )
      ).wait();
    } catch (error) {
      console.log("error registering the DID in the TIR");
      console.error(error);
    }

    try {
      await (
        await tirContract
          .connect(signer)
          .setAttributeData(
            userData.did,
            `0x${reservedAttributeId}`,
            ethers.toUtf8Bytes(vcJwtSelfAttestation),
          )
      ).wait();
    } catch (error) {
      console.log("error registering the VC in the TIR");
      console.error(error);
    }
  }
  console.log(`registering SO as support office...`);
  await registerUserAsSupportOffice(soOpDidParams, soSigner);

  // register schemas
  console.log(`registering schemas...`);
  const tsrContract = (await ethers.getContractAt(
    "contracts/trusted-schemas-registry-v3/trusted-schemas-registry/SchemaSCRegistry.sol:SchemaSCRegistry",
    process.env.TSR_SC_V3_ADDRESS,
  )) as unknown as SchemaSCRegistry;
  for (const { metadata, schema } of schemas) {
    try {
      await (
        await tsrContract
          .connect(soSigner)
          .insertSchema(
            metadata.id.base16,
            `0x${Buffer.from(JSON.stringify(schema)).toString("hex")}`,
            `0x${Buffer.from(JSON.stringify({ created: new Date().toISOString() })).toString("hex")}`,
          )
      ).wait();
    } catch (error) {
      const schemaTitle = schema.title as string;
      console.log(`error registering schema ${schemaTitle}`);
      console.error(error);
    }
  }
  console.log(`bootstrap completed`);
});
