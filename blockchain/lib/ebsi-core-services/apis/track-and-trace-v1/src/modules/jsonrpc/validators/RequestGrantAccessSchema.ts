import { isBigNumberish } from "@ebsiint-api/shared";
import { ethers } from "ethers";
import { z } from "zod";

import { AccountType } from "../../../shared/constants.ts";
import { hexToDid } from "../../../shared/utils.ts";
import { baseParamSchema } from "./BaseParamSchema.ts";
import { jsonRpcSchema } from "./JsonRpcSchema.ts";
import { refinements } from "./utils.ts";

const { isHexadecimal, isSender } = refinements;

export const grantAccessSchema = baseParamSchema
  .merge(
    z.object({
      documentHash: z.string().superRefine(isHexadecimal),
      grantedByAccount: z.string().superRefine(isSender),
      grantedByAccType: z
        .custom<ethers.BigNumberish>((val) => isBigNumberish(val))
        .refine(
          (val) => ethers.getBigInt(val) === 0n || ethers.getBigInt(val) === 1n,
          {
            message: "Number must be 0 (did:ebsi) or 1 (did:key)",
          },
        ),
      permission: z
        .custom<ethers.BigNumberish>((val) => isBigNumberish(val))
        .refine(
          (val) => ethers.getBigInt(val) === 0n || ethers.getBigInt(val) === 1n,
          {
            message: "Number must be 0 (delegate) or 1 (write)",
          },
        ),
      subjectAccount: z.string().superRefine(isSender),
      subjectAccType: z
        .custom<ethers.BigNumberish>((val) => isBigNumberish(val))
        .refine(
          (val) => ethers.getBigInt(val) === 0n || ethers.getBigInt(val) === 1n,
          {
            message: "Number must be 0 (did:ebsi) or 1 (did:key)",
          },
        ),
    }),
  )
  .superRefine(
    (
      { grantedByAccount, grantedByAccType, subjectAccount, subjectAccType },
      ctx,
    ) => {
      const grantedByAccountDid = hexToDid(grantedByAccount);
      if (
        (grantedByAccType === AccountType.DID_EBSI &&
          !grantedByAccountDid.startsWith("did:ebsi:")) ||
        (grantedByAccType === AccountType.DID_KEY &&
          !grantedByAccountDid.startsWith("did:key:"))
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "grantedByAccount and grantedByAccType don't match",
        });
      }

      const subjectAccountDid = hexToDid(subjectAccount);
      if (
        (subjectAccType === AccountType.DID_EBSI &&
          !subjectAccountDid.startsWith("did:ebsi:")) ||
        (subjectAccType === AccountType.DID_KEY &&
          !subjectAccountDid.startsWith("did:key:"))
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "subjectAccount and subjectAccType don't match",
        });
      }
    },
  );

export type GrantAccessSchema = z.infer<typeof grantAccessSchema>;

export const requestGrantAccessDtoSchema = jsonRpcSchema.merge(
  z.object({
    method: z.literal("grantAccess"),
    params: z.array(grantAccessSchema).min(1).max(1),
  }),
);
