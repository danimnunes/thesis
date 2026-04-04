export const IssuerType = {
  Revoked: 4,
  RootTAO: 1,
  TAO: 2,
  TI: 3,
  Undefined: 0,
} as const;

export const IssuerTypeNames = [
  "undefined",
  "RootTAO",
  "TAO",
  "TI",
  "Revoked",
] as const;
