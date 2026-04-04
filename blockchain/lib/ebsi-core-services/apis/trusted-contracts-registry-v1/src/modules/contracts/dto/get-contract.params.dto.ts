import { IsEthereumAddress } from "class-validator";

export class GetContractParamsDto {
  @IsEthereumAddress()
  "address"!: string;
}
