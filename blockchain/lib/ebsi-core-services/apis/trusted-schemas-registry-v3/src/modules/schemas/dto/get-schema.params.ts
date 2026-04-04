import { IsSchemaId } from "@ebsiint-api/shared";

export class GetSchemaParams {
  @IsSchemaId()
  schemaId!: string;
}
