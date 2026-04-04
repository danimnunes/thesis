import { IsEthereumAddress } from "@ebsiint-api/shared";

export class GetUserParams {
  @IsEthereumAddress()
  user!: string;
}
