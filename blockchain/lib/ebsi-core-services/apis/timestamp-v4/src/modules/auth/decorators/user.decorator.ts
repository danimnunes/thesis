import type { ExecutionContext } from "@nestjs/common";

import { createParamDecorator } from "@nestjs/common";

import type { UserInfo } from "../auth.interface.ts";

export type { UserInfo } from "../auth.interface.ts";

export const User = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<{ user: UserInfo }>();
    return request.user;
  },
);
