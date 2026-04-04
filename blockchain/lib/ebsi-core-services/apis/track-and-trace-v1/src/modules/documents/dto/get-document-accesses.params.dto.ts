import { Is32BytesHex } from "../validators/Is32BytesHex.ts";

export class GetDocumentAccessesParamsDto {
  @Is32BytesHex()
  "documentId"!: string;
}
