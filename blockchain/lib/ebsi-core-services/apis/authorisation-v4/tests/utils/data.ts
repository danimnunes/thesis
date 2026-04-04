import type { EbsiIssuer } from "@europeum-ebsi/verifiable-credential";
import type { PresentationSubmission } from "@sphereon/pex-models";
import type { DIDDocument, JsonWebKey } from "did-resolver";

import {
  generatePrivateKey,
  getPublicKeyJwk,
  getSigner,
} from "@ebsiint-api/shared";
import { EbsiWallet } from "@europeum-ebsi/wallet-lib";
import { ethers } from "ethers";
import { randomUUID } from "node:crypto";

import {
  CUSTOM_SCOPES,
  DIDR_INVITE_PRESENTATION_DEFINITION,
  DIDR_INVITE_SCOPE,
  DIDR_WRITE_PRESENTATION_DEFINITION,
  DIDR_WRITE_SCOPE,
  LEDGER_INVOKE_PRESENTATION_DEFINITION,
  LEDGER_INVOKE_SCOPE,
  TIMESTAMP_WRITE_PRESENTATION_DEFINITION,
  TIMESTAMP_WRITE_SCOPE,
  TIR_INVITE_PRESENTATION_DEFINITION,
  TIR_INVITE_SCOPE,
  TIR_WRITE_PRESENTATION_DEFINITION,
  TIR_WRITE_SCOPE,
  TNT_AUTHORISE_PRESENTATION_DEFINITION,
  TNT_AUTHORISE_SCOPE,
  TNT_CREATE_PRESENTATION_DEFINITION,
  TNT_CREATE_SCOPE,
  TNT_WRITE_PRESENTATION_DEFINITION,
  TNT_WRITE_SCOPE,
  TPR_WRITE_PRESENTATION_DEFINITION,
  TPR_WRITE_SCOPE,
  TSR_WRITE_PRESENTATION_DEFINITION,
  TSR_WRITE_SCOPE,
} from "../../src/modules/authorisation/authorisation.constants.ts";

export interface Entity<T extends "EdDSA" | "ES256" | "ES256K"> {
  address: string;
  did: string;
  didDocument: DIDDocument;
  keys: Record<T, EbsiIssuer & { publicKeyJwk: JsonWebKey }>;
}

export type LegalEntity<T extends "EdDSA" | "ES256" | "ES256K"> = Entity<T>;

export function createDidDocument(
  did: string,
  keys: Record<string, EbsiIssuer & { publicKeyJwk: JsonWebKey }>,
): DIDDocument {
  const kids = Object.keys(keys).map((alg) => keys[alg]!.kid);
  return {
    "@context": [
      "https://www.w3.org/ns/did/v1",
      "https://w3id.org/security/suites/jws-2020/v1",
    ],
    assertionMethod: kids,
    authentication: kids,
    capabilityInvocation: kids,
    id: did,
    verificationMethod: Object.keys(keys).map((alg) => ({
      controller: did,
      id: keys[alg]!.kid,
      publicKeyJwk: keys[alg]!.publicKeyJwk,
      type: "JsonWebKey2020",
    })),
  };
}

export async function createLegalEntity<T extends "EdDSA" | "ES256" | "ES256K">(
  algs: T[],
  did?: string,
): Promise<LegalEntity<T>> {
  const legalEntityDid = did ?? EbsiWallet.createDid();

  const keys: Record<string, EbsiIssuer & { publicKeyJwk: JsonWebKey }> = {};
  let address = "";

  for (const alg of algs) {
    const privateKey = generatePrivateKey(alg);
    const publicKeyJwk = await getPublicKeyJwk(privateKey, alg);
    const kid = `${legalEntityDid}#${publicKeyJwk.kid}`;

    keys[alg] = {
      alg,
      did: legalEntityDid,
      kid,
      publicKeyJwk,
      signer: getSigner(privateKey, alg),
    };

    if (alg === "ES256K") {
      const wallet = new ethers.Wallet(
        `0x${Buffer.from(privateKey).toString("hex")}`,
      );
      address = wallet.address;
    }
  }

  const didDocument = createDidDocument(legalEntityDid, keys);

  return {
    address,
    did: legalEntityDid,
    didDocument,
    keys,
  };
}

export async function createNaturalPerson<
  T extends "EdDSA" | "ES256" | "ES256K",
>(alg: T, did?: string): Promise<Entity<T>> {
  const keys: Record<string, EbsiIssuer & { publicKeyJwk: JsonWebKey }> = {};
  let address = "";

  const privateKey = generatePrivateKey(alg);
  const publicKeyJwk = await getPublicKeyJwk(privateKey, alg);
  did = did ?? EbsiWallet.createDid("NATURAL_PERSON", publicKeyJwk);
  const kid = `${did}#${did.replace("did:key:", "")}`;

  keys[alg] = {
    alg,
    did: did,
    kid,
    publicKeyJwk,
    signer: getSigner(privateKey, alg),
  };

  if (alg === "ES256K") {
    const wallet = new ethers.Wallet(
      `0x${Buffer.from(privateKey).toString("hex")}`,
    );
    address = wallet.address;
  }

  const didDocument = createDidDocument(did, keys);

  return {
    address,
    did,
    didDocument,
    keys,
  };
}

export function createPresentationSubmission(
  scope: (typeof CUSTOM_SCOPES)[number],
  vpFormat: "jwt_vp" | "jwt_vp_json",
  vcFormat: "jwt_vc" | "jwt_vc_json",
): PresentationSubmission {
  // Note that there are no .vc or .vp in path or path_nested below.
  const testPresentationSubmission: PresentationSubmission = {
    definition_id: "",
    descriptor_map: [],
    id: randomUUID(),
  };

  switch (scope) {
    case DIDR_INVITE_SCOPE: {
      testPresentationSubmission.definition_id =
        DIDR_INVITE_PRESENTATION_DEFINITION.id;

      testPresentationSubmission.descriptor_map.push({
        format: vpFormat,
        id: DIDR_INVITE_PRESENTATION_DEFINITION.input_descriptors[0].id,
        path: "$",
        path_nested: {
          format: vcFormat,
          id: DIDR_INVITE_PRESENTATION_DEFINITION.input_descriptors[0].id,
          path: "$.vp.verifiableCredential[0]",
        },
      });

      break;
    }
    case DIDR_WRITE_SCOPE: {
      testPresentationSubmission.definition_id =
        DIDR_WRITE_PRESENTATION_DEFINITION.id;

      break;
    }
    case LEDGER_INVOKE_SCOPE: {
      testPresentationSubmission.definition_id =
        LEDGER_INVOKE_PRESENTATION_DEFINITION.id;

      testPresentationSubmission.descriptor_map.push({
        format: vpFormat,
        id: LEDGER_INVOKE_PRESENTATION_DEFINITION.input_descriptors[0].id,
        path: "$",
        path_nested: {
          format: vcFormat,
          id: LEDGER_INVOKE_PRESENTATION_DEFINITION.input_descriptors[0].id,
          path: "$.vp.verifiableCredential[0]",
        },
      });

      break;
    }
    case TIMESTAMP_WRITE_SCOPE: {
      testPresentationSubmission.definition_id =
        TIMESTAMP_WRITE_PRESENTATION_DEFINITION.id;

      break;
    }
    case TIR_INVITE_SCOPE: {
      testPresentationSubmission.definition_id =
        TIR_INVITE_PRESENTATION_DEFINITION.id;

      testPresentationSubmission.descriptor_map.push({
        format: vpFormat,
        id: TIR_INVITE_PRESENTATION_DEFINITION.input_descriptors[0].id,
        path: "$",
        path_nested: {
          format: vcFormat,
          id: TIR_INVITE_PRESENTATION_DEFINITION.input_descriptors[0].id,
          path: "$.vp.verifiableCredential[0]",
        },
      });

      break;
    }
    case TIR_WRITE_SCOPE: {
      testPresentationSubmission.definition_id =
        TIR_WRITE_PRESENTATION_DEFINITION.id;

      break;
    }
    case TNT_AUTHORISE_SCOPE: {
      testPresentationSubmission.definition_id =
        TNT_AUTHORISE_PRESENTATION_DEFINITION.id;

      testPresentationSubmission.descriptor_map.push({
        format: vpFormat,
        id: TNT_AUTHORISE_PRESENTATION_DEFINITION.input_descriptors[0].id,
        path: "$",
        path_nested: {
          format: vcFormat,
          id: TNT_AUTHORISE_PRESENTATION_DEFINITION.input_descriptors[0].id,
          path: "$.vp.verifiableCredential[0]",
        },
      });

      break;
    }
    case TNT_CREATE_SCOPE: {
      testPresentationSubmission.definition_id =
        TNT_CREATE_PRESENTATION_DEFINITION.id;

      break;
    }
    case TNT_WRITE_SCOPE: {
      testPresentationSubmission.definition_id =
        TNT_WRITE_PRESENTATION_DEFINITION.id;

      break;
    }
    case TPR_WRITE_SCOPE: {
      testPresentationSubmission.definition_id =
        TPR_WRITE_PRESENTATION_DEFINITION.id;

      break;
    }
    case TSR_WRITE_SCOPE: {
      testPresentationSubmission.definition_id =
        TSR_WRITE_PRESENTATION_DEFINITION.id;

      break;
    }
    default: {
      throw new Error("Invalid scope");
    }
  }

  return testPresentationSubmission;
}
