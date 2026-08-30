import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  InternalServerErrorException,
  Optional,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request, Response } from 'express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  SAPLING_FRONTEND_URL,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE,
  SESSION_REMEMBER_ME_MAX_AGE,
} from '../constants/project.constants';
import { SessionOrBearerAuthGuard } from './guard/session-or-token-auth.guard';
import { AuthService } from './auth.service';
import { AuthProviderUserImportService } from './auth-provider-user-import.service';
import {
  AuthPasskeyService,
  type PasskeyRequestContext,
} from './auth-passkey.service';
import {
  BeginPasskeyRegistrationDto,
  LocalLoginPasskeyChallengeResponseDto,
  PasskeyRegistrationOptionsResponseDto,
  PasskeyResponseDto,
  VerifyPasskeyAuthenticationDto,
  VerifyPasskeyRegistrationDto,
} from './dto/passkey.dto';
import { PersonItem } from '../entity/PersonItem';
import { createSessionCookieSecurityOptions } from '../session/session.config';
import {
  AuthenticationTelemetryProvider,
  AuthenticationTelemetryService,
} from './authentication-telemetry.service';

const PASSKEY_CHALLENGE_TTL_MS = 5 * 60 * 1000;

type PasskeyRegistrationSessionPayload = {
  challenge: string;
  context: PasskeyRequestContext;
  createdAt: number;
};

type PasskeyLoginSessionPayload = PasskeyRegistrationSessionPayload & {
  personHandle: number;
  rememberMe: boolean;
};

type PasskeySessionData = {
  passkeyRegistration?: PasskeyRegistrationSessionPayload;
  passkeyLogin?: PasskeyLoginSessionPayload;
};

/**
 * @class
 * @version         1.0
 * @author          Martin Rosbund
 * @summary         Controller for authentication endpoints (local, Azure AD, Google).
 *
 * @method          localLogin           Local login endpoint using Passport local strategy
 * @method          azureLogin           Azure AD login endpoint (redirects to Azure login)
 * @method          azureCallback        Azure AD callback endpoint (handles Azure login response)
 * @method          googleLogin          Google login endpoint (redirects to Google login)
 * @method          googleCallback       Google callback endpoint (handles Google login response)
 * @method          logout               Logout endpoint (destroys session and redirects)
 * @method          isAuthenticated      Checks if the user is authenticated (session-based)
 */
@ApiTags('Auth')
@Controller('api/auth')
export class AuthController {
  constructor(
    _authService?: AuthService,
    _providerUserImportService?: AuthProviderUserImportService,
    private readonly authPasskeyService?: AuthPasskeyService,
    @Optional()
    private readonly authenticationTelemetry?: AuthenticationTelemetryService,
  ) {}

  private completeLogin(
    req: Request,
    res: Response,
    onSuccess: (user: Express.User) => void,
    provider: AuthenticationTelemetryProvider = 'unknown',
  ): void {
    const user = req.user;

    if (!user) {
      res.status(400).send('User not found');
      return;
    }

    const establishLogin = () => {
      req.login(user, (error) => {
        if (error) {
          res.status(500).send(error);
          return;
        }

        const handle =
          typeof user === 'object' && user && 'handle' in user
            ? (user as { handle?: unknown }).handle
            : null;
        void this.authenticationTelemetry?.record(
          'loginSuccess',
          provider,
          typeof handle === 'number' ? handle : null,
        );
        onSuccess(user);
      });
    };

    if (!req.session) {
      establishLogin();
      return;
    }

    req.session.regenerate((error) => {
      if (error) {
        res.status(500).send(error);
        return;
      }

      establishLogin();
    });
  }

  private getPasskeyService(): AuthPasskeyService {
    if (!this.authPasskeyService) {
      throw new InternalServerErrorException('login.passkeyUnavailable');
    }

    return this.authPasskeyService;
  }

  private getPasskeySession(req: Request): PasskeySessionData {
    return (req.session ?? {}) as unknown as PasskeySessionData;
  }

  private async saveSession(req: Request): Promise<void> {
    const session = req.session as
      | (Request['session'] & {
          save?: (callback: (error?: Error) => void) => void;
        })
      | undefined;

    if (typeof session?.save !== 'function') {
      return;
    }

    await new Promise<void>((resolve, reject) =>
      session.save((error?: Error) => (error ? reject(error) : resolve())),
    );
  }

  private assertFreshPasskeyRegistrationSession(
    req: Request,
  ): PasskeyRegistrationSessionPayload {
    const payload = this.getPasskeySession(req).passkeyRegistration;
    if (!payload || Date.now() - payload.createdAt > PASSKEY_CHALLENGE_TTL_MS) {
      throw new BadRequestException('login.passkeyChallengeExpired');
    }

    return payload;
  }

  private assertFreshPasskeyLoginSession(
    req: Request,
  ): PasskeyLoginSessionPayload {
    const payload = this.getPasskeySession(req).passkeyLogin;
    if (!payload || Date.now() - payload.createdAt > PASSKEY_CHALLENGE_TTL_MS) {
      throw new BadRequestException('login.passkeyChallengeExpired');
    }

    return payload;
  }

  private clearPasskeyRegistrationSession(req: Request): void {
    delete this.getPasskeySession(req).passkeyRegistration;
  }

  private clearPasskeyLoginSession(req: Request): void {
    delete this.getPasskeySession(req).passkeyLogin;
  }

  private setSessionMaxAge(req: Request, rememberMe: boolean): void {
    if (!req.session?.cookie) {
      return;
    }

    req.session.cookie.maxAge = rememberMe
      ? SESSION_REMEMBER_ME_MAX_AGE
      : SESSION_MAX_AGE;
  }

  /**
   * Local login endpoint using Passport local strategy.
   * @param req Express request object
   * @param res Express response object
   * @returns Authenticated user object
   * @route POST /api/auth/local/login
   * @access Public
   */
  @Post('local/login')
  @ApiOperation({
    summary: 'Local login',
    description: 'Authenticate user using local strategy.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        username: { type: 'string', description: 'Username' },
        password: { type: 'string', description: 'Password' },
      },
      required: ['username', 'password'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Authenticated user object',
    type: Object,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(AuthGuard('local'))
  async localLogin(@Req() req: Request, @Res() res: Response) {
    const user = req.user as PersonItem | undefined;
    const body = req.body as { rememberMe?: unknown } | undefined;

    if (
      user &&
      this.authPasskeyService &&
      (await this.authPasskeyService.hasPasskeysForPerson(user.handle))
    ) {
      if (typeof user.handle !== 'number') {
        throw new ForbiddenException('global.permissionDenied');
      }

      const context = this.authPasskeyService.resolveRequestContext(req);
      const options = await this.authPasskeyService.createAuthenticationOptions(
        user.handle,
        context,
      );
      this.getPasskeySession(req).passkeyLogin = {
        challenge: options.challenge,
        context,
        createdAt: Date.now(),
        personHandle: user.handle,
        rememberMe: body?.rememberMe === true,
      };
      await this.saveSession(req);
      res.send({
        passkeyRequired: true,
        options,
      } satisfies LocalLoginPasskeyChallengeResponseDto);
      return;
    }

    this.completeLogin(
      req,
      res,
      () => {
        this.setSessionMaxAge(req, body?.rememberMe === true);
        res.send();
      },
      'local',
    );
  }

  @Post('local/passkey/verify')
  @ApiOperation({
    summary: 'Verify local login passkey challenge',
    description:
      'Completes local username/password login after a registered passkey assertion succeeds.',
  })
  @ApiBody({ type: VerifyPasskeyAuthenticationDto })
  @ApiResponse({ status: 200, description: 'Passkey verified' })
  @ApiResponse({ status: 400, description: 'Challenge missing or expired' })
  @ApiResponse({ status: 403, description: 'Passkey verification failed' })
  async verifyLocalPasskeyLogin(
    @Req() req: Request,
    @Res() res: Response,
    @Body() dto: VerifyPasskeyAuthenticationDto,
  ): Promise<void> {
    const passkeyService = this.getPasskeyService();
    const sessionPayload = this.assertFreshPasskeyLoginSession(req);
    this.clearPasskeyLoginSession(req);

    let user: PersonItem;
    try {
      user = await passkeyService.verifyAuthentication(
        sessionPayload.personHandle,
        dto.response,
        sessionPayload.challenge,
        sessionPayload.context,
      );
    } catch (error) {
      void this.authenticationTelemetry?.record(
        'loginFailure',
        'passkey',
        sessionPayload.personHandle,
      );
      throw error;
    }
    req.user = user;

    this.completeLogin(
      req,
      res,
      () => {
        this.setSessionMaxAge(req, sessionPayload.rememberMe);
        res.send();
      },
      'passkey',
    );
  }

  /**
   * Azure AD login endpoint (redirects to Azure login).
   * @returns Redirect to Azure AD login
   * @route GET /api/auth/azure/login
   * @access Public
   */
  @Get('azure/login')
  @ApiOperation({
    summary: 'Azure AD login',
    description: 'Redirects to Azure AD login.',
  })
  @ApiResponse({ status: 302, description: 'Redirect to Azure AD login' })
  @UseGuards(AuthGuard('azure-ad'))
  azureLogin() {}

  /**
   * Azure AD callback endpoint (handles Azure login response).
   * @param req Express request object
   * @param res Express response object
   * @returns Redirect to frontend or error
   * @route GET /api/auth/azure/callback
   * @access Public
   */
  @Get('azure/callback')
  @ApiOperation({
    summary: 'Azure AD callback',
    description: 'Handles Azure AD login response.',
  })
  @ApiResponse({ status: 302, description: 'Redirect to frontend on success' })
  @ApiResponse({ status: 400, description: 'User not found' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  @UseGuards(AuthGuard('azure-ad'))
  azureCallback(@Req() req: Request, @Res() res: Response) {
    if (!req.user) {
      void this.authenticationTelemetry?.record('loginFailure', 'azure');
      return res.status(400).send('User not found');
    }
    this.completeLogin(
      req,
      res,
      () => {
        res.redirect(SAPLING_FRONTEND_URL);
      },
      'azure',
    );
  }

  /**
   * Google login endpoint (redirects to Google login).
   * @returns Redirect to Google login
   * @route GET /api/auth/google/login
   * @access Public
   */
  @Get('google/login')
  @ApiOperation({
    summary: 'Google login',
    description: 'Redirects to Google login.',
  })
  @ApiResponse({ status: 302, description: 'Redirect to Google login' })
  @UseGuards(AuthGuard('google'))
  googleLogin() {}

  /**
   * Google callback endpoint (handles Google login response).
   * @param req Express request object
   * @param res Express response object
   * @returns Redirect to frontend or error
   * @route GET /api/auth/google/callback
   * @access Public
   */
  @Get('google/callback')
  @ApiOperation({
    summary: 'Google callback',
    description: 'Handles Google login response.',
  })
  @ApiResponse({ status: 302, description: 'Redirect to frontend on success' })
  @ApiResponse({ status: 400, description: 'User not found' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  @UseGuards(AuthGuard('google'))
  googleCallback(@Req() req: Request, @Res() res: Response) {
    if (!req.user) {
      void this.authenticationTelemetry?.record('loginFailure', 'google');
      return res.status(400).send('User not found');
    }
    this.completeLogin(
      req,
      res,
      () => {
        res.redirect(SAPLING_FRONTEND_URL);
      },
      'google',
    );
  }

  /**
   * Logout endpoint (destroys session and clears the auth cookie).
   * @param req Express request object
   * @param res Express response object
   * @returns Success state
   * @route POST /api/auth/logout
   * @access Public
   */
  @Post('logout')
  @ApiOperation({
    summary: 'Logout',
    description: 'Destroys session and clears the authentication cookie.',
  })
  @ApiResponse({ status: 200, description: 'Logout completed successfully' })
  logout(@Req() req: Request, @Res() res: Response) {
    const personHandle =
      typeof req.user === 'object' && req.user && 'handle' in req.user
        ? (req.user as { handle?: unknown }).handle
        : null;
    req.logout((logoutError) => {
      if (logoutError) {
        res.status(500).send(logoutError);
        return;
      }

      void this.authenticationTelemetry?.record(
        'logout',
        'unknown',
        typeof personHandle === 'number' ? personHandle : null,
      );

      if (!req.session) {
        res.clearCookie(
          SESSION_COOKIE_NAME,
          createSessionCookieSecurityOptions(),
        );
        res.status(200).send({ success: true });
        return;
      }

      req.session.destroy((sessionError) => {
        if (sessionError) {
          res.status(500).send(sessionError);
          return;
        }

        res.clearCookie(
          SESSION_COOKIE_NAME,
          createSessionCookieSecurityOptions(),
        );
        res.status(200).send({ success: true });
      });
    });
  }

  /**
   * Checks if the user is authenticated (session-based).
   * @param req Express request object
   * @param res Express response object
   * @returns Authenticated status
   * @route GET /api/auth/isAuthenticated
   * @access Public
   */
  @Get('isAuthenticated')
  @ApiOperation({
    summary: 'Check authentication',
    description: 'Checks if the user is authenticated (session-based).',
  })
  @ApiResponse({
    status: 200,
    description: 'User is authenticated',
    schema: {
      type: 'object',
      properties: { authenticated: { type: 'boolean' } },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'User is not authenticated',
    schema: {
      type: 'object',
      properties: { authenticated: { type: 'boolean' } },
    },
  })
  isAuthenticated(@Req() req: Request, @Res() res: Response) {
    if (req.isAuthenticated()) {
      return res.status(200).send({ authenticated: true });
    } else {
      return res.status(401).send({ authenticated: false });
    }
  }

  @Get('passkey')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'List current user passkeys',
    description: 'Returns passkey metadata for the authenticated user.',
  })
  @ApiResponse({
    status: 200,
    description: 'Registered passkeys',
    type: PasskeyResponseDto,
    isArray: true,
  })
  @UseGuards(SessionOrBearerAuthGuard)
  listPasskeys(
    @Req() req: Request & { user: PersonItem },
  ): Promise<PasskeyResponseDto[]> {
    return this.getPasskeyService().listPasskeys(req.user);
  }

  @Post('passkey/register/options')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Begin passkey registration',
    description:
      'Creates WebAuthn registration options and stores the short-lived challenge in the current session.',
  })
  @ApiBody({ type: BeginPasskeyRegistrationDto })
  @ApiResponse({
    status: 201,
    description: 'Passkey registration options',
    type: PasskeyRegistrationOptionsResponseDto,
  })
  @UseGuards(SessionOrBearerAuthGuard)
  async beginPasskeyRegistration(
    @Req() req: Request & { user: PersonItem },
  ): Promise<PasskeyRegistrationOptionsResponseDto> {
    if (!req.session) {
      throw new BadRequestException('login.passkeySessionRequired');
    }

    const passkeyService = this.getPasskeyService();
    const context = passkeyService.resolveRequestContext(req);
    const options = await passkeyService.createRegistrationOptions(
      req.user,
      context,
    );

    this.getPasskeySession(req).passkeyRegistration = {
      challenge: options.challenge,
      context,
      createdAt: Date.now(),
    };
    await this.saveSession(req);

    return { options };
  }

  @Post('passkey/register/verify')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Verify passkey registration',
    description:
      'Verifies a WebAuthn registration response and stores the resulting credential for the authenticated user.',
  })
  @ApiBody({ type: VerifyPasskeyRegistrationDto })
  @ApiResponse({
    status: 201,
    description: 'Registered passkey metadata',
    type: PasskeyResponseDto,
  })
  @UseGuards(SessionOrBearerAuthGuard)
  async verifyPasskeyRegistration(
    @Req() req: Request & { user: PersonItem },
    @Body() dto: VerifyPasskeyRegistrationDto,
  ): Promise<PasskeyResponseDto> {
    const sessionPayload = this.assertFreshPasskeyRegistrationSession(req);
    this.clearPasskeyRegistrationSession(req);

    return this.getPasskeyService().verifyRegistration(
      req.user,
      dto.response,
      sessionPayload.challenge,
      sessionPayload.context,
      dto.label,
    );
  }

  @Delete('passkey/:handle')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Delete a current user passkey',
    description: 'Deletes one passkey owned by the authenticated user.',
  })
  @ApiParam({ name: 'handle', type: Number })
  @ApiResponse({ status: 200, description: 'Passkey deleted' })
  @UseGuards(SessionOrBearerAuthGuard)
  deletePasskey(
    @Req() req: Request & { user: PersonItem },
    @Param('handle') handle: string,
  ): Promise<{ deleted: boolean }> {
    const passkeyHandle = Number(handle);
    if (!Number.isFinite(passkeyHandle) || passkeyHandle <= 0) {
      throw new BadRequestException('global.invalidHandle');
    }

    return this.getPasskeyService().deletePasskey(req.user, passkeyHandle);
  }
}
