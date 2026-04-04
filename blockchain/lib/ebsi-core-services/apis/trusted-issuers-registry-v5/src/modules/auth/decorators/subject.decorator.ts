import type { ExecutionContext } from "@nestjs/common";

import { createParamDecorator } from "@nestjs/common";

import type { SubjectInfo } from "../auth.interface.ts";

export type { SubjectInfo } from "../auth.interface.ts";

export const Subject = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<{ user: SubjectInfo }>();
    return request.user ?? {};
  },
);
