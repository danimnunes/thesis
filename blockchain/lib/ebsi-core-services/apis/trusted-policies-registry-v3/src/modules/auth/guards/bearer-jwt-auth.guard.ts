import type { ExecutionContext } from "@nestjs/common";
import type { Observable } from "rxjs";

import { UnauthorizedError } from "@ebsiint-api/shared";
import { Injectable } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";

import type { SubjectInfo } from "../auth.interface.ts";

@Injectable()
export class BearerJwtAuthGuard extends AuthGuard("bearer-jwt") {
  override canActivate(
    context: ExecutionContext,
  ): boolean | Observable<boolean> | Promise<boolean> {
    return super.canActivate(context);
  }

  override handleRequest<TUser = SubjectInfo>(
    err: Error,
    subjectInfo: TUser,
    info: unknown,
  ): TUser {
    // You can throw an exception based on either "info" or "err" arguments
    if (err || info || !subjectInfo) {
      throw (
        err ||
        new UnauthorizedError(UnauthorizedError.defaultTitle, {
          detail: "Invalid or missing JWT",
        })
      );
    }

    return subjectInfo;
  }
}
