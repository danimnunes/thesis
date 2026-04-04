import { Equals, IsJSON, IsJWT, IsString } from "class-validator";

import type { Scope } from "../authorisation.interfaces.ts";

import { IsScope } from "../validators/index.ts";

export class CreateAccessTokenDto {
  @IsString()
  @Equals("vp_token")
  readonly "grant_type": string;

  @IsScope()
  readonly "scope": Scope;

  @IsJWT()
  readonly "vp_token": string;

  @IsJSON()
  readonly "presentation_submission": string;
}
