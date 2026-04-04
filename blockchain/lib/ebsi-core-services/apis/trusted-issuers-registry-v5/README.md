![EBSI Logo](https://ec.europa.eu/digital-building-blocks/wikis/images/logo/default-space-logo.svg)

# Trusted Issuers Registry

Trusted Issuers Registry (TIR) is a generic decentralised registry holding information about trusted issuers, like public information, accreditations and other. All information is stored in the smart contract in form of Attribute envelops (like Verifiable Credentials) that are issued by Trusted Issuers or self-issued. Generic Envelop (like Verifiable Credential) validation is performed outside EBSI.

EBSI Trusted Issuers Registry (TIR) is a core EBSI service that enables validation of identities and accreditations of Trusted Issuers.

TIR smart contract is deployed on the permissioned EBSI ledger that has the advantages of being public while at the same time ensuring the highest level of trust and transparency. Furthermore, TIR has high availability due to the redundancy of the EBSI Ledger; has no single point of failure; is transparent, traceable, immutable and cryptographically secure. The immutable nature of the ledger enables one to validate whether an issuer was eligible to issue a specific Verifiable Credential/Claim/Attestation at a certain time.

The TIR service consists of a smart contract (TIR SC) and API (TIR API). The TIR SC is an Ethereum SC is deployed on the EBSI ledger. All public smart contract methods are exposed via APIs. Two types of APIs are delivered, JSON-RPC for write and REST for the read operations. The TIR API enables to manage and verify Trusted Issuers information and accreditations. Accreditation of trusted issuers domain-specific and is outside the EBSI scope.

For more information, see:

- [TIR API Technical Specifications](https://ec.europa.eu/digital-building-blocks/wikis/x/S4iWFQ)
- [TIR Smart Contract Technical Specifications](https://ec.europa.eu/digital-building-blocks/wikis/x/tYiWFQ)
- API catalogs:
  - [EBSI Pilot network API Catalog](https://api-pilot.ebsi.eu/docs/apis)
  - [EBSI Conformance network API Catalog](https://api-conformance.ebsi.eu/docs/apis)

## Service configuration

Create a `.env.default.local` file locally. You can duplicate the content of `.env.default` or only set the necessary variables.
