import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { AiService } from './ai.service';
import { SessionOrBearerAuthGuard } from '../../auth/guard/session-or-token-auth.guard';
import { AdminPermissionGuard } from '../../auth/guard/admin-permission.guard';
import { AdminPermission } from '../../auth/admin-permission';
import { PersonItem } from '../../entity/PersonItem';
import { AiAgentEvaluationItem } from '../../entity/AiAgentEvaluationItem';
import { AiAgentRunItem } from '../../entity/AiAgentRunItem';
import {
  CreateAiAgentEvaluationDto,
  CreateAiAgentTestRunDto,
} from './dto/chat.dto';

@ApiTags('AI')
@ApiBearerAuth()
@Controller('api/ai')
@UseGuards(SessionOrBearerAuthGuard)
export class AiAgentController {
  constructor(private readonly aiService: AiService) {}

  @Get('agents/:handle/workbench')
  @UseGuards(AdminPermissionGuard)
  @AdminPermission()
  @ApiOperation({
    summary: 'Load AI agent workbench data',
    description:
      'Returns the selected agent with versions, playbooks, memory, runs, evaluations, and summary stats for administration.',
  })
  async getAgentWorkbench(
    @Req() req: Request & { user: PersonItem },
    @Param('handle') handle: string,
  ): Promise<Record<string, unknown>> {
    return this.aiService.getAgentWorkbench(handle, req.user);
  }

  @Post('agents/:handle/test-runs')
  @UseGuards(AdminPermissionGuard)
  @AdminPermission()
  @ApiOperation({
    summary: 'Run an AI agent test prompt',
    description:
      'Creates a managed test chat run for an agent and returns the captured run metadata.',
  })
  @ApiBody({ type: CreateAiAgentTestRunDto })
  async createAgentTestRun(
    @Req() req: Request & { user: PersonItem },
    @Param('handle') handle: string,
    @Body() body: CreateAiAgentTestRunDto,
  ): Promise<AiAgentRunItem> {
    return this.aiService.createAgentTestRun(handle, body, req.user);
  }

  @Get('agents/:handle/runs')
  @UseGuards(AdminPermissionGuard)
  @AdminPermission()
  @ApiOperation({
    summary: 'List AI agent runs',
    description: 'Returns recent execution runs for one AI agent.',
  })
  async listAgentRuns(
    @Req() req: Request & { user: PersonItem },
    @Param('handle') handle: string,
  ): Promise<AiAgentRunItem[]> {
    return this.aiService.listAgentRuns(handle, req.user);
  }

  @Get('agents/:handle/evaluations')
  @UseGuards(AdminPermissionGuard)
  @AdminPermission()
  @ApiOperation({
    summary: 'List AI agent evaluations',
    description:
      'Returns manual quality evaluation test cases for one AI agent.',
  })
  async listAgentEvaluations(
    @Req() req: Request & { user: PersonItem },
    @Param('handle') handle: string,
  ): Promise<AiAgentEvaluationItem[]> {
    return this.aiService.listAgentEvaluations(handle, req.user);
  }

  @Post('agents/:handle/evaluations')
  @UseGuards(AdminPermissionGuard)
  @AdminPermission()
  @ApiOperation({
    summary: 'Create an AI agent evaluation',
    description: 'Creates a manual evaluation test case for one AI agent.',
  })
  @ApiBody({ type: CreateAiAgentEvaluationDto })
  async createAgentEvaluation(
    @Req() req: Request & { user: PersonItem },
    @Param('handle') handle: string,
    @Body() body: CreateAiAgentEvaluationDto,
  ): Promise<AiAgentEvaluationItem> {
    return this.aiService.createAgentEvaluation(handle, body, req.user);
  }
}
