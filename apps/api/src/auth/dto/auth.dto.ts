import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, Matches, MaxLength, MinLength } from 'class-validator';

const lower = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toLowerCase() : value);

export class RegisterDto {
  @IsString() @IsNotEmpty() @MaxLength(80)
  name: string;

  @Transform(lower) @IsEmail({}, { message: 'Format email tidak valid' }) @MaxLength(160)
  email: string;

  @IsString() @MinLength(8, { message: 'Kata sandi minimal 8 karakter' }) @MaxLength(72)
  @Matches(/[A-Z]/, { message: 'Kata sandi harus punya minimal 1 huruf besar' })
  @Matches(/[^A-Za-z0-9]/, { message: 'Kata sandi harus punya minimal 1 simbol (mis. * & !)' })
  password: string;
}

export class LoginDto {
  @Transform(lower) @IsEmail({}, { message: 'Format email tidak valid' })
  email: string;

  @IsString() @IsNotEmpty() @MaxLength(72)
  password: string;
}

export class GoogleLoginDto {
  @IsString() @IsNotEmpty() @MaxLength(4000)
  credential: string;
}

export class ForgotPasswordDto {
  @Transform(lower) @IsEmail({}, { message: 'Format email tidak valid' })
  email: string;
}

export class ResetPasswordDto {
  @IsString() @IsNotEmpty() @MaxLength(100)
  token: string;

  @IsString() @MinLength(8, { message: 'Kata sandi minimal 8 karakter' }) @MaxLength(72)
  @Matches(/[A-Z]/, { message: 'Kata sandi harus punya minimal 1 huruf besar' })
  @Matches(/[^A-Za-z0-9]/, { message: 'Kata sandi harus punya minimal 1 simbol (mis. * & !)' })
  password: string;
}

export class ChangePasswordDto {
  @IsString() @IsNotEmpty() @MaxLength(72)
  currentPassword: string;

  @IsString() @MinLength(8, { message: 'Kata sandi minimal 8 karakter' }) @MaxLength(72)
  @Matches(/[A-Z]/, { message: 'Kata sandi harus punya minimal 1 huruf besar' })
  @Matches(/[^A-Za-z0-9]/, { message: 'Kata sandi harus punya minimal 1 simbol (mis. * & !)' })
  newPassword: string;
}

export class UpdateProfileDto {
  @IsString() @IsNotEmpty() @MaxLength(80)
  name: string;
}