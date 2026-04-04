import "reflect-metadata";
import { Type } from "class-transformer";
import { IsNumber, Max, Min } from "class-validator";

export class PaginationQuery {
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  "page[after]" = 1;

  @IsNumber()
  @Max(50)
  @Min(1)
  @Type(() => Number)
  "page[size]" = 10;
}
