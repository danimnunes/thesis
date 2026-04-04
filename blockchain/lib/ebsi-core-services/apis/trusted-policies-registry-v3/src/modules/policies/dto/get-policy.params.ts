import { IsString } from "class-validator";

export class GetPolicyParams {
  @IsString()
  policyName!: string;
}
