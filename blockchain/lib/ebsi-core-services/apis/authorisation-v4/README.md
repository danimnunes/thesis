![EBSI Logo](https://ec.europa.eu/digital-building-blocks/wikis/images/logo/default-space-logo.svg)

# Authorisation API

The Authorisation API is a core EBSI service responsible to issue Short Term Access Tokens (JWS) to the EBSI Platform for entities (Natural Persons, Legal Entities) and trusted Applications (EBSI or third-party applications) in exchange of their presentation of a long term EBSI Verifiable Authorisation credential, plus their authentication/identification. Access tokens are required by entities and applications to access the protected resources of EBSI.

Users receive access tokens after they present a valid EBSI Verifiable Authorisation credential and prove ownership over their DID.

Trusted Applications receive access tokens if they are well registered in the Trusted Apps Registry (application public keys are listed), are authorised there to access the requested protected resources, and successfully prove their private key ownership. We implement the Authenticated Key Exchange cryptographic identification protocol.

For more information, see:

- [Technical Specifications](https://ec.europa.eu/digital-building-blocks/wikis/x/aoiWFQ)
- API catalogs:
  - [EBSI Pilot network API Catalog](https://api-pilot.ebsi.eu/docs/apis)
  - [EBSI Conformance network API Catalog](https://api-conformance.ebsi.eu/docs/apis)

## Service configuration

Create a `.env.default.local` file locally. You can duplicate the content of `.env.default` or only set the necessary variables.
