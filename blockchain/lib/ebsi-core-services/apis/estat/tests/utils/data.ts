import { ethers } from "ethers";
/**
 * Collection of functions for generating fake data to be used in the tests.
 */
import { randomBytes } from "node:crypto";

export interface TestDocument {
  didEbsiCreator: string;
  documentHash: string;
  documentMetadata: string;
  events: TestDocumentEvent[];
  timestamp: {
    datetime: string;
    proof: string;
  };
}

export interface TestDocumentEvent {
  documentHash: string;
  eventHash: string;
  externalHash: string;
  metadata: string;
  origin: string;
  sender: string;
  timestamp: {
    datetime: string;
    proof: string;
  };
}

export function createDocument(
  didEbsiCreator: string,
  externalSource = false,
): TestDocument {
  const documentHash = ethers.sha256(randomBytes(32));
  const documentMetadata = "metadata";

  return {
    didEbsiCreator,
    documentHash,
    documentMetadata,
    events: [],
    ...(externalSource
      ? {
          timestamp: {
            datetime: ethers.toBeHex(Date.now()),
            proof: ethers.sha256(randomBytes(32)),
          },
        }
      : {
          timestamp: {
            datetime: "0x00",
            proof: "0x00",
          },
        }),
  };
}

export function createEvent(
  documentHash: string,
  didEbsiCreator: string,
): TestDocumentEvent {
  const externalHash = `externalHash${randomBytes(5).toString("hex")}`;
  const eventHash = ethers.keccak256(ethers.toUtf8Bytes(externalHash));
  const origin = "origin";
  const metadata = "eventMetadata";
  const sender = didEbsiCreator;

  const event = {
    documentHash,
    eventHash,
    externalHash,
    metadata,
    origin,
    sender,
    timestamp: {
      datetime: "0x00",
      proof: "0x00",
    },
  };

  return event;
}
