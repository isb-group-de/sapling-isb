import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { SessionOrBearerAuthGuard } from '../../auth/guard/session-or-token-auth.guard';
import { AdminPermissionGuard } from '../../auth/guard/admin-permission.guard';
import { AdminPermission } from '../../auth/admin-permission';
import { AutomationInspectionService } from './automation-inspection.service';

class GraphQuery {
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(8) depth = 1;
  @IsOptional() @IsIn(['true', 'false']) includeInactive = 'false';
}
class HistoryQuery {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100000) page = 1;
}

@Controller('api/automation')
@UseGuards(SessionOrBearerAuthGuard, AdminPermissionGuard)
@AdminPermission()
export class AutomationInspectionController {
  constructor(private readonly inspection: AutomationInspectionService) {}
  @Get('graph/:entityHandle')
  graph(@Param('entityHandle') entity: string, @Query() query: GraphQuery) {
    return this.inspection.graph(
      entity,
      query.depth,
      query.includeInactive === 'true',
    );
  }
  @Get('history/:entityHandle/:recordHandle')
  history(
    @Param('entityHandle') entity: string,
    @Param('recordHandle') handle: string,
    @Query() query: HistoryQuery,
  ) {
    return this.inspection.history(entity, handle, query.page);
  }
}
