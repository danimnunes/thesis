import { Is32BytesHex } from "../validators/Is32BytesHex.ts";

export class GetDocumentEventsParamsDto {
  @Is32BytesHex()
  "documentId"!: string;
}
