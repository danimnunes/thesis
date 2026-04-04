import type { JSONSchema } from "@apidevtools/json-schema-ref-parser";

import { EbsiWallet } from "@europeum-ebsi/wallet-lib";
import crypto from "node:crypto";

export const createDid = (): string => EbsiWallet.createDid();

export const createSchema = () =>
  ({
    $schema: "http://json-schema.org/draft-07/schema#",
    description: "Schema of an EBSI Verifiable Attestation",
    properties: {
      "@context": {
        description: "Defines semantic context of the Verifiable Attestation",
        items: {
          format: "uri",
          type: "string",
        },
        type: "array",
      },
      credentialSchema: {
        description:
          "Contains information about the credential schema (template) on which the Verifiable Authorisation is based",
        properties: {
          id: {
            description:
              "References the credential schema (template) stored on the (relevant) Trusted Schemas Registry (TSR) on which the Verifiable Authorisation is based",
            format: "uri",
            type: "string",
          },
          type: {
            description: "Defines credential schema type",
            enum: ["FullJsonSchemaValidator2021"],
            type: "string",
          },
        },
        required: ["id", "type"],
        type: "object",
      },
      credentialStatus: {
        description:
          "Contains information about how to verify the status of the Verifiable Attestation (via the Revocation and Endorsement Registry, RER)",
        properties: {
          id: {
            description:
              "References record in the Revocation and Endorsement Registry (RER) to enable verification of a Verifiable Attestation’s validity",
            format: "uri",
            type: "string",
          },
          type: {
            description: "Defines the Verifiable Credential status type",
            type: "string",
          },
        },
        required: ["id", "type"],
        type: "object",
      },
      credentialSubject: {
        [`${crypto.randomBytes(16).toString("hex")}`]: {
          description: "Random property",
          type: "string",
        },
        description:
          "Defines information about the subject that is described by the Verifiable Attestation",
        properties: {
          id: {
            description:
              "Defines the DID of the subject that is described by the Verifiable Attestation",
            format: "uri",
            type: "string",
          },
        },
        type: "object",
      },
      evidence: {
        description:
          "Contains information about the process which resulted in the issuance of the Verifiable Attestation",
        items: {
          properties: {
            documentPresence: {
              description:
                "Defines how the document(s) which have been verified before Verifiable Attestation issuance have been provided (e.g. physically, digitally)",
              items: {
                type: "string",
              },
              type: "array",
            },
            evidenceDocument: {
              description:
                "Defines document(s) which have been verified before Verifiable Attestation issuance",
              items: {
                type: "string",
              },
              type: "array",
            },
            id: {
              description:
                "If present, it MUST contain a URL that points to where more information about this instance of evidence can be found.",
              type: "string",
            },
            subjectPresence: {
              description:
                "Defines if the Verifiable Attestation subject was physically present in the course of the verification",
              type: "string",
            },
            type: {
              description: "Defines the evidence type",
              items: {
                type: "string",
              },
              type: "array",
            },
            verifier: {
              description:
                "Defines entity which has verified documents before Verifiable Attestation issuance",
              type: "string",
            },
          },
          required: [
            "type",
            "verifier",
            "evidenceDocument",
            "subjectPresence",
            "documentPresence",
          ],
          type: "object",
        },
        type: "array",
      },
      expirationDate: {
        description:
          "Defines the date and time, when the Verifiable Attestation expires",
        format: "date-time",
        type: "string",
      },
      id: {
        description: "Defines unique identifier of the Verifiable Attestation",
        format: "uri",
        type: "string",
      },
      issuanceDate: {
        description:
          "Defines the date and time, when the Verifiable Attestation becomes valid",
        format: "date-time",
        type: "string",
      },
      issued: {
        description: "Defines when the Verifiable Attestation was issued",
        format: "date-time",
        type: "string",
      },
      issuer: {
        description: "Defines the issuer of the Verifiable Attestation",
        format: "uri",
        type: "string",
      },
      proof: {
        description: "Contains information about the proof",
        properties: {
          created: {
            description:
              "Defines the date and time, when the proof has been created",
            format: "date-time",
            type: "string",
          },
          jws: {
            description: "Defines the proof value in JWS format",
            type: "string",
          },
          proofPurpose: {
            description: "Defines the purpose of the proof",
            type: "string",
          },
          type: {
            description: "Defines the proof type",
            type: "string",
          },
          verificationMethod: {
            description:
              "Contains information about the verification method / proof mechanisms",
            type: "string",
          },
        },
        required: [
          "type",
          "proofPurpose",
          "created",
          "verificationMethod",
          "jws",
        ],
        type: "object",
      },
      type: {
        description: "Defines the Verifiable Credential type",
        items: {
          type: "string",
        },
        type: "array",
      },
      validFrom: {
        description:
          "Defines the date and time, when the Verifiable Attestation becomes valid",
        format: "date-time",
        type: "string",
      },
    },
    required: [
      "@context",
      "id",
      "type",
      "issuer",
      "issuanceDate",
      "validFrom",
      "issued",
      "credentialSubject",
      "credentialSchema",
    ],
    title: "EBSI Verifiable Attestation",
    type: "object",
  }) satisfies JSONSchema;

export const createVerifiableAuthorisationSchema = (ref: string) =>
  ({
    $schema: "http://json-schema.org/draft-07/schema#",
    allOf: [
      {
        $ref: ref,
      },
      {
        properties: {
          credentialSubject: {
            description:
              "Defines additional information about the subject that is described by the Verifiable Authorisation",
            properties: {
              [`${crypto.randomBytes(16).toString("hex")}`]: {
                description: "Random property",
                type: "string",
              },
              currentAddress: {
                description:
                  "Defines the current address of the credential subject",
                type: "string",
              },
              dateOfBirth: {
                description: "Defines date of birth of the credential subject",
                format: "date",
                type: "string",
              },
              familyName: {
                description:
                  "Defines current family name(s) of the credential subject",
                type: "string",
              },
              firstName: {
                description:
                  "Defines current first name(s) of the credential subject",
                type: "string",
              },
              gender: {
                description: "Defines the gender of the credential subject",
                type: "string",
              },
              id: {
                description:
                  "Defines the DID of the subject that is described by the Verifiable Attestation",
                format: "uri",
                type: "string",
              },
              nameAndFamilyNameAtBirth: {
                description:
                  "Defines the first and the family name(s) of the credential subject at the time of their birth",
                type: "string",
              },
              personalIdentifier: {
                description:
                  "Defines the unique national identifier of the credential subject (constructed by the sending Member State in accordance with the technical specifications for the purposes of cross-border identification and which is as persistent as possible in time)",
                type: "string",
              },
              placeOfBirth: {
                description:
                  "Defines the place where the credential subject is born",
                type: "string",
              },
            },
            required: ["id"],
            type: "object",
          },
        },
      },
    ],
    description: "Schema of an EBSI Verifiable Authorisation",
    required: [
      "@context",
      "id",
      "type",
      "issuer",
      "issuanceDate",
      "validFrom",
      "credentialSubject",
      "credentialSchema",
    ],
    title: "EBSI Verifiable Authorisation",
    type: "object",
  }) satisfies JSONSchema;
