import { Body, Controller, Get, HttpCode, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import {
  ChangePasswordDto, ForgotPasswordDto, GoogleLoginDto, LoginDto, RegisterDto, ResetPasswordDto, UpdateProfileDto,
} from './dto/auth.dto';
import { CurrentUser, JwtAuthGuard } from './jwt-auth.guard';

const STRICT = { default: { limit: 5, ttl: 60_000 } };

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register') @Throttle(STRICT)
  register(@Body() dto: RegisterDto) { return this.auth.register(dto); }

  @Post('login') @HttpCode(200) @Throttle(STRICT)
  login(@Body() dto: LoginDto) { return this.auth.login(dto); }

  @Post('google') @HttpCode(200) @Throttle(STRICT)
  @ApiOperation({ summary: 'Masuk/daftar dengan Google (kirim ID token dari Google Identity Services)' })
  google(@Body() dto: GoogleLoginDto) { return this.auth.googleLogin(dto.credential); }

  @Get('config')
  @ApiOperation({ summary: 'Konfigurasi publik untuk frontend (client id Google bila diaktifkan)' })
  config() { return { googleClientId: process.env.GOOGLE_CLIENT_ID || null }; }

  @Post('forgot-password') @HttpCode(200) @Throttle(STRICT)
  @ApiOperation({ summary: 'Kirim tautan reset kata sandi (respons selalu sama)' })
  forgot(@Body() dto: ForgotPasswordDto) { return this.auth.forgotPassword(dto.email); }

  @Post('reset-password') @HttpCode(200) @Throttle(STRICT)
  reset(@Body() dto: ResetPasswordDto) { return this.auth.resetPassword(dto); }

  @Get('me') @UseGuards(JwtAuthGuard) @ApiBearerAuth()
  me(@CurrentUser() userId: string) { return this.auth.me(userId); }

  @Patch('me') @UseGuards(JwtAuthGuard) @ApiBearerAuth()
  update(@CurrentUser() userId: string, @Body() dto: UpdateProfileDto) { return this.auth.updateProfile(userId, dto.name); }

  @Post('change-password') @HttpCode(200) @UseGuards(JwtAuthGuard) @ApiBearerAuth() @Throttle(STRICT)
  change(@CurrentUser() userId: string, @Body() dto: ChangePasswordDto) { return this.auth.changePassword(userId, dto); }
}
