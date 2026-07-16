import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { AuthProviderUserImportService } from './auth-provider-user-import.service';
import { SessionOrBearerAuthGuard } from './guard/session-or-token-auth.guard';
import { AdminPermissionGuard } from './guard/admin-permission.guard';
import { GenericPermissionGuard } from './guard/generic-permission.guard';
import {
  GenericPermission,
  GenericPermissionEntity,
} from '../api/generic/generic.decorator';
import { PersonItem } from '../entity/PersonItem';
import type {
  ImpersonatorInfo,
  SessionUserPayload,
} from '../session/session.serializer';
import { CreateApiTokenDto } from './dto/create-api-token.dto';
import { RotateApiTokenDto } from './dto/rotate-api-token.dto';
import {
  ApiTokenResponseDto,
  ApiTokenSecretResponseDto,
} from './dto/api-token-response.dto';
import {
  ImportProviderUsersDto,
  ListProviderUsersQueryDto,
  ProviderUserImportResponseDto,
  ProviderUserListResponseDto,
} from './dto/provider-user.dto';

@ApiTags('Auth')
@Controller('api/auth')
export class AuthAdministrationController {
  constructor(
    private readonly authService: AuthService,
    private readonly providerUserImportService: AuthProviderUserImportService,
  ) {}

  @Get('provider-users')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'List external provider users',
    description:
      'Administrators can list Azure or Google directory users using their own provider session.',
  })
  @ApiQuery({ name: 'provider', enum: ['azure', 'google'] })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'pageToken', required: false, type: String })
  @ApiResponse({
    status: 200,
    description: 'Provider directory users',
    type: ProviderUserListResponseDto,
  })
  @UseGuards(SessionOrBearerAuthGuard, AdminPermissionGuard)
  listProviderUsers(
    @Req() req: Request & { user: PersonItem },
    @Query() query: ListProviderUsersQueryDto,
  ): Promise<ProviderUserListResponseDto> {
    if (query.provider !== 'azure' && query.provider !== 'google') {
      throw new BadRequestException('providerUserImport.invalidProvider');
    }

    return this.providerUserImportService.listProviderUsers(
      req.user,
      query.provider,
      {
        search: query.search,
        pageToken: query.pageToken,
      },
    );
  }

  @Post('provider-users/import')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Import external provider users',
    description:
      'Administrators can create or update Sapling persons from Azure or Google directory users and assign roles.',
  })
  @ApiBody({ type: ImportProviderUsersDto })
  @ApiResponse({
    status: 201,
    description: 'Provider user import result',
    type: ProviderUserImportResponseDto,
  })
  @UseGuards(SessionOrBearerAuthGuard, AdminPermissionGuard)
  importProviderUsers(
    @Req() req: Request & { user: PersonItem },
    @Body() dto: ImportProviderUsersDto,
  ): Promise<ProviderUserImportResponseDto> {
    if (dto.provider !== 'azure' && dto.provider !== 'google') {
      throw new BadRequestException('providerUserImport.invalidProvider');
    }
    if (!Array.isArray(dto.userIds) || dto.userIds.length === 0) {
      throw new BadRequestException('providerUserImport.usersRequired');
    }
    if (!Array.isArray(dto.roleHandles) || dto.roleHandles.length === 0) {
      throw new BadRequestException('providerUserImport.rolesRequired');
    }

    return this.providerUserImportService.importProviderUsers(req.user, dto);
  }

  /**
   * Ends an impersonation session and returns to the real account.
   * Allowed for the impersonating administrator only.
   *
   * NOTE: This handler MUST be declared before `startImpersonation`,
   * because NestJS registers routes in declaration order. The dynamic
   * route `impersonate/:handle` would otherwise swallow `/impersonate/stop`
   * and trigger the admin guard (which fails while impersonating).
   *
   * @route POST /api/auth/impersonate/stop
   * @access Authenticated
   */
  @Post('impersonate/stop')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Stop impersonation',
    description:
      'Ends the current impersonation session and returns to the real account.',
  })
  @ApiResponse({ status: 200, description: 'Impersonation stopped' })
  async stopImpersonation(@Req() req: Request): Promise<{ stopped: boolean }> {
    if (!req.session) {
      return { stopped: false };
    }

    const sessionPassport = (
      req.session as unknown as {
        passport?: { user?: SessionUserPayload };
      }
    ).passport;

    if (!sessionPassport?.user?.impersonatedHandle) {
      return { stopped: false };
    }

    const previousTarget = sessionPassport.user.impersonatedHandle;
    const realHandle = sessionPassport.user.handle;

    sessionPassport.user = { handle: realHandle };

    await new Promise<void>((resolve, reject) =>
      req.session.save((error) =>
        error
          ? reject(error instanceof Error ? error : new Error(String(error)))
          : resolve(),
      ),
    );

    global.log?.info?.(
      `[impersonation] stop: admin handle=${realHandle} (was viewing target handle=${previousTarget})`,
    );

    return { stopped: true };
  }

  /**
   * Starts an "view as user" impersonation session. Administrators only.
   * Mutates the existing session payload so the next request deserializes
   * the target user. The original admin remains the session owner.
   *
   * @route POST /api/auth/impersonate/:handle
   * @access Administrator (session-based)
   */
  @Post('impersonate/:handle')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Impersonate another user',
    description:
      'Administrators only. Switches the current session to view the application as the specified user. The session remains owned by the administrator.',
  })
  @ApiParam({ name: 'handle', type: Number })
  @ApiResponse({ status: 200, description: 'Impersonation started' })
  @ApiResponse({ status: 400, description: 'Invalid impersonation target' })
  @ApiResponse({ status: 403, description: 'Not allowed' })
  @ApiResponse({ status: 404, description: 'Target user not found' })
  @UseGuards(AdminPermissionGuard)
  async startImpersonation(
    @Req() req: Request,
    @Param('handle') handle: string,
  ): Promise<{ impersonator: ImpersonatorInfo; targetHandle: number }> {
    const realUser = req.user as PersonItem | undefined;
    if (
      !realUser ||
      typeof realUser.handle !== 'number' ||
      !req.session ||
      !req.isAuthenticated()
    ) {
      throw new ForbiddenException('global.permissionDenied');
    }

    // Prevent nested impersonation – must stop first.
    if (
      (realUser as PersonItem & { _impersonator?: ImpersonatorInfo })
        ._impersonator
    ) {
      throw new ForbiddenException('permission.impersonationAlreadyActive');
    }

    const targetHandle = Number(handle);
    if (!Number.isFinite(targetHandle) || targetHandle <= 0) {
      throw new BadRequestException('global.invalidHandle');
    }

    if (targetHandle === realUser.handle) {
      throw new BadRequestException('permission.cannotImpersonateSelf');
    }

    const target = await this.authService.getSecurityUserByHandle(targetHandle);
    if (!target) {
      throw new NotFoundException('global.notFound');
    }
    if (target.isActive === false) {
      throw new BadRequestException('permission.targetInactive');
    }

    const sessionPassport = (
      req.session as unknown as {
        passport?: { user?: SessionUserPayload };
      }
    ).passport;

    if (!sessionPassport || !sessionPassport.user) {
      throw new ForbiddenException('global.permissionDenied');
    }

    sessionPassport.user = {
      handle: realUser.handle,
      impersonatedHandle: targetHandle,
    };

    await new Promise<void>((resolve, reject) =>
      req.session.save((error) =>
        error
          ? reject(error instanceof Error ? error : new Error(String(error)))
          : resolve(),
      ),
    );

    global.log?.info?.(
      `[impersonation] start: admin handle=${realUser.handle} (${realUser.firstName} ${realUser.lastName}) → target handle=${targetHandle} (${target.firstName} ${target.lastName})`,
    );

    return {
      impersonator: {
        handle: realUser.handle,
        firstName: realUser.firstName,
        lastName: realUser.lastName,
      },
      targetHandle,
    };
  }

  @Get('token')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'List API tokens',
    description:
      'Returns API token metadata for the current user or another person when globally permitted.',
  })
  @ApiQuery({ name: 'personHandle', required: false, type: Number })
  @ApiResponse({
    status: 200,
    description: 'List of API token metadata',
    type: ApiTokenResponseDto,
    isArray: true,
  })
  @UseGuards(SessionOrBearerAuthGuard, GenericPermissionGuard)
  @GenericPermission('allowRead')
  @GenericPermissionEntity('personApiToken')
  listTokens(
    @Req() req: Request & { user: PersonItem },
    @Query('personHandle') personHandle?: number,
  ): Promise<ApiTokenResponseDto[]> {
    return this.authService.getApiTokens(req.user, personHandle);
  }

  @Post('token')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Create API token',
    description:
      'Creates a new bearer token for the current user or another person when globally permitted.',
  })
  @ApiBody({ type: CreateApiTokenDto })
  @ApiResponse({
    status: 201,
    description: 'Created token and one-time secret',
    type: ApiTokenSecretResponseDto,
  })
  @UseGuards(SessionOrBearerAuthGuard, GenericPermissionGuard)
  @GenericPermission('allowInsert')
  @GenericPermissionEntity('personApiToken')
  createToken(
    @Req() req: Request & { user: PersonItem },
    @Body() dto: CreateApiTokenDto,
  ): Promise<ApiTokenSecretResponseDto> {
    return this.authService.createApiToken(req.user, dto);
  }

  @Post('token/:handle/rotate')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Rotate API token',
    description:
      'Deactivates the current token and returns a replacement secret.',
  })
  @ApiParam({ name: 'handle', type: Number })
  @ApiBody({ type: RotateApiTokenDto })
  @ApiResponse({
    status: 200,
    description: 'Rotated token and one-time secret',
    type: ApiTokenSecretResponseDto,
  })
  @UseGuards(SessionOrBearerAuthGuard, GenericPermissionGuard)
  @GenericPermission('allowUpdate')
  @GenericPermissionEntity('personApiToken')
  rotateToken(
    @Req() req: Request & { user: PersonItem },
    @Param('handle') handle: number,
    @Body() dto: RotateApiTokenDto,
  ): Promise<ApiTokenSecretResponseDto> {
    return this.authService.rotateApiToken(req.user, handle, dto);
  }

  @Delete('token/:handle')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Deactivate API token',
    description: 'Deactivates a bearer token.',
  })
  @ApiParam({ name: 'handle', type: Number })
  @ApiResponse({
    status: 200,
    description: 'Updated token metadata',
    type: ApiTokenResponseDto,
  })
  @UseGuards(SessionOrBearerAuthGuard, GenericPermissionGuard)
  @GenericPermission('allowDelete')
  @GenericPermissionEntity('personApiToken')
  deactivateToken(
    @Req() req: Request & { user: PersonItem },
    @Param('handle') handle: number,
  ): Promise<ApiTokenResponseDto> {
    return this.authService.deactivateApiToken(req.user, handle);
  }
}
