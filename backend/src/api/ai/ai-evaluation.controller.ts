import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsObject,
  IsOptional,
} from 'class-validator';
import type { Request } from 'express';
import { SessionOrBearerAuthGuard } from '../../auth/guard/session-or-token-auth.guard';
import { AdminPermissionGuard } from '../../auth/guard/admin-permission.guard';
import { AdminPermission } from '../../auth/admin-permission';
import { PersonItem } from '../../entity/PersonItem';
import { AiEvaluationService } from './ai-evaluation.service';
import type { AiPromptManifest } from './prompts/ai-prompt-context';
class EvaluationBatchDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @IsInt({ each: true })
  handles!: number[];
  @IsOptional() @IsObject() manifest?: AiPromptManifest;
}
@Controller('api/ai/agents')
@UseGuards(SessionOrBearerAuthGuard, AdminPermissionGuard)
@AdminPermission()
export class AiEvaluationController {
  constructor(private readonly evaluation: AiEvaluationService) {}
  @Get(':handle/prompt-preview')
  preview(
    @Param('handle') handle: string,
    @Query('playbook') playbook: string | undefined,
    @Req() req: Request & { user: PersonItem },
  ) {
    return this.evaluation.preview(handle, req.user, playbook);
  }
  @Post(':handle/evaluations/run')
  run(
    @Param('handle') handle: string,
    @Body() dto: EvaluationBatchDto,
    @Req() req: Request & { user: PersonItem },
  ) {
    return this.evaluation.run(handle, dto.handles, req.user, dto.manifest);
  }
}
