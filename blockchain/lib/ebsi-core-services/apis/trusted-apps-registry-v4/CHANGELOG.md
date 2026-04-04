# @ebsiint-api/trusted-apps-registry-api-v4

## 4.0.0-rc.4

### Minor Changes

- [b9124c22497bc0bb9310bb8a11c9642808c2071f](https://gitlab.com/europeum/public/core-services/-/commit/b9124c22497bc0bb9310bb8a11c9642808c2071f): Decommission TAR SC v3 and TAR API v4.

### Patch Changes

- [7a4068e0d9804be6295aedec7e610cbc253cb03e](https://gitlab.com/europeum/public/core-services/-/commit/7a4068e0d9804be6295aedec7e610cbc253cb03e): Update Node.js to v20.14.0
- [f2b00c7ff4f00ee5186bca56f8c036e0ef73099a](https://gitlab.com/europeum/public/core-services/-/commit/f2b00c7ff4f00ee5186bca56f8c036e0ef73099a): Log errors in `sendTransaction`.
- [4c4d31138e5ba5c9cedd3e598a0017b90335119e](https://gitlab.com/europeum/public/core-services/-/commit/4c4d31138e5ba5c9cedd3e598a0017b90335119e): Refactor Axios error logging.
- [712daf23f46f3010ee81970e532b3ec4deb34d4f](https://gitlab.com/europeum/public/core-services/-/commit/712daf23f46f3010ee81970e532b3ec4deb34d4f): Catch error when verifying if DID is controlled by address

## 4.0.0-rc.3

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
  - @ebsiint-sc/trusted-apps-registry-v3@3.0.0-rc.3

## 4.0.0-rc.2

### Patch Changes

- [48b06089e979a20d1ca3df1be08ac614e5b6856e](https://gitlab.com/europeum/public/core-services/-/commit/48b06089e979a20d1ca3df1be08ac614e5b6856e): Bump dependencies, support Verifiable Attestation 2024-01 schema.
- [733354a1d2e4e6a18a9a834a96b7b9a4eb321060](https://gitlab.com/europeum/public/core-services/-/commit/733354a1d2e4e6a18a9a834a96b7b9a4eb321060): Bump dependencies, update Node.js to v20.11.0.
- [fe81418ed2d3d8759944423997e4371fff61e348](https://gitlab.com/europeum/public/core-services/-/commit/fe81418ed2d3d8759944423997e4371fff61e348): Setup axios agents with `keepAlive: true`.
- [f84767e4aedf5c103d6aad87f81c3708ad915e73](https://gitlab.com/europeum/public/core-services/-/commit/f84767e4aedf5c103d6aad87f81c3708ad915e73): Bump dependencies.
- Updated dependencies [61fffd7ccdb3e8aa20dfe2ea6e546b3784a9adcd](https://gitlab.com/europeum/public/core-services/-/commit/61fffd7ccdb3e8aa20dfe2ea6e546b3784a9adcd)
- Updated dependencies [5c6c9e9227b705958af5a1869ddfbdbe237d6262](https://gitlab.com/europeum/public/core-services/-/commit/5c6c9e9227b705958af5a1869ddfbdbe237d6262)
- Updated dependencies [48b06089e979a20d1ca3df1be08ac614e5b6856e](https://gitlab.com/europeum/public/core-services/-/commit/48b06089e979a20d1ca3df1be08ac614e5b6856e)
- Updated dependencies [99abef34ed7e8a91e3335e712173a45027f9277e](https://gitlab.com/europeum/public/core-services/-/commit/99abef34ed7e8a91e3335e712173a45027f9277e)
- Updated dependencies [733354a1d2e4e6a18a9a834a96b7b9a4eb321060](https://gitlab.com/europeum/public/core-services/-/commit/733354a1d2e4e6a18a9a834a96b7b9a4eb321060)
- Updated dependencies [fe81418ed2d3d8759944423997e4371fff61e348](https://gitlab.com/europeum/public/core-services/-/commit/fe81418ed2d3d8759944423997e4371fff61e348)
- Updated dependencies [f84767e4aedf5c103d6aad87f81c3708ad915e73](https://gitlab.com/europeum/public/core-services/-/commit/f84767e4aedf5c103d6aad87f81c3708ad915e73)
- Updated dependencies [79dc01786e983e02373501ec858f4897d8ae3680](https://gitlab.com/europeum/public/core-services/-/commit/79dc01786e983e02373501ec858f4897d8ae3680)
  - @ebsiint-api/shared@1.1.0-rc.6
  - @ebsiint-sc/trusted-apps-registry-v3@3.0.0-rc.2

## 4.0.0-rc.1

### Patch Changes

- [293896a6f027283b3f735f5205e1581e867ff849](https://gitlab.com/europeum/public/core-services/-/commit/293896a6f027283b3f735f5205e1581e867ff849): Bump OpenZeppelin contracts to fix vulnerability.
- [f3024ac17c5031e011757bbf4e52700943842ba0](https://gitlab.com/europeum/public/core-services/-/commit/f3024ac17c5031e011757bbf4e52700943842ba0): Upgrade Node.js to v18 and bump dependencies.
- [2de71cb9cf78177e0f60ab150571d03f12d4ab57](https://gitlab.com/europeum/public/core-services/-/commit/2de71cb9cf78177e0f60ab150571d03f12d4ab57): Bump dependencies.
- [ca9544d2978218570fcdf58e57de8144317fc5c8](https://gitlab.com/europeum/public/core-services/-/commit/ca9544d2978218570fcdf58e57de8144317fc5c8): Update Node.js to v20.9.0 (LTS).
- [e69bbf27731eaeeedb149b4d155a0b2cc9366aa8](https://gitlab.com/europeum/public/core-services/-/commit/e69bbf27731eaeeedb149b4d155a0b2cc9366aa8): Refactor service's health check.
- [a82cf5865669f7fd184a0bf000573856e85c9837](https://gitlab.com/europeum/public/core-services/-/commit/a82cf5865669f7fd184a0bf000573856e85c9837): Bump dependencies.
- [4fa0f0414daebd2e721434108ee63f7b5802abe9](https://gitlab.com/europeum/public/core-services/-/commit/4fa0f0414daebd2e721434108ee63f7b5802abe9): Bump dependencies and update Node.js to v20.10.0.
- Updated dependencies [f3024ac17c5031e011757bbf4e52700943842ba0](https://gitlab.com/europeum/public/core-services/-/commit/f3024ac17c5031e011757bbf4e52700943842ba0)
- Updated dependencies [2de71cb9cf78177e0f60ab150571d03f12d4ab57](https://gitlab.com/europeum/public/core-services/-/commit/2de71cb9cf78177e0f60ab150571d03f12d4ab57)
- Updated dependencies [ca9544d2978218570fcdf58e57de8144317fc5c8](https://gitlab.com/europeum/public/core-services/-/commit/ca9544d2978218570fcdf58e57de8144317fc5c8)
- Updated dependencies [e69bbf27731eaeeedb149b4d155a0b2cc9366aa8](https://gitlab.com/europeum/public/core-services/-/commit/e69bbf27731eaeeedb149b4d155a0b2cc9366aa8)
- Updated dependencies [a82cf5865669f7fd184a0bf000573856e85c9837](https://gitlab.com/europeum/public/core-services/-/commit/a82cf5865669f7fd184a0bf000573856e85c9837)
- Updated dependencies [4fa0f0414daebd2e721434108ee63f7b5802abe9](https://gitlab.com/europeum/public/core-services/-/commit/4fa0f0414daebd2e721434108ee63f7b5802abe9)
  - @ebsiint-sc/trusted-apps-registry-v3@3.0.0-rc.1
  - @ebsiint-api/shared@1.1.0-rc.5

## 4.0.0-rc.0

### Major Changes

- [95a26899](https://gitlab.com/europeum/public/core-services/-/commit/95a26899): Bootstrap Trusted Apps Registry API v4

### Minor Changes

- [7962df12](https://gitlab.com/europeum/public/core-services/-/commit/7962df12): Bootstrap Authorisation API v4. Connect new APIs with Authorisation API v4
- [91470e6d](https://gitlab.com/europeum/public/core-services/-/commit/91470e6d): Fixed blockscout E2E errors

### Patch Changes

- [de7222f3](https://gitlab.com/europeum/public/core-services/-/commit/de7222f3): Patch dockerfile
- [915b2da7](https://gitlab.com/europeum/public/core-services/-/commit/915b2da7): checkStatusList2021Credential in shared-api, update e2e tests
- [548f2121](https://gitlab.com/europeum/public/core-services/-/commit/548f2121): Minor updates in the APIs (logger)
- Updated dependencies [bf5c8a42](https://gitlab.com/europeum/public/core-services/-/commit/bf5c8a42)
- Updated dependencies [d5a179ce](https://gitlab.com/europeum/public/core-services/-/commit/d5a179ce)
- Updated dependencies [b8b79ac3](https://gitlab.com/europeum/public/core-services/-/commit/b8b79ac3)
- Updated dependencies [915b2da7](https://gitlab.com/europeum/public/core-services/-/commit/915b2da7)
  - @ebsiint-sc/trusted-apps-registry-v3@3.0.0-rc.1
  - @ebsiint-api/shared@1.1.0-rc.4
