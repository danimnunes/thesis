![EBSI Logo](https://ec.europa.eu/digital-building-blocks/wikis/images/logo/default-space-logo.svg)

# Track and Trace

Track and Trace (TnT) will create Proof of Origin with the following capabilities.

- Proof of Origin
  - Aggregation of Events (partial proofs) of: by who, on behalf of, what, and when
- Built in access management for `did:key` and `did:ebsi`

The Smart Contract will be made with abstract model, thus it will fit different models and uses. EUIPO will use the service to track shipments, while enabling third parties to trace the events of particular shipment. The TnT will be done hashes, thus it doesn't enable data repositories, but it enables the Proof of Origin for track and trace purposes as long as you know what you would like to prove.

For more information, see:

- [RFC - Track and Trace Smart Contract and API](https://ec.europa.eu/digital-building-blocks/wikis/display/BLOCKCHAININT/RFC+-+Track+and+Trace+Smart+Contract+and+API)

## Service configuration

Create a `.env.default.local` file locally. You can duplicate the content of `.env.default` or only set the necessary variables.
