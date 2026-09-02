import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AdminPermission } from '../../auth/admin-permission';
import { AdminPermissionGuard } from '../../auth/guard/admin-permission.guard';
import { SessionOrBearerAuthGuard } from '../../auth/guard/session-or-token-auth.guard';
import { AiProviderModelItem } from '../../entity/AiProviderModelItem';
import { AiProviderTypeItem } from '../../entity/AiProviderTypeItem';
import { AiService } from './ai.service';
import {
  VectorizeEntityDto,
  VectorizeEntityResponseDto,
} from './dto/vectorization.dto';

@ApiTags('AI')
@ApiBearerAuth()
@Controller('api/ai/vectorization')
@UseGuards(SessionOrBearerAuthGuard, AdminPermissionGuard)
@AdminPermission()
export class AiVectorizationController {
  constructor(private readonly aiService: AiService) {}

  @Get('providers')
  @ApiOperation({ summary: 'List available embedding providers' })
  @ApiResponse({
    status: 200,
    description: 'Active embedding providers available to administrators.',
    type: AiProviderTypeItem,
    isArray: true,
  })
  listProviders(): Promise<AiProviderTypeItem[]> {
    return this.aiService.listActiveProviders('embedding');
  }

  @Get('models')
  @ApiOperation({ summary: 'List available embedding models' })
  @ApiQuery({ name: 'providerHandle', required: false, type: String })
  @ApiResponse({
    status: 200,
    description: 'Active embedding models available to administrators.',
    type: AiProviderModelItem,
    isArray: true,
  })
  listModels(
    @Query('providerHandle') providerHandle?: string,
  ): Promise<AiProviderModelItem[]> {
    return this.aiService.listActiveModels(providerHandle, 'embedding');
  }

  @Post()
  @ApiOperation({ summary: 'Generate embeddings for one entity type' })
  @ApiBody({ type: VectorizeEntityDto })
  @ApiResponse({
    status: 201,
    description: 'Summary of the vectorization run.',
    type: VectorizeEntityResponseDto,
  })
  vectorize(
    @Body() body: VectorizeEntityDto,
  ): Promise<VectorizeEntityResponseDto> {
    return this.aiService.vectorizeEntity(body);
  }
}
