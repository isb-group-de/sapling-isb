import { Body, Controller, Param, Post, Req, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { AdminPermission } from '../../auth/admin-permission';
import { AdminPermissionGuard } from '../../auth/guard/admin-permission.guard';
import { SessionOrBearerAuthGuard } from '../../auth/guard/session-or-token-auth.guard';
import { PersonItem } from '../../entity/PersonItem';
import { extractClientFormattingContextFromRequest } from '../common/client-formatting-context.util';
import { ApiGenericEntityOperation } from './generic.decorator';
import { GenericService } from './generic.service';

@ApiTags('Generic')
@ApiBearerAuth()
@Controller('api/generic')
@UseGuards(SessionOrBearerAuthGuard)
export class GenericImportController {
  constructor(private readonly genericService: GenericService) {}

  @AdminPermission()
  @UseGuards(AdminPermissionGuard)
  @Post(':entityHandle/import')
  @ApiOperation({
    summary: 'Import entity data from parsed CSV rows',
    description:
      'Imports parsed tabular rows for the requested entity. Rows without handle create records; rows with handle update existing records. Entity permissions, scripts and change logging are applied per row.',
  })
  @ApiGenericEntityOperation('Imports parsed tabular rows for an entity')
  @ApiResponse({
    status: 200,
    description:
      'Import summary with one result entry per submitted row. Failed rows do not stop the whole import.',
    type: Object,
  })
  @ApiBody({
    description:
      'Payload containing rows parsed from a CSV/Excel-compatible table. Keys must match entity property names.',
    required: true,
    schema: {
      type: 'object',
      properties: {
        rows: {
          type: 'array',
          items: { type: 'object', additionalProperties: true },
        },
      },
      required: ['rows'],
    },
  })
  async importRows(
    @Req() req: Request & { user: PersonItem },
    @Param('entityHandle') entityHandle: string,
    @Body() body: { rows?: Record<string, unknown>[] },
  ): Promise<object> {
    return this.genericService.importRows(
      entityHandle,
      body.rows ?? [],
      req.user,
      extractClientFormattingContextFromRequest(req),
    );
  }
}
