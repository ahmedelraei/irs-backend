import { IsArray, IsNumber, MinLength } from 'class-validator';

export class SearchJobDto {
  @IsArray()
  @IsNumber({}, { each: true })
  @MinLength(1)
  tensor: number[];
} 