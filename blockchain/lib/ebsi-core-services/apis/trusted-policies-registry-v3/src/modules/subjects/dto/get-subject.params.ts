import { IsEthereumAddress } from "@ebsiint-api/shared";

export class GetSubjectParams {
  @IsEthereumAddress()
  subject!: string;
}
