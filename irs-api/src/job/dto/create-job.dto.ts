import { IsString, IsNotEmpty, MinLength, MaxLength } from 'class-validator';

export class CreateJobDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(100)
  title: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  @MaxLength(2000)
  description: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(50)
  company: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(5)
  @MaxLength(2000)
  applyUrl: string;
}
