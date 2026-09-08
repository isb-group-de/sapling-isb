import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import {
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import type { Request } from 'express';
import { SessionOrBearerAuthGuard } from '../../../auth/guard/session-or-token-auth.guard';
import { AdminPermissionGuard } from '../../../auth/guard/admin-permission.guard';
import { AdminPermission } from '../../../auth/admin-permission';
import { PersonItem } from '../../../entity/PersonItem';
import { AiPromptTemplateItem } from '../../../entity/AiPromptTemplateItem';
import { AiPromptVersionItem } from '../../../entity/AiPromptVersionItem';
import { AiPromptService } from './ai-prompt.service';
import { AI_PROMPT_USAGE } from './ai-prompt-usage';

class PublishPromptDto {
  @IsOptional() @IsString() @MaxLength(2000) changeNote?: string;
  @IsOptional() @IsInt() @Min(1) restoreVersion?: number;
}
class PreviewPromptDto {
  @IsObject() values!: Record<string, unknown>;
  @IsOptional() @IsInt() @Min(1) versionHandle?: number;
}

@Controller('api/ai/prompts')
@UseGuards(SessionOrBearerAuthGuard, AdminPermissionGuard)
@AdminPermission()
export class AiPromptController {
  constructor(
    private readonly prompts: AiPromptService,
    private readonly em: EntityManager,
  ) {}

  @Get()
  list() {
    return this.em.find(
      AiPromptTemplateItem,
      {},
      {
        populate: ['publishedVersion'],
        orderBy: { purpose: 'ASC', handle: 'ASC' },
      },
    );
  }

  @Get(':key/versions')
  versions(@Param('key') key: string) {
    return this.em.find(
      AiPromptVersionItem,
      { template: { handle: key } },
      { orderBy: { version: 'DESC' }, limit: 100 },
    );
  }

  @Get(':key/usage')
  usage(@Param('key') key: string) {
    return AI_PROMPT_USAGE.filter((entry) =>
      (entry.keys as readonly string[]).includes(key),
    ).map((entry) => entry.source);
  }

  @Post(':key/preview')
  preview(@Param('key') key: string, @Body() body: PreviewPromptDto) {
    return this.prompts.preview(key, body.values, body.versionHandle);
  }

  @Post(':key/publish')
  publish(
    @Param('key') key: string,
    @Body() body: PublishPromptDto,
    @Req() req: Request & { user: PersonItem },
  ) {
    return this.prompts.publish(
      key,
      req.user,
      body.changeNote,
      body.restoreVersion,
    );
  }
}
