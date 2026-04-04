import { Is32BytesHex } from "../validators/Is32BytesHex.ts";

export class GetDocumentEventParamsDto {
  @Is32BytesHex()
  "documentId"!: string;

  @Is32BytesHex()
  "eventId"!: string;
}
