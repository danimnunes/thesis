import { bases } from "multiformats/basics";

// Export bases we support in DID Registry API
export const multibase: {
  // This manual types mapping is necessary to avoid the following error:
  // "The inferred type of "X" cannot be named without a reference to "Y". This is likely not portable. A type annotation is necessary"
  base16: typeof bases.base16;
  base58btc: typeof bases.base58btc;
  base64: typeof bases.base64;
  base64url: typeof bases.base64url;
} = {
  base16: bases.base16,
  base58btc: bases.base58btc,
  base64: bases.base64,
  base64url: bases.base64url,
} as const;
