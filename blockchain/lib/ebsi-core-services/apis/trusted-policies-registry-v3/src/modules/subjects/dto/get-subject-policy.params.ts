import { IsEthereumAddress } from "@ebsiint-api/shared";
import { IsString } from "class-validator";

export class GetSubjectPolicyParams {
  @IsString()
  policyName!: string;

  @IsEthereumAddress()
  subject!: string;
}
