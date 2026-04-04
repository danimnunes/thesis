import { applyDecorators, SetMetadata, UseGuards } from "@nestjs/common";

import { AcceptsGuard } from "../guards/accepts.guard.ts";

export const Accepts = (...types: string[]) =>
  applyDecorators(SetMetadata("accepts", types), UseGuards(AcceptsGuard));
