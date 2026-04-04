# @ebsiint-api/shared

## 1.1.0-rc.14

### Patch Changes

- [d08c0fade74a721abb962a20145d2e92a52e27a2](https://gitlab.com/europeum/public/core-services/-/commit/d08c0fade74a721abb962a20145d2e92a52e27a2): Refactor logging, replace winston with pino.
- [5df2c952b150700c3532171a45937afa8828049e](https://gitlab.com/europeum/public/core-services/-/commit/5df2c952b150700c3532171a45937afa8828049e): Pass request ID to the other EBSI Core Services.
- [e28b249ad8f9c5660e9bb1fed273d67deafe2011](https://gitlab.com/europeum/public/core-services/-/commit/e28b249ad8f9c5660e9bb1fed273d67deafe2011): Simplify the logs by removing `pid`, `hostname` and `remoteAddress`.
- [771f733abd8f02ad3ddd967eb1ad57857b3651b9](https://gitlab.com/europeum/public/core-services/-/commit/771f733abd8f02ad3ddd967eb1ad57857b3651b9): Bump dependencies.
- [9c945eca37a726555d22b9d9bbe9aab6ecd607a9](https://gitlab.com/europeum/public/core-services/-/commit/9c945eca37a726555d22b9d9bbe9aab6ecd607a9): Bump dependencies.

## 1.1.0-rc.13

### Minor Changes

- [49afd5879af3aad6dce580fa5ab587351d8c1e60](https://gitlab.com/europeum/public/core-services/-/commit/49afd5879af3aad6dce580fa5ab587351d8c1e60): Add new `decodeContractError` helper.

### Patch Changes

- [6bfb72eedcf4aeeac28a36725a533134df9a9b19](https://gitlab.com/europeum/public/core-services/-/commit/6bfb72eedcf4aeeac28a36725a533134df9a9b19): Bump dependencies.
- [72222b705e92e9d1ce6a7c2667d07f5964a4019a](https://gitlab.com/europeum/public/core-services/-/commit/72222b705e92e9d1ce6a7c2667d07f5964a4019a): Update Nest to v11 and Fastify to v5.
- [7b1eadfe5a50e28cd0c174f498dd1a5bbeb3aa5a](https://gitlab.com/europeum/public/core-services/-/commit/7b1eadfe5a50e28cd0c174f498dd1a5bbeb3aa5a): Update `jose` to v5.10.0.
- [ae51c4a3c6be13389959d76a9560b3c1f281ddc3](https://gitlab.com/europeum/public/core-services/-/commit/ae51c4a3c6be13389959d76a9560b3c1f281ddc3): Bump VC and VP libraries.
- [36f6a8fbf33bf56b3764a6c87b4518582a552472](https://gitlab.com/europeum/public/core-services/-/commit/36f6a8fbf33bf56b3764a6c87b4518582a552472): Check Ethereum address checksum.
- [289b8fb6b8febea153f6dbd7272d003d3c9e46ce](https://gitlab.com/europeum/public/core-services/-/commit/289b8fb6b8febea153f6dbd7272d003d3c9e46ce): Bump dependencies.
- [2acaaf92d521df16cb556c2b127685a03babaff5](https://gitlab.com/europeum/public/core-services/-/commit/2acaaf92d521df16cb556c2b127685a03babaff5): Bump dependencies.
- [185357e201f8a9fbdd08b04bcccebab84963842e](https://gitlab.com/europeum/public/core-services/-/commit/185357e201f8a9fbdd08b04bcccebab84963842e): Bump dependencies.
- [4b5b820aae2ed764d2711c3b7a67ea4bc982a9e9](https://gitlab.com/europeum/public/core-services/-/commit/4b5b820aae2ed764d2711c3b7a67ea4bc982a9e9): Bump dependencies.
- [ffe073c6f1cbe8a6ff268c3fa18b2cefdafece32](https://gitlab.com/europeum/public/core-services/-/commit/ffe073c6f1cbe8a6ff268c3fa18b2cefdafece32): Bump dependencies.
- [f5b616da4980de7920326f400cebdcbb93a906c9](https://gitlab.com/europeum/public/core-services/-/commit/f5b616da4980de7920326f400cebdcbb93a906c9): Bump dependencies.

## 1.1.0-rc.12

### Patch Changes

- [41adeeb787055864668f26a1a09ab33276e68597](https://gitlab.com/europeum/public/core-services/-/commit/41adeeb787055864668f26a1a09ab33276e68597): Improve Axios errors logging.
- [14279f52a0c8955c61db5a3940a79a614e2712d1](https://gitlab.com/europeum/public/core-services/-/commit/14279f52a0c8955c61db5a3940a79a614e2712d1): Return error 405 when the HTTP method is not allowed.
  Return error 406 when the `Accept` header is not supported by the endpoint.
- [41e25b0dccbb5b40dbb201641611cbda585df050](https://gitlab.com/europeum/public/core-services/-/commit/41e25b0dccbb5b40dbb201641611cbda585df050): Return error 405 when the HTTP method is not allowed.
  Return error 406 when the `Accept` header is not supported by the endpoint.
- [319b62b1ff7ba0b9ed295b5dfd083339a2706532](https://gitlab.com/europeum/public/core-services/-/commit/319b62b1ff7ba0b9ed295b5dfd083339a2706532): Bump dependencies and update Node.js to v22.
- [6dcd58e4abc78ddf0a544865a487246d12ebbb73](https://gitlab.com/europeum/public/core-services/-/commit/6dcd58e4abc78ddf0a544865a487246d12ebbb73): Bump dependencies.
- [559f4decb4e3e8fd53fc34f169c3c324997e285d](https://gitlab.com/europeum/public/core-services/-/commit/559f4decb4e3e8fd53fc34f169c3c324997e285d): Update VC and VP libraries and refactor API configuration.
- [7e42f8c84a70118162ed118c60250bdbcd0ae022](https://gitlab.com/europeum/public/core-services/-/commit/7e42f8c84a70118162ed118c60250bdbcd0ae022): Handle WebSockets errors.
- [f45aed61262eb6d4033e9cf62fee067f7f2c3773](https://gitlab.com/europeum/public/core-services/-/commit/f45aed61262eb6d4033e9cf62fee067f7f2c3773): Update Core Libs.
- [cc207c5d7adfa0843ff285edee10347283d5acff](https://gitlab.com/europeum/public/core-services/-/commit/cc207c5d7adfa0843ff285edee10347283d5acff): Update Node.js to v22.13.1 and bump dependencies.
- [3849b3d0a244d5385671ce8afa618f53bbddf35a](https://gitlab.com/europeum/public/core-services/-/commit/3849b3d0a244d5385671ce8afa618f53bbddf35a): Bump EBSI Core Libs.
- [3b4ad1dc4f039c54ec79787bf717ffc83c33691f](https://gitlab.com/europeum/public/core-services/-/commit/3b4ad1dc4f039c54ec79787bf717ffc83c33691f): Update ethers.js to v6.
- [e7d6e35c208a3e5c63e941a4c9aa24fcbcc90b83](https://gitlab.com/europeum/public/core-services/-/commit/e7d6e35c208a3e5c63e941a4c9aa24fcbcc90b83): BesuService: don't delay first reconnection attempt.

## 1.1.0-rc.11

### Patch Changes

- [e9c5b06ea71f49dc964520bac26281a9c7430a6f](https://gitlab.com/europeum/public/core-services/-/commit/e9c5b06ea71f49dc964520bac26281a9c7430a6f): Fix query validation in timestamps
- [0b2fc67ae0f01006cd8de8a6c4fe09e1c4273a89](https://gitlab.com/europeum/public/core-services/-/commit/0b2fc67ae0f01006cd8de8a6c4fe09e1c4273a89): Bump dependencies.
- [4053ea85d8cf551558770ec35243ae983eefb1ca](https://gitlab.com/europeum/public/core-services/-/commit/4053ea85d8cf551558770ec35243ae983eefb1ca): Bump dependencies.
- [426cf3113318345473cfdfc9da7102820e613a08](https://gitlab.com/europeum/public/core-services/-/commit/426cf3113318345473cfdfc9da7102820e613a08): Bump dependencies.
- [6314280d6e274c381e67008b5c2960ad4ce7e757](https://gitlab.com/europeum/public/core-services/-/commit/6314280d6e274c381e67008b5c2960ad4ce7e757): Add the possibility to disable the LoggingInterceptor for specific endpoints.

## 1.1.0-rc.10

### Minor Changes

- [9c3dba3e038d65e5970171ce242a8e7b93c2970f](https://gitlab.com/europeum/public/core-services/-/commit/9c3dba3e038d65e5970171ce242a8e7b93c2970f): Support EBSI URI scheme in Core Services.

### Patch Changes

- [90b8973cbf68a6e6d34ba2a79ce8469f34eaa5c4](https://gitlab.com/europeum/public/core-services/-/commit/90b8973cbf68a6e6d34ba2a79ce8469f34eaa5c4): Catch error for malformed uri
- [8993a31a472a9ad2a59dbc2999f20e863f4c581d](https://gitlab.com/europeum/public/core-services/-/commit/8993a31a472a9ad2a59dbc2999f20e863f4c581d): Bump VC and VP libraries.
- [651235bffbb0168f18ff4631b750103de7312477](https://gitlab.com/europeum/public/core-services/-/commit/651235bffbb0168f18ff4631b750103de7312477): Refactor Axios error logging.
- [4c4d31138e5ba5c9cedd3e598a0017b90335119e](https://gitlab.com/europeum/public/core-services/-/commit/4c4d31138e5ba5c9cedd3e598a0017b90335119e): Refactor Axios error logging.
- [917370b20c6efe84f3f7c7128dfdb2a7a5457c81](https://gitlab.com/europeum/public/core-services/-/commit/917370b20c6efe84f3f7c7128dfdb2a7a5457c81): Bump dependencies and upgrade Node.js to v20.16.0.

## 1.1.0-rc.9

### Patch Changes

- [d3a4a64a16df2bbeec587aadbf7bb5c02c577316](https://gitlab.com/europeum/public/core-services/-/commit/d3a4a64a16df2bbeec587aadbf7bb5c02c577316): Bump VC and VP libraries.
- [c66c349218fe427cfa59df0973b987ce14bbec09](https://gitlab.com/europeum/public/core-services/-/commit/c66c349218fe427cfa59df0973b987ce14bbec09): Support VC with credentialStatus as an array.

## 1.1.0-rc.8

### Patch Changes

- [b8b8b09c11f84e7809fdea74f93167141eb3916e](https://gitlab.com/europeum/public/core-services/-/commit/b8b8b09c11f84e7809fdea74f93167141eb3916e): Verify if the credentials are valid at the current time.
- [713311de4a45a79c4059b58bb42bf2e258205aac](https://gitlab.com/europeum/public/core-services/-/commit/713311de4a45a79c4059b58bb42bf2e258205aac): Validate dates of credentials linked in termsOfUse

## 1.1.0-rc.7

### Minor Changes

- [520038797ef25f4c8ac19150274b8a5368175dfc](https://gitlab.com/europeum/public/core-services/-/commit/520038797ef25f4c8ac19150274b8a5368175dfc): Bump VC and VP libraries, support `JsonSchema` credential schema type.

### Patch Changes

- [82e12c8c38442379aadb957fee5ec8ca4fea4fac](https://gitlab.com/europeum/public/core-services/-/commit/82e12c8c38442379aadb957fee5ec8ca4fea4fac): Fix import from validator library (CJS).
- [3900b6f7697df366effd4110dc1827b6c36c169f](https://gitlab.com/europeum/public/core-services/-/commit/3900b6f7697df366effd4110dc1827b6c36c169f): Only accept uncompressed public keys prefixed with 0x04 when the algorithm is ES256K.
- [1960638f1c5cce829eae0535733d0714632d8841](https://gitlab.com/europeum/public/core-services/-/commit/1960638f1c5cce829eae0535733d0714632d8841): Bump dependencies.
- [1960638f1c5cce829eae0535733d0714632d8841](https://gitlab.com/europeum/public/core-services/-/commit/1960638f1c5cce829eae0535733d0714632d8841): Bump jose to v4.15.5, fix CVE-2024-28176.
- [ddfc40a1f21fae1498059618e71bf1f2e9271ee8](https://gitlab.com/europeum/public/core-services/-/commit/ddfc40a1f21fae1498059618e71bf1f2e9271ee8): Bump VC and VP libraries.
- [e5e5cd041db2e6c9670a596d7526d0e7159efcc5](https://gitlab.com/europeum/public/core-services/-/commit/e5e5cd041db2e6c9670a596d7526d0e7159efcc5): Bump dependencies.

## 1.1.0-rc.6

### Minor Changes

- [61fffd7ccdb3e8aa20dfe2ea6e546b3784a9adcd](https://gitlab.com/europeum/public/core-services/-/commit/61fffd7ccdb3e8aa20dfe2ea6e546b3784a9adcd): Export isDid function
- [5c6c9e9227b705958af5a1869ddfbdbe237d6262](https://gitlab.com/europeum/public/core-services/-/commit/5c6c9e9227b705958af5a1869ddfbdbe237d6262): extractNamedAttributes function from shared library

### Patch Changes

- [48b06089e979a20d1ca3df1be08ac614e5b6856e](https://gitlab.com/europeum/public/core-services/-/commit/48b06089e979a20d1ca3df1be08ac614e5b6856e): Bump dependencies, support Verifiable Attestation 2024-01 schema.
- [99abef34ed7e8a91e3335e712173a45027f9277e](https://gitlab.com/europeum/public/core-services/-/commit/99abef34ed7e8a91e3335e712173a45027f9277e): Update VC and VP libraries.
- [733354a1d2e4e6a18a9a834a96b7b9a4eb321060](https://gitlab.com/europeum/public/core-services/-/commit/733354a1d2e4e6a18a9a834a96b7b9a4eb321060): Bump dependencies, update Node.js to v20.11.0.
- [fe81418ed2d3d8759944423997e4371fff61e348](https://gitlab.com/europeum/public/core-services/-/commit/fe81418ed2d3d8759944423997e4371fff61e348): Setup axios agents with `keepAlive: true`.
- [f84767e4aedf5c103d6aad87f81c3708ad915e73](https://gitlab.com/europeum/public/core-services/-/commit/f84767e4aedf5c103d6aad87f81c3708ad915e73): Bump dependencies.
- [79dc01786e983e02373501ec858f4897d8ae3680](https://gitlab.com/europeum/public/core-services/-/commit/79dc01786e983e02373501ec858f4897d8ae3680): Return more detailed error when Ajv validation fails.

## 1.1.0-rc.5

### Patch Changes

- [f3024ac17c5031e011757bbf4e52700943842ba0](https://gitlab.com/europeum/public/core-services/-/commit/f3024ac17c5031e011757bbf4e52700943842ba0): Upgrade Node.js to v18 and bump dependencies.
- [2de71cb9cf78177e0f60ab150571d03f12d4ab57](https://gitlab.com/europeum/public/core-services/-/commit/2de71cb9cf78177e0f60ab150571d03f12d4ab57): Bump dependencies.
- [ca9544d2978218570fcdf58e57de8144317fc5c8](https://gitlab.com/europeum/public/core-services/-/commit/ca9544d2978218570fcdf58e57de8144317fc5c8): Update Node.js to v20.9.0 (LTS).
- [e69bbf27731eaeeedb149b4d155a0b2cc9366aa8](https://gitlab.com/europeum/public/core-services/-/commit/e69bbf27731eaeeedb149b4d155a0b2cc9366aa8): Refactor service's health check.
- [a82cf5865669f7fd184a0bf000573856e85c9837](https://gitlab.com/europeum/public/core-services/-/commit/a82cf5865669f7fd184a0bf000573856e85c9837): Bump dependencies.
- [4fa0f0414daebd2e721434108ee63f7b5802abe9](https://gitlab.com/europeum/public/core-services/-/commit/4fa0f0414daebd2e721434108ee63f7b5802abe9): Bump dependencies and update Node.js to v20.10.0.

## 1.1.0-rc.4

### Patch Changes

- [d5a179ce](https://gitlab.com/europeum/public/core-services/-/commit/d5a179ce): Bump VC and VP libraries.
- [915b2da7](https://gitlab.com/europeum/public/core-services/-/commit/915b2da7): checkStatusList2021Credential in shared-api, update e2e tests

## 1.1.0-rc.3

### Minor Changes

- [38b9d313](https://gitlab.com/europeum/public/core-services/-/commit/38b9d313): Support custom trusted hostnames.

### Patch Changes

- [f0d3dde3](https://gitlab.com/europeum/public/core-services/-/commit/f0d3dde3): Improve error handling
- [f520c43a](https://gitlab.com/europeum/public/core-services/-/commit/f520c43a): Bump dependencies and update Node.js to v16.20.1
- [07e3176d](https://gitlab.com/europeum/public/core-services/-/commit/07e3176d): Loosen status list credential type checking.

## 1.1.0-rc.2

### Minor Changes

- [70631f93](https://gitlab.com/europeum/public/core-services/-/commit/70631f93): bump VC/VP libraries

### Patch Changes

- [443664aa](https://gitlab.com/europeum/public/core-services/-/commit/443664aa): Bump EBSI libraries.
- [1fb98741](https://gitlab.com/europeum/public/core-services/-/commit/1fb98741): Bump dependencies.
- [8a245129](https://gitlab.com/europeum/public/core-services/-/commit/8a245129): Bump EBSI libraries.

## 1.1.0-rc.1

### Minor Changes

- [a6a1f685](https://gitlab.com/europeum/public/core-services/-/commit/a6a1f685): custom ebsi config in isStatusList2021Credential
- [f2257d7d](https://gitlab.com/europeum/public/core-services/-/commit/f2257d7d): connect APIs with DID Registry API v4

### Patch Changes

- [adc663ea](https://gitlab.com/europeum/public/core-services/-/commit/adc663ea): Bump dependencies.
- [78ee438b](https://gitlab.com/europeum/public/core-services/-/commit/78ee438b): Bump dependencies.

## 1.1.0-rc.0

### Minor Changes

- [be8604c9](https://gitlab.com/europeum/public/core-services/-/commit/be8604c9): Support `did:key` method for Natural Persons.

### Patch Changes

- [6d699188](https://gitlab.com/europeum/public/core-services/-/commit/6d699188): Bump dependencies, refactor tests.
- [1e62e0cc](https://gitlab.com/europeum/public/core-services/-/commit/1e62e0cc): Move custom errors from `@cef-ebsi/problem-details-errors` to `@ebsiint-api/shared`
