# Changelog

## 1.0.0-rc.8

### Patch Changes

- [d08c0fade74a721abb962a20145d2e92a52e27a2](https://gitlab.com/europeum/public/core-services/-/commit/d08c0fade74a721abb962a20145d2e92a52e27a2): Refactor logging, replace winston with pino.
- [87118a0bb2a87c1795a57d5ea166d1bfc8ddf58a](https://gitlab.com/europeum/public/core-services/-/commit/87118a0bb2a87c1795a57d5ea166d1bfc8ddf58a): Use the original logic of the `/documents/:documentId` endpoint when the `version` query parameter is set to `deprecated`.
- [8a1efb72fa4192b16fce3bd17e9e7b8ee7f9e3f9](https://gitlab.com/europeum/public/core-services/-/commit/8a1efb72fa4192b16fce3bd17e9e7b8ee7f9e3f9): Add "x-request-id" header to all the Axios requests sent to other Core Services.
- [316436a1f4e690fe7ebd49050c43a55bace5636d](https://gitlab.com/europeum/public/core-services/-/commit/316436a1f4e690fe7ebd49050c43a55bace5636d): Add "EBSI-Healthcheck" header to healthcheck requests.
- [5df2c952b150700c3532171a45937afa8828049e](https://gitlab.com/europeum/public/core-services/-/commit/5df2c952b150700c3532171a45937afa8828049e): Pass request ID to the other EBSI Core Services.
- [e28b249ad8f9c5660e9bb1fed273d67deafe2011](https://gitlab.com/europeum/public/core-services/-/commit/e28b249ad8f9c5660e9bb1fed273d67deafe2011): Simplify the logs by removing `pid`, `hostname` and `remoteAddress`.
- [771f733abd8f02ad3ddd967eb1ad57857b3651b9](https://gitlab.com/europeum/public/core-services/-/commit/771f733abd8f02ad3ddd967eb1ad57857b3651b9): Update Node.js and bump dependencies.
- [9c945eca37a726555d22b9d9bbe9aab6ecd607a9](https://gitlab.com/europeum/public/core-services/-/commit/9c945eca37a726555d22b9d9bbe9aab6ecd607a9): Bump dependencies.
- Updated dependencies [d08c0fade74a721abb962a20145d2e92a52e27a2](https://gitlab.com/europeum/public/core-services/-/commit/d08c0fade74a721abb962a20145d2e92a52e27a2)
- Updated dependencies [87118a0bb2a87c1795a57d5ea166d1bfc8ddf58a](https://gitlab.com/europeum/public/core-services/-/commit/87118a0bb2a87c1795a57d5ea166d1bfc8ddf58a)
- Updated dependencies [5df2c952b150700c3532171a45937afa8828049e](https://gitlab.com/europeum/public/core-services/-/commit/5df2c952b150700c3532171a45937afa8828049e)
- Updated dependencies [e28b249ad8f9c5660e9bb1fed273d67deafe2011](https://gitlab.com/europeum/public/core-services/-/commit/e28b249ad8f9c5660e9bb1fed273d67deafe2011)
- Updated dependencies [771f733abd8f02ad3ddd967eb1ad57857b3651b9](https://gitlab.com/europeum/public/core-services/-/commit/771f733abd8f02ad3ddd967eb1ad57857b3651b9)
- Updated dependencies [9c945eca37a726555d22b9d9bbe9aab6ecd607a9](https://gitlab.com/europeum/public/core-services/-/commit/9c945eca37a726555d22b9d9bbe9aab6ecd607a9)
  - @ebsiint-api/shared@1.1.0-rc.14
  - @ebsiint-sc/track-and-trace@1.0.0-rc.7

## 1.0.0-rc.7

### Minor Changes

- [dfc63bbd5300ebd4fd37e86bdcc69afc09c49a69](https://gitlab.com/europeum/public/core-services/-/commit/dfc63bbd5300ebd4fd37e86bdcc69afc09c49a69): Remove events from getDocument

### Patch Changes

- [6bfb72eedcf4aeeac28a36725a533134df9a9b19](https://gitlab.com/europeum/public/core-services/-/commit/6bfb72eedcf4aeeac28a36725a533134df9a9b19): Bump dependencies.
- [27cdf71be479c2e2d2a751c5bdb007f1eea3e4d1](https://gitlab.com/europeum/public/core-services/-/commit/27cdf71be479c2e2d2a751c5bdb007f1eea3e4d1): Add missing `keyv` dependency.
- [72222b705e92e9d1ce6a7c2667d07f5964a4019a](https://gitlab.com/europeum/public/core-services/-/commit/72222b705e92e9d1ce6a7c2667d07f5964a4019a): Update Nest to v11 and Fastify to v5.
- [7b1eadfe5a50e28cd0c174f498dd1a5bbeb3aa5a](https://gitlab.com/europeum/public/core-services/-/commit/7b1eadfe5a50e28cd0c174f498dd1a5bbeb3aa5a): Update `jose` to v5.10.0.
- [ae51c4a3c6be13389959d76a9560b3c1f281ddc3](https://gitlab.com/europeum/public/core-services/-/commit/ae51c4a3c6be13389959d76a9560b3c1f281ddc3): Bump VC and VP libraries.
- [289b8fb6b8febea153f6dbd7272d003d3c9e46ce](https://gitlab.com/europeum/public/core-services/-/commit/289b8fb6b8febea153f6dbd7272d003d3c9e46ce): Bump dependencies.
- [2acaaf92d521df16cb556c2b127685a03babaff5](https://gitlab.com/europeum/public/core-services/-/commit/2acaaf92d521df16cb556c2b127685a03babaff5): Bump dependencies.
- [185357e201f8a9fbdd08b04bcccebab84963842e](https://gitlab.com/europeum/public/core-services/-/commit/185357e201f8a9fbdd08b04bcccebab84963842e): Bump dependencies.
- [4b5b820aae2ed764d2711c3b7a67ea4bc982a9e9](https://gitlab.com/europeum/public/core-services/-/commit/4b5b820aae2ed764d2711c3b7a67ea4bc982a9e9): Bump dependencies.
- [ffe073c6f1cbe8a6ff268c3fa18b2cefdafece32](https://gitlab.com/europeum/public/core-services/-/commit/ffe073c6f1cbe8a6ff268c3fa18b2cefdafece32): Bump dependencies.
- [f5b616da4980de7920326f400cebdcbb93a906c9](https://gitlab.com/europeum/public/core-services/-/commit/f5b616da4980de7920326f400cebdcbb93a906c9): Bump dependencies.
- Updated dependencies [d134d4c3bf0b63ee3405b3176fbc685340eb9b4d](https://gitlab.com/europeum/public/core-services/-/commit/d134d4c3bf0b63ee3405b3176fbc685340eb9b4d)
- Updated dependencies [6bfb72eedcf4aeeac28a36725a533134df9a9b19](https://gitlab.com/europeum/public/core-services/-/commit/6bfb72eedcf4aeeac28a36725a533134df9a9b19)
- Updated dependencies [72222b705e92e9d1ce6a7c2667d07f5964a4019a](https://gitlab.com/europeum/public/core-services/-/commit/72222b705e92e9d1ce6a7c2667d07f5964a4019a)
- Updated dependencies [7b1eadfe5a50e28cd0c174f498dd1a5bbeb3aa5a](https://gitlab.com/europeum/public/core-services/-/commit/7b1eadfe5a50e28cd0c174f498dd1a5bbeb3aa5a)
- Updated dependencies [ae51c4a3c6be13389959d76a9560b3c1f281ddc3](https://gitlab.com/europeum/public/core-services/-/commit/ae51c4a3c6be13389959d76a9560b3c1f281ddc3)
- Updated dependencies [dfc63bbd5300ebd4fd37e86bdcc69afc09c49a69](https://gitlab.com/europeum/public/core-services/-/commit/dfc63bbd5300ebd4fd37e86bdcc69afc09c49a69)
- Updated dependencies [36f6a8fbf33bf56b3764a6c87b4518582a552472](https://gitlab.com/europeum/public/core-services/-/commit/36f6a8fbf33bf56b3764a6c87b4518582a552472)
- Updated dependencies [49afd5879af3aad6dce580fa5ab587351d8c1e60](https://gitlab.com/europeum/public/core-services/-/commit/49afd5879af3aad6dce580fa5ab587351d8c1e60)
- Updated dependencies [289b8fb6b8febea153f6dbd7272d003d3c9e46ce](https://gitlab.com/europeum/public/core-services/-/commit/289b8fb6b8febea153f6dbd7272d003d3c9e46ce)
- Updated dependencies [2acaaf92d521df16cb556c2b127685a03babaff5](https://gitlab.com/europeum/public/core-services/-/commit/2acaaf92d521df16cb556c2b127685a03babaff5)
- Updated dependencies [185357e201f8a9fbdd08b04bcccebab84963842e](https://gitlab.com/europeum/public/core-services/-/commit/185357e201f8a9fbdd08b04bcccebab84963842e)
- Updated dependencies [4b5b820aae2ed764d2711c3b7a67ea4bc982a9e9](https://gitlab.com/europeum/public/core-services/-/commit/4b5b820aae2ed764d2711c3b7a67ea4bc982a9e9)
- Updated dependencies [0ccef8a01f55b62270f46bfd33348c9f92bae71a](https://gitlab.com/europeum/public/core-services/-/commit/0ccef8a01f55b62270f46bfd33348c9f92bae71a)
- Updated dependencies [ffe073c6f1cbe8a6ff268c3fa18b2cefdafece32](https://gitlab.com/europeum/public/core-services/-/commit/ffe073c6f1cbe8a6ff268c3fa18b2cefdafece32)
- Updated dependencies [f5b616da4980de7920326f400cebdcbb93a906c9](https://gitlab.com/europeum/public/core-services/-/commit/f5b616da4980de7920326f400cebdcbb93a906c9)
  - @ebsiint-sc/track-and-trace@1.0.0-rc.6
  - @ebsiint-api/shared@1.1.0-rc.13

## 1.0.0-rc.6

### Minor Changes

- [9f40e39d2fc3e553b1769993eb412ad2e49e2ece](https://gitlab.com/europeum/public/core-services/-/commit/9f40e39d2fc3e553b1769993eb412ad2e49e2ece): Expose smart contract's ABI through the new GET /abi endpoint.

### Patch Changes

- [123b3b85e39466a7d64ed85b42f5fd13ff9bbafc](https://gitlab.com/europeum/public/core-services/-/commit/123b3b85e39466a7d64ed85b42f5fd13ff9bbafc): Remove useless mutex
- [41adeeb787055864668f26a1a09ab33276e68597](https://gitlab.com/europeum/public/core-services/-/commit/41adeeb787055864668f26a1a09ab33276e68597): Improve Axios errors logging.
- [14279f52a0c8955c61db5a3940a79a614e2712d1](https://gitlab.com/europeum/public/core-services/-/commit/14279f52a0c8955c61db5a3940a79a614e2712d1): Return error 405 when the HTTP method is not allowed.
  Return error 406 when the `Accept` header is not supported by the endpoint.
- [1a655b05daf57a3ef3d91f87c634c543d3736ea8](https://gitlab.com/europeum/public/core-services/-/commit/1a655b05daf57a3ef3d91f87c634c543d3736ea8): Bump dependencies, update Node.js to v20.18.0.
- [41e25b0dccbb5b40dbb201641611cbda585df050](https://gitlab.com/europeum/public/core-services/-/commit/41e25b0dccbb5b40dbb201641611cbda585df050): Return error 405 when the HTTP method is not allowed.
  Return error 406 when the `Accept` header is not supported by the endpoint.
- [319b62b1ff7ba0b9ed295b5dfd083339a2706532](https://gitlab.com/europeum/public/core-services/-/commit/319b62b1ff7ba0b9ed295b5dfd083339a2706532): Bump dependencies and update Node.js to v22.
- [6dcd58e4abc78ddf0a544865a487246d12ebbb73](https://gitlab.com/europeum/public/core-services/-/commit/6dcd58e4abc78ddf0a544865a487246d12ebbb73): Bump dependencies.
- [559f4decb4e3e8fd53fc34f169c3c324997e285d](https://gitlab.com/europeum/public/core-services/-/commit/559f4decb4e3e8fd53fc34f169c3c324997e285d): Update VC and VP libraries and refactor API configuration.
- [44b963f20f875620bd668c7e1ed4582dbda105c4](https://gitlab.com/europeum/public/core-services/-/commit/44b963f20f875620bd668c7e1ed4582dbda105c4): Support EIP-155 `v` for legacy transactions.
- [9cfe0289fb7433ebe331fa924a4b83bbc0d10f8b](https://gitlab.com/europeum/public/core-services/-/commit/9cfe0289fb7433ebe331fa924a4b83bbc0d10f8b): Accept only type 0 (legacy) transactions.
- [7e42f8c84a70118162ed118c60250bdbcd0ae022](https://gitlab.com/europeum/public/core-services/-/commit/7e42f8c84a70118162ed118c60250bdbcd0ae022): Handle WebSockets errors.
- [f45aed61262eb6d4033e9cf62fee067f7f2c3773](https://gitlab.com/europeum/public/core-services/-/commit/f45aed61262eb6d4033e9cf62fee067f7f2c3773): Update Core Libs.
- [cc207c5d7adfa0843ff285edee10347283d5acff](https://gitlab.com/europeum/public/core-services/-/commit/cc207c5d7adfa0843ff285edee10347283d5acff): Update Node.js to v22.13.1 and bump dependencies.
- [3849b3d0a244d5385671ce8afa618f53bbddf35a](https://gitlab.com/europeum/public/core-services/-/commit/3849b3d0a244d5385671ce8afa618f53bbddf35a): Bump EBSI Core Libs.
- [3b4ad1dc4f039c54ec79787bf717ffc83c33691f](https://gitlab.com/europeum/public/core-services/-/commit/3b4ad1dc4f039c54ec79787bf717ffc83c33691f): Update ethers.js to v6.
- Updated dependencies [41adeeb787055864668f26a1a09ab33276e68597](https://gitlab.com/europeum/public/core-services/-/commit/41adeeb787055864668f26a1a09ab33276e68597)
- Updated dependencies [14279f52a0c8955c61db5a3940a79a614e2712d1](https://gitlab.com/europeum/public/core-services/-/commit/14279f52a0c8955c61db5a3940a79a614e2712d1)
- Updated dependencies [41e25b0dccbb5b40dbb201641611cbda585df050](https://gitlab.com/europeum/public/core-services/-/commit/41e25b0dccbb5b40dbb201641611cbda585df050)
- Updated dependencies [319b62b1ff7ba0b9ed295b5dfd083339a2706532](https://gitlab.com/europeum/public/core-services/-/commit/319b62b1ff7ba0b9ed295b5dfd083339a2706532)
- Updated dependencies [6dcd58e4abc78ddf0a544865a487246d12ebbb73](https://gitlab.com/europeum/public/core-services/-/commit/6dcd58e4abc78ddf0a544865a487246d12ebbb73)
- Updated dependencies [559f4decb4e3e8fd53fc34f169c3c324997e285d](https://gitlab.com/europeum/public/core-services/-/commit/559f4decb4e3e8fd53fc34f169c3c324997e285d)
- Updated dependencies [7e42f8c84a70118162ed118c60250bdbcd0ae022](https://gitlab.com/europeum/public/core-services/-/commit/7e42f8c84a70118162ed118c60250bdbcd0ae022)
- Updated dependencies [f45aed61262eb6d4033e9cf62fee067f7f2c3773](https://gitlab.com/europeum/public/core-services/-/commit/f45aed61262eb6d4033e9cf62fee067f7f2c3773)
- Updated dependencies [cc207c5d7adfa0843ff285edee10347283d5acff](https://gitlab.com/europeum/public/core-services/-/commit/cc207c5d7adfa0843ff285edee10347283d5acff)
- Updated dependencies [3849b3d0a244d5385671ce8afa618f53bbddf35a](https://gitlab.com/europeum/public/core-services/-/commit/3849b3d0a244d5385671ce8afa618f53bbddf35a)
- Updated dependencies [3b4ad1dc4f039c54ec79787bf717ffc83c33691f](https://gitlab.com/europeum/public/core-services/-/commit/3b4ad1dc4f039c54ec79787bf717ffc83c33691f)
  - @ebsiint-api/shared@1.1.0-rc.12
  - @ebsiint-sc/track-and-trace@1.0.0-rc.5

## 1.0.0-rc.5

### Patch Changes

- [0b2fc67ae0f01006cd8de8a6c4fe09e1c4273a89](https://gitlab.com/europeum/public/core-services/-/commit/0b2fc67ae0f01006cd8de8a6c4fe09e1c4273a89): Bump dependencies.
- [e42337f296ad7ca356852fd572d700885815a4b3](https://gitlab.com/europeum/public/core-services/-/commit/e42337f296ad7ca356852fd572d700885815a4b3): Reject requests when query parameter is not supported
- [4053ea85d8cf551558770ec35243ae983eefb1ca](https://gitlab.com/europeum/public/core-services/-/commit/4053ea85d8cf551558770ec35243ae983eefb1ca): Bump dependencies.
- [426cf3113318345473cfdfc9da7102820e613a08](https://gitlab.com/europeum/public/core-services/-/commit/426cf3113318345473cfdfc9da7102820e613a08): Bump dependencies.
- [6314280d6e274c381e67008b5c2960ad4ce7e757](https://gitlab.com/europeum/public/core-services/-/commit/6314280d6e274c381e67008b5c2960ad4ce7e757): Add the possibility to disable the LoggingInterceptor for specific endpoints.
- Updated dependencies [e9c5b06ea71f49dc964520bac26281a9c7430a6f](https://gitlab.com/europeum/public/core-services/-/commit/e9c5b06ea71f49dc964520bac26281a9c7430a6f)
- Updated dependencies [0b2fc67ae0f01006cd8de8a6c4fe09e1c4273a89](https://gitlab.com/europeum/public/core-services/-/commit/0b2fc67ae0f01006cd8de8a6c4fe09e1c4273a89)
- Updated dependencies [4053ea85d8cf551558770ec35243ae983eefb1ca](https://gitlab.com/europeum/public/core-services/-/commit/4053ea85d8cf551558770ec35243ae983eefb1ca)
- Updated dependencies [426cf3113318345473cfdfc9da7102820e613a08](https://gitlab.com/europeum/public/core-services/-/commit/426cf3113318345473cfdfc9da7102820e613a08)
- Updated dependencies [6314280d6e274c381e67008b5c2960ad4ce7e757](https://gitlab.com/europeum/public/core-services/-/commit/6314280d6e274c381e67008b5c2960ad4ce7e757)
  - @ebsiint-api/shared@1.1.0-rc.11
  - @ebsiint-sc/track-and-trace@1.0.0-rc.4

## 1.0.0-rc.4

### Minor Changes

- [9c3dba3e038d65e5970171ce242a8e7b93c2970f](https://gitlab.com/europeum/public/core-services/-/commit/9c3dba3e038d65e5970171ce242a8e7b93c2970f): Support EBSI URI scheme in Core Services.
- [47971f1222a9d42b4d999cc34ca9c86a4e8ccf63](https://gitlab.com/europeum/public/core-services/-/commit/47971f1222a9d42b4d999cc34ca9c86a4e8ccf63): Require TPR attributes in `authoriseDid` function, and check these attributes in Authorisation API for `tnt_authorise` access token.
- [c93fd2bd3194b0e9bdddd35145bff445bb5fe217](https://gitlab.com/europeum/public/core-services/-/commit/c93fd2bd3194b0e9bdddd35145bff445bb5fe217): Verify if `authorisedDid` exists before accepting the request.

### Patch Changes

- [7a4068e0d9804be6295aedec7e610cbc253cb03e](https://gitlab.com/europeum/public/core-services/-/commit/7a4068e0d9804be6295aedec7e610cbc253cb03e): Update Node.js to v20.14.0
- [90b8973cbf68a6e6d34ba2a79ce8469f34eaa5c4](https://gitlab.com/europeum/public/core-services/-/commit/90b8973cbf68a6e6d34ba2a79ce8469f34eaa5c4): Catch error for malformed uri
- [8993a31a472a9ad2a59dbc2999f20e863f4c581d](https://gitlab.com/europeum/public/core-services/-/commit/8993a31a472a9ad2a59dbc2999f20e863f4c581d): Bump VC and VP libraries.
- [f29c5faec44fff1e960986d51bc4b0f60c61cb8c](https://gitlab.com/europeum/public/core-services/-/commit/f29c5faec44fff1e960986d51bc4b0f60c61cb8c): Connect to Besu directly.
- [903955e66dacf4258dbeb2b29f771caae7ef3604](https://gitlab.com/europeum/public/core-services/-/commit/903955e66dacf4258dbeb2b29f771caae7ef3604): Remove dependency on TAR API v4.
- [651235bffbb0168f18ff4631b750103de7312477](https://gitlab.com/europeum/public/core-services/-/commit/651235bffbb0168f18ff4631b750103de7312477): Refactor Axios error logging.
- [f2b00c7ff4f00ee5186bca56f8c036e0ef73099a](https://gitlab.com/europeum/public/core-services/-/commit/f2b00c7ff4f00ee5186bca56f8c036e0ef73099a): Log errors in `sendTransaction`.
- [4c4d31138e5ba5c9cedd3e598a0017b90335119e](https://gitlab.com/europeum/public/core-services/-/commit/4c4d31138e5ba5c9cedd3e598a0017b90335119e): Refactor Axios error logging.
- [50694cacbd827eeefecbcd2cc765b5660083cccd](https://gitlab.com/europeum/public/core-services/-/commit/50694cacbd827eeefecbcd2cc765b5660083cccd): Check Besu readiness in health check.
- [4c68d45d647735cefa90e5545ff1b5b0c89703ae](https://gitlab.com/europeum/public/core-services/-/commit/4c68d45d647735cefa90e5545ff1b5b0c89703ae): Do not return "EBSI-Image-Tag" header anymore.
- [917370b20c6efe84f3f7c7128dfdb2a7a5457c81](https://gitlab.com/europeum/public/core-services/-/commit/917370b20c6efe84f3f7c7128dfdb2a7a5457c81): Bump dependencies and upgrade Node.js to v20.16.0.
- Updated dependencies [90b8973cbf68a6e6d34ba2a79ce8469f34eaa5c4](https://gitlab.com/europeum/public/core-services/-/commit/90b8973cbf68a6e6d34ba2a79ce8469f34eaa5c4)
- Updated dependencies [8993a31a472a9ad2a59dbc2999f20e863f4c581d](https://gitlab.com/europeum/public/core-services/-/commit/8993a31a472a9ad2a59dbc2999f20e863f4c581d)
- Updated dependencies [9c3dba3e038d65e5970171ce242a8e7b93c2970f](https://gitlab.com/europeum/public/core-services/-/commit/9c3dba3e038d65e5970171ce242a8e7b93c2970f)
- Updated dependencies [47971f1222a9d42b4d999cc34ca9c86a4e8ccf63](https://gitlab.com/europeum/public/core-services/-/commit/47971f1222a9d42b4d999cc34ca9c86a4e8ccf63)
- Updated dependencies [651235bffbb0168f18ff4631b750103de7312477](https://gitlab.com/europeum/public/core-services/-/commit/651235bffbb0168f18ff4631b750103de7312477)
- Updated dependencies [4c4d31138e5ba5c9cedd3e598a0017b90335119e](https://gitlab.com/europeum/public/core-services/-/commit/4c4d31138e5ba5c9cedd3e598a0017b90335119e)
- Updated dependencies [917370b20c6efe84f3f7c7128dfdb2a7a5457c81](https://gitlab.com/europeum/public/core-services/-/commit/917370b20c6efe84f3f7c7128dfdb2a7a5457c81)
  - @ebsiint-api/shared@1.1.0-rc.10
  - @ebsiint-sc/track-and-trace@1.0.0-rc.3

## 1.0.0-rc.3

### Patch Changes

- [d3a4a64a16df2bbeec587aadbf7bb5c02c577316](https://gitlab.com/europeum/public/core-services/-/commit/d3a4a64a16df2bbeec587aadbf7bb5c02c577316): Bump VC and VP libraries.
- [c66c349218fe427cfa59df0973b987ce14bbec09](https://gitlab.com/europeum/public/core-services/-/commit/c66c349218fe427cfa59df0973b987ce14bbec09): Support VC with credentialStatus as an array.
- Updated dependencies [d3a4a64a16df2bbeec587aadbf7bb5c02c577316](https://gitlab.com/europeum/public/core-services/-/commit/d3a4a64a16df2bbeec587aadbf7bb5c02c577316)
- Updated dependencies [c66c349218fe427cfa59df0973b987ce14bbec09](https://gitlab.com/europeum/public/core-services/-/commit/c66c349218fe427cfa59df0973b987ce14bbec09)
  - @ebsiint-api/shared@1.1.0-rc.9

## 1.0.0-rc.2

### Minor Changes

- [78750bf4bedbeb6186bfab2629a08025e5fe698a](https://gitlab.com/europeum/public/core-services/-/commit/78750bf4bedbeb6186bfab2629a08025e5fe698a): Implement revocation in cascade

### Patch Changes

- [b8b8b09c11f84e7809fdea74f93167141eb3916e](https://gitlab.com/europeum/public/core-services/-/commit/b8b8b09c11f84e7809fdea74f93167141eb3916e): Verify if the credentials are valid at the current time.
- [713311de4a45a79c4059b58bb42bf2e258205aac](https://gitlab.com/europeum/public/core-services/-/commit/713311de4a45a79c4059b58bb42bf2e258205aac): Validate dates of credentials linked in termsOfUse
- Updated dependencies [78750bf4bedbeb6186bfab2629a08025e5fe698a](https://gitlab.com/europeum/public/core-services/-/commit/78750bf4bedbeb6186bfab2629a08025e5fe698a)
- Updated dependencies [b8b8b09c11f84e7809fdea74f93167141eb3916e](https://gitlab.com/europeum/public/core-services/-/commit/b8b8b09c11f84e7809fdea74f93167141eb3916e)
- Updated dependencies [713311de4a45a79c4059b58bb42bf2e258205aac](https://gitlab.com/europeum/public/core-services/-/commit/713311de4a45a79c4059b58bb42bf2e258205aac)
  - @ebsiint-sc/track-and-trace@1.0.0-rc.2
  - @ebsiint-api/shared@1.1.0-rc.8

## 1.0.0-rc.1

### Minor Changes

- [520038797ef25f4c8ac19150274b8a5368175dfc](https://gitlab.com/europeum/public/core-services/-/commit/520038797ef25f4c8ac19150274b8a5368175dfc): Bump VC and VP libraries, support `JsonSchema` credential schema type.

### Patch Changes

- [819ff7e26e1836ac0033495b94d813696bcd9d9b](https://gitlab.com/europeum/public/core-services/-/commit/819ff7e26e1836ac0033495b94d813696bcd9d9b): Fix "sender" format in /documents/{documentId}/events/{eventId} response.
- [3900b6f7697df366effd4110dc1827b6c36c169f](https://gitlab.com/europeum/public/core-services/-/commit/3900b6f7697df366effd4110dc1827b6c36c169f): Only accept uncompressed public keys prefixed with 0x04 when the algorithm is ES256K.
- [1960638f1c5cce829eae0535733d0714632d8841](https://gitlab.com/europeum/public/core-services/-/commit/1960638f1c5cce829eae0535733d0714632d8841): Bump dependencies.
- [1960638f1c5cce829eae0535733d0714632d8841](https://gitlab.com/europeum/public/core-services/-/commit/1960638f1c5cce829eae0535733d0714632d8841): Bump jose to v4.15.5, fix CVE-2024-28176.
- [ddfc40a1f21fae1498059618e71bf1f2e9271ee8](https://gitlab.com/europeum/public/core-services/-/commit/ddfc40a1f21fae1498059618e71bf1f2e9271ee8): Bump VC and VP libraries.
- [e5e5cd041db2e6c9670a596d7526d0e7159efcc5](https://gitlab.com/europeum/public/core-services/-/commit/e5e5cd041db2e6c9670a596d7526d0e7159efcc5): Bump dependencies.
- [85e2c4cd45daea5e75d1f68484a0a062348068e0](https://gitlab.com/europeum/public/core-services/-/commit/85e2c4cd45daea5e75d1f68484a0a062348068e0): Do not log requests made by the EBSI healthcheck service.
- Updated dependencies [82e12c8c38442379aadb957fee5ec8ca4fea4fac](https://gitlab.com/europeum/public/core-services/-/commit/82e12c8c38442379aadb957fee5ec8ca4fea4fac)
- Updated dependencies [3900b6f7697df366effd4110dc1827b6c36c169f](https://gitlab.com/europeum/public/core-services/-/commit/3900b6f7697df366effd4110dc1827b6c36c169f)
- Updated dependencies [7d078a503d96c4408fe2c78ab995053777d936fe](https://gitlab.com/europeum/public/core-services/-/commit/7d078a503d96c4408fe2c78ab995053777d936fe)
- Updated dependencies [1960638f1c5cce829eae0535733d0714632d8841](https://gitlab.com/europeum/public/core-services/-/commit/1960638f1c5cce829eae0535733d0714632d8841)
- Updated dependencies [1960638f1c5cce829eae0535733d0714632d8841](https://gitlab.com/europeum/public/core-services/-/commit/1960638f1c5cce829eae0535733d0714632d8841)
- Updated dependencies [ddfc40a1f21fae1498059618e71bf1f2e9271ee8](https://gitlab.com/europeum/public/core-services/-/commit/ddfc40a1f21fae1498059618e71bf1f2e9271ee8)
- Updated dependencies [520038797ef25f4c8ac19150274b8a5368175dfc](https://gitlab.com/europeum/public/core-services/-/commit/520038797ef25f4c8ac19150274b8a5368175dfc)
- Updated dependencies [e5e5cd041db2e6c9670a596d7526d0e7159efcc5](https://gitlab.com/europeum/public/core-services/-/commit/e5e5cd041db2e6c9670a596d7526d0e7159efcc5)
  - @ebsiint-api/shared@1.1.0-rc.7
  - @ebsiint-sc/track-and-trace@1.0.0-rc.1

## 1.0.0-rc.0

### Minor Changes

- [2c54ab141d4f76df65f6d652d210b3d1f81f5eff](https://gitlab.com/europeum/public/core-services/-/commit/2c54ab141d4f76df65f6d652d210b3d1f81f5eff): JSON RPC method: authoriseDid
- [3137c34fc0094dfac3c4fe1c8e0d59f1f647cc87](https://gitlab.com/europeum/public/core-services/-/commit/3137c34fc0094dfac3c4fe1c8e0d59f1f647cc87): Implement HEAD /accesses?created={did} endpoint.
- [d30ec895e2cded86613312e13e4023f19f0d9079](https://gitlab.com/europeum/public/core-services/-/commit/d30ec895e2cded86613312e13e4023f19f0d9079): JSON RPC method: createDocument
- [5437c2d9a600a02924ad365701c120b47202b968](https://gitlab.com/europeum/public/core-services/-/commit/5437c2d9a600a02924ad365701c120b47202b968): JSON RPC method: removeDocument
- [61fffd7ccdb3e8aa20dfe2ea6e546b3784a9adcd](https://gitlab.com/europeum/public/core-services/-/commit/61fffd7ccdb3e8aa20dfe2ea6e546b3784a9adcd): JSON RPC method: grantAccess
- [4af64a0e93ea803e0277ff429963a3be9501245a](https://gitlab.com/europeum/public/core-services/-/commit/4af64a0e93ea803e0277ff429963a3be9501245a): JSON RPC method: revokeAccess
- [5c8a5389cb8c569314fcd34494ea6b4e2fa0a41f](https://gitlab.com/europeum/public/core-services/-/commit/5c8a5389cb8c569314fcd34494ea6b4e2fa0a41f): JSON RPC method: writeEvent
- [ecb3a3b401dc810d047c087b179ec7d923f020cf](https://gitlab.com/europeum/public/core-services/-/commit/ecb3a3b401dc810d047c087b179ec7d923f020cf): Implement /documents endpoint.
- [783b060ec5059b4b75e92a1f55d651c3dcdd91b2](https://gitlab.com/europeum/public/core-services/-/commit/783b060ec5059b4b75e92a1f55d651c3dcdd91b2): Implement /documents/{documentId} endpoint.
- [264d282630aff114e793f46db6c26e0b8f0f86f6](https://gitlab.com/europeum/public/core-services/-/commit/264d282630aff114e793f46db6c26e0b8f0f86f6): Implement /documents/{documentId}/events/{eventId} endpoint.
- [264d282630aff114e793f46db6c26e0b8f0f86f6](https://gitlab.com/europeum/public/core-services/-/commit/264d282630aff114e793f46db6c26e0b8f0f86f6): Implement /documents/{documentId}/events endpoint.
- [1f7ceef55fa1c64dd6332c213409dafee3c7893d](https://gitlab.com/europeum/public/core-services/-/commit/1f7ceef55fa1c64dd6332c213409dafee3c7893d): Implement /documents/{documentId}/accesses endpoint.
- [25e6845b906d1c411de22580e0b2d75eec91d813](https://gitlab.com/europeum/public/core-services/-/commit/25e6845b906d1c411de22580e0b2d75eec91d813): Fix case in /accesses?subject={did} endpoint when there are no accesses.
- [3a72dedba5150746f815f2ed2e966a5b8768b122](https://gitlab.com/europeum/public/core-services/-/commit/3a72dedba5150746f815f2ed2e966a5b8768b122): Implement /accesses?subject={did} endpoint.
- [b1f7b53f2b918b119d40958808511bb279a20642](https://gitlab.com/europeum/public/core-services/-/commit/b1f7b53f2b918b119d40958808511bb279a20642): authoriseDid: Allow caller to authorise other DIDs

### Patch Changes

- [4f08c8952eed8dfa41e63e5b213a3ebce00ccecd](https://gitlab.com/europeum/public/core-services/-/commit/4f08c8952eed8dfa41e63e5b213a3ebce00ccecd): Bootstrap Track and Trace API v1.
- [48b06089e979a20d1ca3df1be08ac614e5b6856e](https://gitlab.com/europeum/public/core-services/-/commit/48b06089e979a20d1ca3df1be08ac614e5b6856e): Bump dependencies, support Verifiable Attestation 2024-01 schema.
- [733354a1d2e4e6a18a9a834a96b7b9a4eb321060](https://gitlab.com/europeum/public/core-services/-/commit/733354a1d2e4e6a18a9a834a96b7b9a4eb321060): Bump dependencies, update Node.js to v20.11.0.
- [fe81418ed2d3d8759944423997e4371fff61e348](https://gitlab.com/europeum/public/core-services/-/commit/fe81418ed2d3d8759944423997e4371fff61e348): Setup axios agents with `keepAlive: true`.
- [bbf0d034fe7a717e756dc89e89701e842022854b](https://gitlab.com/europeum/public/core-services/-/commit/bbf0d034fe7a717e756dc89e89701e842022854b): Enhance `grantAccess` parameters validation.
- [de238473eb36b1f275866c848e945e9417e917e3](https://gitlab.com/europeum/public/core-services/-/commit/de238473eb36b1f275866c848e945e9417e917e3): Initialize LedgerService only once.
- [f84767e4aedf5c103d6aad87f81c3708ad915e73](https://gitlab.com/europeum/public/core-services/-/commit/f84767e4aedf5c103d6aad87f81c3708ad915e73): Fix `authoriseDid`, `grantAccess` and `revokeAccess` validation: the sender DID must be the same as the access token subject.
- [f84767e4aedf5c103d6aad87f81c3708ad915e73](https://gitlab.com/europeum/public/core-services/-/commit/f84767e4aedf5c103d6aad87f81c3708ad915e73): Bump dependencies.
- Updated dependencies [61fffd7ccdb3e8aa20dfe2ea6e546b3784a9adcd](https://gitlab.com/europeum/public/core-services/-/commit/61fffd7ccdb3e8aa20dfe2ea6e546b3784a9adcd)
- Updated dependencies [0873147653f7a41503e046da3a9f8614a4b30830](https://gitlab.com/europeum/public/core-services/-/commit/0873147653f7a41503e046da3a9f8614a4b30830)
- Updated dependencies [b18de16b9b4b273e0c3e75ab3608be2ccb7e5717](https://gitlab.com/europeum/public/core-services/-/commit/b18de16b9b4b273e0c3e75ab3608be2ccb7e5717)
- Updated dependencies [99abef34ed7e8a91e3335e712173a45027f9277e](https://gitlab.com/europeum/public/core-services/-/commit/99abef34ed7e8a91e3335e712173a45027f9277e)
- Updated dependencies [e0ebf55f2a109c2b08717cf444335daa52cfc30d](https://gitlab.com/europeum/public/core-services/-/commit/e0ebf55f2a109c2b08717cf444335daa52cfc30d)
- Updated dependencies [5c6c9e9227b705958af5a1869ddfbdbe237d6262](https://gitlab.com/europeum/public/core-services/-/commit/5c6c9e9227b705958af5a1869ddfbdbe237d6262)
- Updated dependencies [48b06089e979a20d1ca3df1be08ac614e5b6856e](https://gitlab.com/europeum/public/core-services/-/commit/48b06089e979a20d1ca3df1be08ac614e5b6856e)
- Updated dependencies [99abef34ed7e8a91e3335e712173a45027f9277e](https://gitlab.com/europeum/public/core-services/-/commit/99abef34ed7e8a91e3335e712173a45027f9277e)
- Updated dependencies [733354a1d2e4e6a18a9a834a96b7b9a4eb321060](https://gitlab.com/europeum/public/core-services/-/commit/733354a1d2e4e6a18a9a834a96b7b9a4eb321060)
- Updated dependencies [fe81418ed2d3d8759944423997e4371fff61e348](https://gitlab.com/europeum/public/core-services/-/commit/fe81418ed2d3d8759944423997e4371fff61e348)
- Updated dependencies [703bfd36950e12201a30762c52812ade8b905130](https://gitlab.com/europeum/public/core-services/-/commit/703bfd36950e12201a30762c52812ade8b905130)
- Updated dependencies [38bd72f2d02dbb037e7e3fc6a6efe0216547fe21](https://gitlab.com/europeum/public/core-services/-/commit/38bd72f2d02dbb037e7e3fc6a6efe0216547fe21)
- Updated dependencies [bbf0d034fe7a717e756dc89e89701e842022854b](https://gitlab.com/europeum/public/core-services/-/commit/bbf0d034fe7a717e756dc89e89701e842022854b)
- Updated dependencies [b1f7b53f2b918b119d40958808511bb279a20642](https://gitlab.com/europeum/public/core-services/-/commit/b1f7b53f2b918b119d40958808511bb279a20642)
- Updated dependencies [f84767e4aedf5c103d6aad87f81c3708ad915e73](https://gitlab.com/europeum/public/core-services/-/commit/f84767e4aedf5c103d6aad87f81c3708ad915e73)
- Updated dependencies [79dc01786e983e02373501ec858f4897d8ae3680](https://gitlab.com/europeum/public/core-services/-/commit/79dc01786e983e02373501ec858f4897d8ae3680)
  - @ebsiint-api/shared@1.1.0-rc.6
  - @ebsiint-sc/track-and-trace@2.0.0-rc.6
