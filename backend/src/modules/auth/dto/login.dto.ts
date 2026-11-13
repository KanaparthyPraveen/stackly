import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class LoginDto {
  @IsEmail({}, { message: 'email must be an email' })
  @IsNotEmpty({ message: 'email should not be empty' })
  @MaxLength(254)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.toLowerCase().trim() : value,
  )
  email: string;

  @IsString({ message: 'password must be a string' })
  @IsNotEmpty({ message: 'password should not be empty' })
  @MinLength(6, { message: 'password must be at least 6 characters long' })
  // bcrypt only reads the first 72 bytes; longer input is a hashing-cost DoS.
  @MaxLength(72)
  password: string;
}
