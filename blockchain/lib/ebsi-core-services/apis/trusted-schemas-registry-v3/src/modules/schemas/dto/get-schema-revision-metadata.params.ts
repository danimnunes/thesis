import { IsHexadecimal, Length, Matches } from "class-validator";

import { GetSchemaRevisionParams } from "./get-schema-revisions.params.ts";

export class GetSchemaRevisionMetadataParams extends GetSchemaRevisionParams {
  @IsHexadecimal()
  @Length(66, 66, { message: "metadataId must have 66 characters" })
  @Matches(/^0x/, { message: "metadataId must start with 0x" })
  metadataId!: string;
}
