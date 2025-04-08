import { Transform } from 'class-transformer';
import { IsString, IsOptional } from 'class-validator';
import { UserDocument } from '../schemas/user.schema';

export class GetUserDto {
  @IsString()
  id: string;

  @IsString()
  email: string;

  @IsString()
  name: string;

  @IsString()
  @Transform(({ obj }) => obj.profile?.jobTitle)
  jobTitle: string;

  @IsOptional()
  @IsString()
  resumeUrl?: string;

}
