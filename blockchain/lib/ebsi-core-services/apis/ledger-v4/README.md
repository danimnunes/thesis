![EBSI Logo](https://ec.europa.eu/digital-building-blocks/wikis/images/logo/default-space-logo.svg)

# Ledger API

This repository contains the code of the EBSI Ledger API.

Ledger API service gives use case applications access to all the available blockchain protocol interfaces and capabilities provided by the ledger nodes software running on MS hosted nodes.

The Ledger API is a Core Service of the EBSI platform providing access to the EBSI Ledger Protocol(s) and Smart Contracts services running at the lower layer Chain & Storage.

EBSI V2 Ledger API provides capabilities to interact (Read and Write) with Hyperledger Besu.

As a general principle, only EBSI core service API, acting as JSON-RPC proxy for the end-users can have access to the Ledger API JSON RPC Proxy, meaning end-users have no direct access to the EBSI Ledgers clients software running on MS nodes.

For more information, see:

- [Technical Specifications](https://ec.europa.eu/digital-building-blocks/wikis/x/V4iWFQ)
- API catalogs:
  - [EBSI Pilot network API Catalog](https://hub.ebsi.eu/apis/pilot)
  - [EBSI Conformance network API Catalog](https://hub.ebsi.eu/apis/conformance)

## Service configuration

Create a `.env.default.local` file locally. You can duplicate the content of `.env.default` or only set the necessary variables.
