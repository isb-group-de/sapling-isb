import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { AdminPermission } from '../../auth/admin-permission';
import { AdminPermissionGuard } from '../../auth/guard/admin-permission.guard';
import { SessionOrBearerAuthGuard } from '../../auth/guard/session-or-token-auth.guard';
import { PersonItem } from '../../entity/PersonItem';
import { FieldPermissionService } from './field-permission.service';

@ApiTags('Permission administration')
@ApiBearerAuth()
@Controller('api/permission-admin')
@UseGuards(SessionOrBearerAuthGuard, AdminPermissionGuard)
@AdminPermission()
export class PermissionAdminController {
  constructor(private readonly fieldPermissions: FieldPermissionService) {}

  @Get('roles/:roleHandle/entities/:entityHandle/fields')
  @ApiOperation({
    summary: 'Get the field permission catalog for a role and entity',
  })
  getCatalog(
    @Param('roleHandle', ParseIntPipe) roleHandle: number,
    @Param('entityHandle') entityHandle: string,
  ) {
    return this.fieldPermissions.getAdminCatalog(roleHandle, entityHandle);
  }

  @Put('roles/:roleHandle/entities/:entityHandle/fields')
  @ApiOperation({ summary: 'Replace field permission overrides atomically' })
  saveOverrides(
    @Req() req: Request & { user: PersonItem },
    @Param('roleHandle', ParseIntPipe) roleHandle: number,
    @Param('entityHandle') entityHandle: string,
    @Body()
    body: {
      fields?: Array<{
        fieldName: string;
        allowRead: boolean;
        allowInsert: boolean;
        allowUpdate: boolean;
      }>;
    },
  ) {
    return this.fieldPermissions.saveAdminOverrides(
      req.user,
      roleHandle,
      entityHandle,
      body.fields ?? [],
    );
  }
}
