import { IsHexadecimal, Length, Matches } from "class-validator";

import { GetSchemaParams } from "./get-schema.params.ts";

export class GetSchemaRevisionParams extends GetSchemaParams {
  @IsHexadecimal()
  @Length(66, 66, { message: "schemaRevisionId must have 66 characters" })
  @Matches(/^0x/, { message: "schemaRevisionId must start with 0x" })
  schemaRevisionId!: string;
}
