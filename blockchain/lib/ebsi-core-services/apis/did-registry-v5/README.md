![EBSI Logo](https://ec.europa.eu/digital-building-blocks/wikis/images/logo/default-space-logo.svg)

# DID Registry API

DID Registry is a generic core service of the EBSI platform providing the capability of resolving EBSI Decentralised Identifiers (DIDs).

It enables consumers to interact with the DID Registry Smart Contract to:

- Insert a DID/DID document
- Update a DID document
- Revoke a DID/DID Controlling keys
- Resolve a DID (and obtain a DID document)
- Resolve a version of a DID document at a certain point in time

## Service configuration

Create a `.env.default.local` file locally. You can duplicate the content of `.env.default` or only set the necessary variables.
