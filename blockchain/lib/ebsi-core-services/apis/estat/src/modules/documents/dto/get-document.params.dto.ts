import { Is32BytesHex } from "../validators/Is32BytesHex.ts";

export class GetDocumentParamsDto {
  @Is32BytesHex()
  "documentId"!: string;
}
