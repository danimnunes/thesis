export const Permission = {
  CREATOR: 2,
  DELEGATE: 0,
  WRITE: 1,
} as const;

export const PermissionLabel = {
  [Permission.CREATOR]: "creator",
  [Permission.DELEGATE]: "delegate",
  [Permission.WRITE]: "write",
} as const satisfies Record<
  (typeof Permission)[keyof typeof Permission],
  string
>;

export const AccountType = {
  DID_EBSI: 0,
  DID_KEY: 1,
} as const;
