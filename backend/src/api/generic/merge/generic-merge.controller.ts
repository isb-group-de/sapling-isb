import {
  Body,
  Controller,
  HttpCode,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { GenericPermissionGuard } from '../../../auth/guard/generic-permission.guard';
import { SessionOrBearerAuthGuard } from '../../../auth/guard/session-or-token-auth.guard';
import { PersonItem } from '../../../entity/PersonItem';
import { extractClientFormattingContextFromRequest } from '../../common/client-formatting-context.util';
import { GenericPermission } from '../generic.decorator';
import { GenericMergeDto, GenericMergePairDto } from './generic-merge.dto';
import { GenericMergeService } from './generic-merge.service';

@ApiTags('Generic')
@ApiBearerAuth()
@Controller('api/generic/:entityHandle/merge')
@UseGuards(SessionOrBearerAuthGuard, GenericPermissionGuard)
@GenericPermission('allowUpdate')
export class GenericMergeController {
  constructor(private readonly mergeService: GenericMergeService) {}

  @Post('preview')
  @HttpCode(200)
  @ApiOperation({ summary: 'Compare two records before merging them' })
  preview(
    @Param('entityHandle') entity: string,
    @Body() request: GenericMergePairDto,
    @Req() req: Request & { user: PersonItem },
  ) {
    return this.mergeService.preview(entity, request, req.user);
  }

  @Post()
  @HttpCode(200)
  @ApiOperation({
    summary:
      'Atomically merge records, transfer references and delete the loser',
  })
  merge(
    @Param('entityHandle') entity: string,
    @Body() request: GenericMergeDto,
    @Req() req: Request & { user: PersonItem },
  ) {
    return this.mergeService.merge(
      entity,
      request,
      req.user,
      extractClientFormattingContextFromRequest(req),
    );
  }
}
