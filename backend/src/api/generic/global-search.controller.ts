import { Controller, Get, Header, Query, Req, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { SessionOrBearerAuthGuard } from '../../auth/guard/session-or-token-auth.guard';
import { PersonItem } from '../../entity/PersonItem';
import {
  GlobalSearchQueryDto,
  GlobalSearchResponseDto,
} from './dto/global-search.dto';
import { GlobalSearchService } from './global-search.service';

@ApiTags('Search')
@ApiBearerAuth()
@Controller('api/command-palette')
@UseGuards(SessionOrBearerAuthGuard)
export class GlobalSearchController {
  constructor(private readonly globalSearchService: GlobalSearchService) {}

  @Get('records')
  @ApiOperation({
    summary: 'Search readable records across navigable entities',
    description:
      'Runs a metadata-driven text search across entities the current user may read and open from the app shell.',
  })
  @ApiQuery({
    name: 'query',
    required: true,
    description: 'Free-text query.',
    type: String,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Maximum result count across all entities.',
    type: Number,
  })
  @ApiQuery({
    name: 'entityHandles',
    required: false,
    description: 'Optional comma-separated list of entity handles.',
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: 'Permission-filtered global search results.',
    type: GlobalSearchResponseDto,
  })
  @Header('Cache-Control', 'no-store')
  @Header('Pragma', 'no-cache')
  searchGlobal(
    @Req() req: Request & { user: PersonItem },
    @Query() query: GlobalSearchQueryDto,
  ): Promise<GlobalSearchResponseDto> {
    return this.globalSearchService.search(req.user, query);
  }
}
