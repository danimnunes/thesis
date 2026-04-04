import { ethers } from "ethers";

export function isBigNumberish(val: unknown): boolean {
  try {
    ethers.getBigInt(val as ethers.BigNumberish);
    return true;
  } catch {
    return false;
  }
}
