import { IsEmail, IsEmpty, IsNotEmpty } from 'class-validator';

export class UpdateUserDto {
  @IsNotEmpty({ message: 'First Name is required' })
  readonly firstName: string;

  @IsNotEmpty({ message: 'Last Name is required' })
  readonly lastName: string;

  @IsNotEmpty({ message: 'Username is required' })
  readonly username: string;

  @IsNotEmpty({ message: 'Email is required' })
  @IsEmail({}, { message: 'Email must be a valid email address' })
  readonly email: string;

  @IsEmpty()
  resume: string;
}
