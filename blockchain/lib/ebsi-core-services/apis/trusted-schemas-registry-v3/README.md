![EBSI Logo](https://ec.europa.eu/digital-building-blocks/wikis/images/logo/default-space-logo.svg)

# Trusted Schemas Registry API

Trusted Schemas Registry (TSR) API is an EBSI core service. It enables us to interact with the Trusted Schemas Registry Smart Contract to:

- register a new schema
- update a registered schema
- read and validate registered schemas

EBSI Trusted Schemas Registry is a Domain Specific registry service focusing on registering in it only Data Model and Ontology. The registry is agnostic of any type of schema (we support whatever scheme the consumer needs to anchor, being it JSON, JSON-LD, XML...).

TSR API is a microservice, hosted on the EBSI infrastructure.

## Service configuration

Create a `.env.default.local` file locally. You can duplicate the content of `.env.default` or only set the necessary variables.
