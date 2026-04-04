import type { Scope } from "../authorisation.interfaces.ts";

import { IsScope } from "../validators/index.ts";

export class GetPresentationDefinitionsDto {
  @IsScope()
  readonly "scope": Scope;
}
