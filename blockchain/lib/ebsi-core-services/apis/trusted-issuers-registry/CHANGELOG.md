# Changelog

## 3.0.0-rc.14

### Minor Changes

- [426cf3113318345473cfdfc9da7102820e613a08](https://gitlab.com/europeum/public/core-services/-/commit/426cf3113318345473cfdfc9da7102820e613a08): Decommission API.

### Patch Changes

- [0b2fc67ae0f01006cd8de8a6c4fe09e1c4273a89](https://gitlab.com/europeum/public/core-services/-/commit/0b2fc67ae0f01006cd8de8a6c4fe09e1c4273a89): Bump dependencies.
- [e42337f296ad7ca356852fd572d700885815a4b3](https://gitlab.com/europeum/public/core-services/-/commit/e42337f296ad7ca356852fd572d700885815a4b3): Reject requests when query parameter is not supported
- [426cf3113318345473cfdfc9da7102820e613a08](https://gitlab.com/europeum/public/core-services/-/commit/426cf3113318345473cfdfc9da7102820e613a08): Bump dependencies.
- [6314280d6e274c381e67008b5c2960ad4ce7e757](https://gitlab.com/europeum/public/core-services/-/commit/6314280d6e274c381e67008b5c2960ad4ce7e757): Add the possibility to disable the LoggingInterceptor for specific endpoints.

## 3.0.0-rc.13

### Minor Changes

- [9c3dba3e038d65e5970171ce242a8e7b93c2970f](https://gitlab.com/europeum/public/core-services/-/commit/9c3dba3e038d65e5970171ce242a8e7b93c2970f): Support EBSI URI scheme in Core Services.

### Patch Changes

- [7a4068e0d9804be6295aedec7e610cbc253cb03e](https://gitlab.com/europeum/public/core-services/-/commit/7a4068e0d9804be6295aedec7e610cbc253cb03e): Update Node.js to v20.14.0
- [90b8973cbf68a6e6d34ba2a79ce8469f34eaa5c4](https://gitlab.com/europeum/public/core-services/-/commit/90b8973cbf68a6e6d34ba2a79ce8469f34eaa5c4): Catch error for malformed uri
- [8993a31a472a9ad2a59dbc2999f20e863f4c581d](https://gitlab.com/europeum/public/core-services/-/commit/8993a31a472a9ad2a59dbc2999f20e863f4c581d): Bump VC and VP libraries.
- [f29c5faec44fff1e960986d51bc4b0f60c61cb8c](https://gitlab.com/europeum/public/core-services/-/commit/f29c5faec44fff1e960986d51bc4b0f60c61cb8c): Connect to Besu directly.
- [651235bffbb0168f18ff4631b750103de7312477](https://gitlab.com/europeum/public/core-services/-/commit/651235bffbb0168f18ff4631b750103de7312477): Refactor Axios error logging.
- [f2b00c7ff4f00ee5186bca56f8c036e0ef73099a](https://gitlab.com/europeum/public/core-services/-/commit/f2b00c7ff4f00ee5186bca56f8c036e0ef73099a): Log errors in `sendTransaction`.
- [4c4d31138e5ba5c9cedd3e598a0017b90335119e](https://gitlab.com/europeum/public/core-services/-/commit/4c4d31138e5ba5c9cedd3e598a0017b90335119e): Refactor Axios error logging.
- [712daf23f46f3010ee81970e532b3ec4deb34d4f](https://gitlab.com/europeum/public/core-services/-/commit/712daf23f46f3010ee81970e532b3ec4deb34d4f): Catch error when verifying if DID is controlled by address
- [50694cacbd827eeefecbcd2cc765b5660083cccd](https://gitlab.com/europeum/public/core-services/-/commit/50694cacbd827eeefecbcd2cc765b5660083cccd): Check Besu readiness in health check.
- [4c68d45d647735cefa90e5545ff1b5b0c89703ae](https://gitlab.com/europeum/public/core-services/-/commit/4c68d45d647735cefa90e5545ff1b5b0c89703ae): Do not return "EBSI-Image-Tag" header anymore.
- [6a80f5defa229fa1700bc9a0687d0215b0cff838](https://gitlab.com/europeum/public/core-services/-/commit/6a80f5defa229fa1700bc9a0687d0215b0cff838): Fix validator.js imports.
- [e7308c9cdb1eccbedd0b23b7d5885be6fa97c9c9](https://gitlab.com/europeum/public/core-services/-/commit/e7308c9cdb1eccbedd0b23b7d5885be6fa97c9c9): Make the validation of an issuer's proxy stricter.
- [917370b20c6efe84f3f7c7128dfdb2a7a5457c81](https://gitlab.com/europeum/public/core-services/-/commit/917370b20c6efe84f3f7c7128dfdb2a7a5457c81): Bump dependencies and upgrade Node.js to v20.16.0.
- Updated dependencies [90b8973cbf68a6e6d34ba2a79ce8469f34eaa5c4](https://gitlab.com/europeum/public/core-services/-/commit/90b8973cbf68a6e6d34ba2a79ce8469f34eaa5c4)
- Updated dependencies [8993a31a472a9ad2a59dbc2999f20e863f4c581d](https://gitlab.com/europeum/public/core-services/-/commit/8993a31a472a9ad2a59dbc2999f20e863f4c581d)
- Updated dependencies [9c3dba3e038d65e5970171ce242a8e7b93c2970f](https://gitlab.com/europeum/public/core-services/-/commit/9c3dba3e038d65e5970171ce242a8e7b93c2970f)
- Updated dependencies [651235bffbb0168f18ff4631b750103de7312477](https://gitlab.com/europeum/public/core-services/-/commit/651235bffbb0168f18ff4631b750103de7312477)
- Updated dependencies [4c4d31138e5ba5c9cedd3e598a0017b90335119e](https://gitlab.com/europeum/public/core-services/-/commit/4c4d31138e5ba5c9cedd3e598a0017b90335119e)
- Updated dependencies [917370b20c6efe84f3f7c7128dfdb2a7a5457c81](https://gitlab.com/europeum/public/core-services/-/commit/917370b20c6efe84f3f7c7128dfdb2a7a5457c81)
  - @ebsiint-api/shared@1.1.0-rc.10
  - @ebsiint-sc/trusted-issuers-registry@2.0.0-rc.8

## 3.0.0-rc.12

### Patch Changes

- [d3a4a64a16df2bbeec587aadbf7bb5c02c577316](https://gitlab.com/europeum/public/core-services/-/commit/d3a4a64a16df2bbeec587aadbf7bb5c02c577316): Bump VC and VP libraries.
- [c66c349218fe427cfa59df0973b987ce14bbec09](https://gitlab.com/europeum/public/core-services/-/commit/c66c349218fe427cfa59df0973b987ce14bbec09): Support VC with credentialStatus as an array.
- Updated dependencies [d3a4a64a16df2bbeec587aadbf7bb5c02c577316](https://gitlab.com/europeum/public/core-services/-/commit/d3a4a64a16df2bbeec587aadbf7bb5c02c577316)
- Updated dependencies [c66c349218fe427cfa59df0973b987ce14bbec09](https://gitlab.com/europeum/public/core-services/-/commit/c66c349218fe427cfa59df0973b987ce14bbec09)
  - @ebsiint-api/shared@1.1.0-rc.9

## 3.0.0-rc.11

### Patch Changes

- [b8b8b09c11f84e7809fdea74f93167141eb3916e](https://gitlab.com/europeum/public/core-services/-/commit/b8b8b09c11f84e7809fdea74f93167141eb3916e): Verify if the credentials are valid at the current time.
- [713311de4a45a79c4059b58bb42bf2e258205aac](https://gitlab.com/europeum/public/core-services/-/commit/713311de4a45a79c4059b58bb42bf2e258205aac): Validate dates of credentials linked in termsOfUse
- Updated dependencies [b8b8b09c11f84e7809fdea74f93167141eb3916e](https://gitlab.com/europeum/public/core-services/-/commit/b8b8b09c11f84e7809fdea74f93167141eb3916e)
- Updated dependencies [713311de4a45a79c4059b58bb42bf2e258205aac](https://gitlab.com/europeum/public/core-services/-/commit/713311de4a45a79c4059b58bb42bf2e258205aac)
  - @ebsiint-api/shared@1.1.0-rc.8

## 3.0.0-rc.10

### Minor Changes

- [520038797ef25f4c8ac19150274b8a5368175dfc](https://gitlab.com/europeum/public/core-services/-/commit/520038797ef25f4c8ac19150274b8a5368175dfc): Bump VC and VP libraries, support `JsonSchema` credential schema type.

### Patch Changes

- [a9c5aae4bcd176080f27498816ea8a55081cb84a](https://gitlab.com/europeum/public/core-services/-/commit/a9c5aae4bcd176080f27498816ea8a55081cb84a): Fix JSON-RPC request parameters validation. Ensure that hexadecimal strings are prefixed with "0x".
- [1960638f1c5cce829eae0535733d0714632d8841](https://gitlab.com/europeum/public/core-services/-/commit/1960638f1c5cce829eae0535733d0714632d8841): Bump dependencies.
- [1960638f1c5cce829eae0535733d0714632d8841](https://gitlab.com/europeum/public/core-services/-/commit/1960638f1c5cce829eae0535733d0714632d8841): Bump jose to v4.15.5, fix CVE-2024-28176.
- [ddfc40a1f21fae1498059618e71bf1f2e9271ee8](https://gitlab.com/europeum/public/core-services/-/commit/ddfc40a1f21fae1498059618e71bf1f2e9271ee8): Bump VC and VP libraries.
- [e5e5cd041db2e6c9670a596d7526d0e7159efcc5](https://gitlab.com/europeum/public/core-services/-/commit/e5e5cd041db2e6c9670a596d7526d0e7159efcc5): Bump dependencies.
- [85e2c4cd45daea5e75d1f68484a0a062348068e0](https://gitlab.com/europeum/public/core-services/-/commit/85e2c4cd45daea5e75d1f68484a0a062348068e0): Do not log requests made by the EBSI healthcheck service.
- Updated dependencies [82e12c8c38442379aadb957fee5ec8ca4fea4fac](https://gitlab.com/europeum/public/core-services/-/commit/82e12c8c38442379aadb957fee5ec8ca4fea4fac)
- Updated dependencies [3900b6f7697df366effd4110dc1827b6c36c169f](https://gitlab.com/europeum/public/core-services/-/commit/3900b6f7697df366effd4110dc1827b6c36c169f)
- Updated dependencies [1960638f1c5cce829eae0535733d0714632d8841](https://gitlab.com/europeum/public/core-services/-/commit/1960638f1c5cce829eae0535733d0714632d8841)
- Updated dependencies [1960638f1c5cce829eae0535733d0714632d8841](https://gitlab.com/europeum/public/core-services/-/commit/1960638f1c5cce829eae0535733d0714632d8841)
- Updated dependencies [ddfc40a1f21fae1498059618e71bf1f2e9271ee8](https://gitlab.com/europeum/public/core-services/-/commit/ddfc40a1f21fae1498059618e71bf1f2e9271ee8)
- Updated dependencies [520038797ef25f4c8ac19150274b8a5368175dfc](https://gitlab.com/europeum/public/core-services/-/commit/520038797ef25f4c8ac19150274b8a5368175dfc)
- Updated dependencies [e5e5cd041db2e6c9670a596d7526d0e7159efcc5](https://gitlab.com/europeum/public/core-services/-/commit/e5e5cd041db2e6c9670a596d7526d0e7159efcc5)
  - @ebsiint-api/shared@1.1.0-rc.7
  - @ebsiint-sc/trusted-issuers-registry@2.0.0-rc.7

## 3.0.0-rc.9

### Patch Changes

- [48b06089e979a20d1ca3df1be08ac614e5b6856e](https://gitlab.com/europeum/public/core-services/-/commit/48b06089e979a20d1ca3df1be08ac614e5b6856e): Bump dependencies, support Verifiable Attestation 2024-01 schema.
- [99abef34ed7e8a91e3335e712173a45027f9277e](https://gitlab.com/europeum/public/core-services/-/commit/99abef34ed7e8a91e3335e712173a45027f9277e): Update VC and VP libraries.
- [733354a1d2e4e6a18a9a834a96b7b9a4eb321060](https://gitlab.com/europeum/public/core-services/-/commit/733354a1d2e4e6a18a9a834a96b7b9a4eb321060): Bump dependencies, update Node.js to v20.11.0.
- [fe81418ed2d3d8759944423997e4371fff61e348](https://gitlab.com/europeum/public/core-services/-/commit/fe81418ed2d3d8759944423997e4371fff61e348): Setup axios agents with `keepAlive: true`.
- [de238473eb36b1f275866c848e945e9417e917e3](https://gitlab.com/europeum/public/core-services/-/commit/de238473eb36b1f275866c848e945e9417e917e3): Initialize LedgerService only once.
- [f84767e4aedf5c103d6aad87f81c3708ad915e73](https://gitlab.com/europeum/public/core-services/-/commit/f84767e4aedf5c103d6aad87f81c3708ad915e73): Bump dependencies.
- [79dc01786e983e02373501ec858f4897d8ae3680](https://gitlab.com/europeum/public/core-services/-/commit/79dc01786e983e02373501ec858f4897d8ae3680): Return more detailed error when Ajv validation fails.
- Updated dependencies [61fffd7ccdb3e8aa20dfe2ea6e546b3784a9adcd](https://gitlab.com/europeum/public/core-services/-/commit/61fffd7ccdb3e8aa20dfe2ea6e546b3784a9adcd)
- Updated dependencies [5c6c9e9227b705958af5a1869ddfbdbe237d6262](https://gitlab.com/europeum/public/core-services/-/commit/5c6c9e9227b705958af5a1869ddfbdbe237d6262)
- Updated dependencies [48b06089e979a20d1ca3df1be08ac614e5b6856e](https://gitlab.com/europeum/public/core-services/-/commit/48b06089e979a20d1ca3df1be08ac614e5b6856e)
- Updated dependencies [99abef34ed7e8a91e3335e712173a45027f9277e](https://gitlab.com/europeum/public/core-services/-/commit/99abef34ed7e8a91e3335e712173a45027f9277e)
- Updated dependencies [733354a1d2e4e6a18a9a834a96b7b9a4eb321060](https://gitlab.com/europeum/public/core-services/-/commit/733354a1d2e4e6a18a9a834a96b7b9a4eb321060)
- Updated dependencies [fe81418ed2d3d8759944423997e4371fff61e348](https://gitlab.com/europeum/public/core-services/-/commit/fe81418ed2d3d8759944423997e4371fff61e348)
- Updated dependencies [f84767e4aedf5c103d6aad87f81c3708ad915e73](https://gitlab.com/europeum/public/core-services/-/commit/f84767e4aedf5c103d6aad87f81c3708ad915e73)
- Updated dependencies [79dc01786e983e02373501ec858f4897d8ae3680](https://gitlab.com/europeum/public/core-services/-/commit/79dc01786e983e02373501ec858f4897d8ae3680)
  - @ebsiint-api/shared@1.1.0-rc.6
  - @ebsiint-sc/trusted-issuers-registry@2.0.0-rc.6

## 3.0.0-rc.8

### Patch Changes

- [f3024ac17c5031e011757bbf4e52700943842ba0](https://gitlab.com/europeum/public/core-services/-/commit/f3024ac17c5031e011757bbf4e52700943842ba0): Upgrade Node.js to v18 and bump dependencies.
- [2de71cb9cf78177e0f60ab150571d03f12d4ab57](https://gitlab.com/europeum/public/core-services/-/commit/2de71cb9cf78177e0f60ab150571d03f12d4ab57): Bump dependencies.
- [ca9544d2978218570fcdf58e57de8144317fc5c8](https://gitlab.com/europeum/public/core-services/-/commit/ca9544d2978218570fcdf58e57de8144317fc5c8): Update Node.js to v20.9.0 (LTS).
- [98b9d3eafb00d634e67a949689a883b63578535a](https://gitlab.com/europeum/public/core-services/-/commit/98b9d3eafb00d634e67a949689a883b63578535a): Fix onApplicationBootstrap hook.
- [e69bbf27731eaeeedb149b4d155a0b2cc9366aa8](https://gitlab.com/europeum/public/core-services/-/commit/e69bbf27731eaeeedb149b4d155a0b2cc9366aa8): Refactor service's health check.
- [a82cf5865669f7fd184a0bf000573856e85c9837](https://gitlab.com/europeum/public/core-services/-/commit/a82cf5865669f7fd184a0bf000573856e85c9837): Bump dependencies.
- [4fa0f0414daebd2e721434108ee63f7b5802abe9](https://gitlab.com/europeum/public/core-services/-/commit/4fa0f0414daebd2e721434108ee63f7b5802abe9): Bump dependencies and update Node.js to v20.10.0.
- Updated dependencies [f3024ac17c5031e011757bbf4e52700943842ba0](https://gitlab.com/europeum/public/core-services/-/commit/f3024ac17c5031e011757bbf4e52700943842ba0)
- Updated dependencies [2de71cb9cf78177e0f60ab150571d03f12d4ab57](https://gitlab.com/europeum/public/core-services/-/commit/2de71cb9cf78177e0f60ab150571d03f12d4ab57)
- Updated dependencies [ca9544d2978218570fcdf58e57de8144317fc5c8](https://gitlab.com/europeum/public/core-services/-/commit/ca9544d2978218570fcdf58e57de8144317fc5c8)
- Updated dependencies [e69bbf27731eaeeedb149b4d155a0b2cc9366aa8](https://gitlab.com/europeum/public/core-services/-/commit/e69bbf27731eaeeedb149b4d155a0b2cc9366aa8)
- Updated dependencies [a82cf5865669f7fd184a0bf000573856e85c9837](https://gitlab.com/europeum/public/core-services/-/commit/a82cf5865669f7fd184a0bf000573856e85c9837)
- Updated dependencies [4fa0f0414daebd2e721434108ee63f7b5802abe9](https://gitlab.com/europeum/public/core-services/-/commit/4fa0f0414daebd2e721434108ee63f7b5802abe9)
  - @ebsiint-sc/trusted-issuers-registry@2.0.0-rc.5
  - @ebsiint-api/shared@1.1.0-rc.5

## 3.0.0-rc.7

### Minor Changes

- [91470e6d](https://gitlab.com/europeum/public/core-services/-/commit/91470e6d): Fixed blockscout E2E errors

### Patch Changes

- [d5a179ce](https://gitlab.com/europeum/public/core-services/-/commit/d5a179ce): Bump VC and VP libraries.
- [b8b79ac3](https://gitlab.com/europeum/public/core-services/-/commit/b8b79ac3): New smart contracts after the audit
- Updated dependencies [d5a179ce](https://gitlab.com/europeum/public/core-services/-/commit/d5a179ce)
- Updated dependencies [b8b79ac3](https://gitlab.com/europeum/public/core-services/-/commit/b8b79ac3)
- Updated dependencies [915b2da7](https://gitlab.com/europeum/public/core-services/-/commit/915b2da7)
  - @ebsiint-api/shared@1.1.0-rc.4
  - @ebsiint-sc/trusted-issuers-registry@2.0.0-rc.4

## 3.0.0-rc.6

### Minor Changes

- [38b9d313](https://gitlab.com/europeum/public/core-services/-/commit/38b9d313): Support custom trusted hostnames.

### Patch Changes

- [f0d3dde3](https://gitlab.com/europeum/public/core-services/-/commit/f0d3dde3): Improve error handling
- [f520c43a](https://gitlab.com/europeum/public/core-services/-/commit/f520c43a): Bump dependencies and update Node.js to v16.20.1
- [07e3176d](https://gitlab.com/europeum/public/core-services/-/commit/07e3176d): Loosen status list credential type checking.
- Updated dependencies [f0d3dde3](https://gitlab.com/europeum/public/core-services/-/commit/f0d3dde3)
- Updated dependencies [38b9d313](https://gitlab.com/europeum/public/core-services/-/commit/38b9d313)
- Updated dependencies [f520c43a](https://gitlab.com/europeum/public/core-services/-/commit/f520c43a)
- Updated dependencies [07e3176d](https://gitlab.com/europeum/public/core-services/-/commit/07e3176d)
  - @ebsiint-api/shared@1.1.0-rc.3
  - @ebsiint-sc/trusted-issuers-registry@4.0.0-rc.3

## 3.0.0-rc.5

### Minor Changes

- [70631f93](https://gitlab.com/europeum/public/core-services/-/commit/70631f93): bump VC/VP libraries

### Patch Changes

- [2966fa3c](https://gitlab.com/europeum/public/core-services/-/commit/2966fa3c): Expose service OpenAPI specification
- [443664aa](https://gitlab.com/europeum/public/core-services/-/commit/443664aa): Bump EBSI libraries.
- [357775c1](https://gitlab.com/europeum/public/core-services/-/commit/357775c1): Fix vulnerabilities related to the Docker image.
- [1fb98741](https://gitlab.com/europeum/public/core-services/-/commit/1fb98741): Bump dependencies.
- [8a245129](https://gitlab.com/europeum/public/core-services/-/commit/8a245129): Bump EBSI libraries.
- [44412117](https://gitlab.com/europeum/public/core-services/-/commit/44412117): Prevent connecting multiple times to Ledger API concurrently.
- [cdfb5f61](https://gitlab.com/europeum/public/core-services/-/commit/cdfb5f61): Wait for dependencies to be up and running.
- Updated dependencies [443664aa](https://gitlab.com/europeum/public/core-services/-/commit/443664aa)
- Updated dependencies [3f2dbd72](https://gitlab.com/europeum/public/core-services/-/commit/3f2dbd72)
- Updated dependencies [70631f93](https://gitlab.com/europeum/public/core-services/-/commit/70631f93)
- Updated dependencies [1fb98741](https://gitlab.com/europeum/public/core-services/-/commit/1fb98741)
- Updated dependencies [8a245129](https://gitlab.com/europeum/public/core-services/-/commit/8a245129)
  - @ebsiint-api/shared@1.1.0-rc.2
  - @ebsiint-sc/trusted-issuers-registry@4.0.0-rc.2

## 3.0.0-rc.4

### Major Changes

- [a6a1f685](https://gitlab.com/europeum/public/core-services/-/commit/a6a1f685): disable insertIssuer and updateIssuer

### Minor Changes

- [f2257d7d](https://gitlab.com/europeum/public/core-services/-/commit/f2257d7d): connect APIs with DID Registry API v4

### Patch Changes

- [adc663ea](https://gitlab.com/europeum/public/core-services/-/commit/adc663ea): Bump dependencies.
- [78ee438b](https://gitlab.com/europeum/public/core-services/-/commit/78ee438b): Bump dependencies.
- Updated dependencies [adc663ea](https://gitlab.com/europeum/public/core-services/-/commit/adc663ea)
- Updated dependencies [a6a1f685](https://gitlab.com/europeum/public/core-services/-/commit/a6a1f685)
- Updated dependencies [a6a1f685](https://gitlab.com/europeum/public/core-services/-/commit/a6a1f685)
- Updated dependencies [f2257d7d](https://gitlab.com/europeum/public/core-services/-/commit/f2257d7d)
- Updated dependencies [c02634d2](https://gitlab.com/europeum/public/core-services/-/commit/c02634d2)
- Updated dependencies [1255f4d4](https://gitlab.com/europeum/public/core-services/-/commit/1255f4d4)
- Updated dependencies [78ee438b](https://gitlab.com/europeum/public/core-services/-/commit/78ee438b)
- Updated dependencies [a6a1f685](https://gitlab.com/europeum/public/core-services/-/commit/a6a1f685)
  - @ebsiint-sc/trusted-issuers-registry@4.0.0-rc.1
  - @ebsiint-api/shared@1.1.0-rc.1

## 3.0.0-rc.3

### Patch Changes

- [2f8b1686](https://gitlab.com/europeum/public/core-services/-/commit/2f8b1686): Bump dependencies.
- [c9f6e302](https://gitlab.com/europeum/public/core-services/-/commit/c9f6e302): Refactor common code with Sonar-reported high complexity.
  Update rules for http patch path attribute args to have any order.
- [79b2951e](https://gitlab.com/europeum/public/core-services/-/commit/79b2951e): Fix connection with ethers provider when there is no token.
- [6d699188](https://gitlab.com/europeum/public/core-services/-/commit/6d699188): Bump dependencies, refactor tests.
- [1e62e0cc](https://gitlab.com/europeum/public/core-services/-/commit/1e62e0cc): Move custom errors from `@cef-ebsi/problem-details-errors` to `@ebsiint-api/shared`
- Updated dependencies [1be2b488](https://gitlab.com/europeum/public/core-services/-/commit/1be2b488)
- Updated dependencies [2f8b1686](https://gitlab.com/europeum/public/core-services/-/commit/2f8b1686)
- Updated dependencies [6d699188](https://gitlab.com/europeum/public/core-services/-/commit/6d699188)
- Updated dependencies [be8604c9](https://gitlab.com/europeum/public/core-services/-/commit/be8604c9)
- Updated dependencies [1e62e0cc](https://gitlab.com/europeum/public/core-services/-/commit/1e62e0cc)
  - @ebsiint-sc/trusted-issuers-registry@3.0.1-rc.0
  - @ebsiint-sc/bootstrap@1.0.1-rc.0
  - @ebsiint-api/shared@1.1.0-rc.0

## 3.0.0-rc.2 (2022-09-22)

### 🚀 Features

- add timeout to http requests (#122) - EBSIINT-4529
- implement new /proxies endpoints (#126) - EBSIINT-4633

## 3.0.0-rc.1 (2022-07-06)

### 🐛 Bug Fixes

- accept only EBSI DIDs (#111) - EBSIINT-4352

### 🚀 Features

- show docker tag version info (#113) - EBSIINT-4364

## 3.0.0-rc.0 (2022-06-08)

### ⚠ BREAKING CHANGES

- update libs, use Authorisation API v2 and TAR v3 (#92) - EBSIINT-4001

### 🐛 Bug Fixes

- update Node.js to v16.14.2 (#96) - EBSIINT-3981

### 🚀 Features

- bump dependencies (#100) - EBSIINT-4233
- update libs, use Authorisation API v2 and TAR v3 (#92) - EBSIINT-4001

## 2.0.0-rc.9 (2022-03-16)

### 🚀 Features

- implement TPR changes (#89) - EBSIINT-3846
- log requests and responses (#83) - EBSIINT-3651

## 2.0.0-rc.8 (2021-12-06)

### 🚀 Features

- add sendSignedTransaction alias (#80) - EBSIINT-3474

## 2.0.0-rc.7 (2021-11-15)

### 🚀 Features

- update Node.js to v16.13.0 (#75) - EBSIINT-3496

## 2.0.0-rc.6 (2021-10-18)

### 🐛 Bug Fixes

- update Node.js version to v14.18.1 (#72) - EBSIINT-3432

## 2.0.0-rc.5 (2021-10-04)

### 🐛 Bug Fixes

- compare lowercase Ethereum addresses (#68) - EBSIINT-3334

### 🚀 Features

- follow the new EBSI DID method specification (#67) - EBSIINT-3334
- support DID JWT with publicKeyMultibase (#69) - EBSIINT-3334

## 2.0.0-rc.4 (2021-09-15)

### 🚀 Features

- control access with admin attributes (#65) - EBSIINT-3297

### 🐛 Bug Fixes

- align /jsonrpc methods with other APIs (#55) - EBSIINT-3166
- update dependencies and upgrade Node.js to 14.17.2 (#56) - EBSIINT-3174
- update Node.js to v14.17.5 (#61) - EBSIINT-3220
- upgrade Node.js to v14.17.4 (#59) - EBSIINT-3206

## 2.0.0-rc.3 (2021-06-17)

### 🐛 Bug Fixes

- use lowercase DID for admins and issuers (#51) - EBSIINT-3119

## 2.0.0-rc.2 (2021-06-08)

### 🐛 Bug Fixes

- handle local API 404 response (#46) - EBSIINT-3039

### 🚀 Features

- allow issuers to update their attributes (#47) - EBSIINT-3037
- intercept Axios requests and redirect them to the local network (#45) - EBSIINT-3039

## 2.0.0-rc.1 (2021-05-20)

### 🚀 Features

- implement JWT auth (#40) - EBSIINT-2942

### 🐛 Bug Fixes

- fix e2e tests (#42) - EBSIINT-2942

## 2.0.0-rc.0 (2021-04-23)

Initial release.
