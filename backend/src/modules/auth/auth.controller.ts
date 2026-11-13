import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { SessionAuthGuard } from './guards/session-auth.guard';
import type { AuthenticatedUser } from './guards/session-auth.guard';
import { SessionService } from './session/session.service';

/** Credential endpoints get a much tighter budget than the rest of the API. */
const CREDENTIAL_THROTTLE = { short: { limit: 10, ttl: 60_000 } };

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly sessionService: SessionService,
    private readonly configService: ConfigService,
  ) {}

  private clearSessionCookie(res: Response): void {
    res.clearCookie(
      this.configService.get<string>('session.cookieName', 'stackly.sid'),
      {
        httpOnly: true,
        sameSite: 'lax',
        secure: this.configService.get<string>('nodeEnv') === 'production',
        path: '/',
      },
    );
  }

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @Throttle(CREDENTIAL_THROTTLE)
  @ApiOperation({ summary: 'Register a new user account' })
  @ApiResponse({
    status: 201,
    description: 'User successfully registered and authenticated',
  })
  async register(@Body() dto: RegisterDto, @Req() req: Request) {
    return this.authService.register(dto, req);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle(CREDENTIAL_THROTTLE)
  @ApiOperation({ summary: 'Log in with email and password' })
  @ApiResponse({ status: 200, description: 'Session created' })
  async login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.authService.login(dto, req);
  }

  @Get('me')
  @UseGuards(SessionAuthGuard)
  @ApiOperation({ summary: 'Get current authenticated user' })
  getMe(@CurrentUser() user: AuthenticatedUser) {
    return { user };
  }

  @Get('account')
  @UseGuards(SessionAuthGuard)
  @ApiOperation({
    summary:
      'Account details: sign-in methods, linked providers, password state',
  })
  getAccount(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.getAccount(user.id);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Log out and invalidate session' })
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.authService.logout(req);
    this.clearSessionCookie(res);
    return { success: true };
  }

  @Patch('password')
  @UseGuards(SessionAuthGuard)
  @Throttle(CREDENTIAL_THROTTLE)
  @ApiOperation({
    summary: 'Change the account password (or set the first one)',
  })
  @ApiResponse({ status: 200, description: 'Password successfully updated' })
  async updatePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangePasswordDto,
    @Req() req: Request,
  ) {
    return this.authService.changePassword(user.id, dto, req.sessionID);
  }

  /* ─── Sessions ──────────────────────────────────────────────────────── */

  @Get('sessions')
  @UseGuards(SessionAuthGuard)
  @ApiOperation({ summary: 'List active sessions of the current account' })
  async listSessions(
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.sessionService.list(user.id, req.sessionID);
  }

  @Post('sessions/revoke-others')
  @HttpCode(HttpStatus.OK)
  @UseGuards(SessionAuthGuard)
  @ApiOperation({ summary: 'Sign out every other device' })
  async revokeOtherSessions(
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    const revoked = await this.sessionService.revokeAll(user.id, req.sessionID);
    return { success: true, revoked };
  }

  @Delete('sessions/:id')
  @UseGuards(SessionAuthGuard)
  @ApiOperation({ summary: 'Revoke one session of the current account' })
  async revokeSession(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    await this.sessionService.revoke(user.id, id);
    return { success: true };
  }

  /* ─── Linked sign-in providers ──────────────────────────────────────── */

  @Delete('identities/:provider')
  @UseGuards(SessionAuthGuard)
  @ApiOperation({
    summary: 'Unlink a sign-in provider from the current account',
  })
  async unlinkIdentity(
    @CurrentUser() user: AuthenticatedUser,
    @Param('provider') provider: string,
  ) {
    return this.authService.unlinkIdentity(user.id, provider);
  }

  /* ─── Data portability & deletion ───────────────────────────────────── */

  @Get('export')
  @UseGuards(SessionAuthGuard)
  @ApiOperation({ summary: 'Export all personal data as JSON archive' })
  @ApiResponse({ status: 200, description: 'Data export archive returned' })
  async exportData(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.exportUserData(user.id);
  }

  @Delete('account')
  @UseGuards(SessionAuthGuard)
  @ApiOperation({
    summary: 'Delete user account and cascade delete all user-owned data',
  })
  @ApiResponse({ status: 200, description: 'Account successfully deleted' })
  async deleteAccount(
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.deleteAccount(user.id, req);
    this.clearSessionCookie(res);
    return result;
  }
}
