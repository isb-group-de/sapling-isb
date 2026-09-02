import {
  Controller,
  Delete,
  Get,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { SessionOrBearerAuthGuard } from '../../auth/guard/session-or-token-auth.guard';
import { PersonItem } from '../../entity/PersonItem';
import { SaplingMcpService } from './sapling-mcp.service';

@ApiTags('AI')
@ApiBearerAuth()
@Controller('api/ai/mcp')
@UseGuards(SessionOrBearerAuthGuard)
export class AiMcpController {
  constructor(private readonly saplingMcpService: SaplingMcpService) {}

  @Post()
  @ApiOperation({
    summary: 'Forward an MCP POST request',
    description:
      'Accepts a streamable HTTP POST request for the authenticated Sapling Model Context Protocol session and forwards it to the MCP runtime.',
  })
  async handlePost(
    @Req() req: Request & { user: PersonItem },
    @Res() res: Response,
  ): Promise<void> {
    await this.saplingMcpService.handlePost(req, res);
  }

  @Get()
  @ApiOperation({
    summary: 'Forward an MCP GET request',
    description:
      'Opens, resumes, or reads a streamable HTTP interaction for the authenticated Sapling Model Context Protocol session.',
  })
  async handleGet(
    @Req() req: Request & { user: PersonItem },
    @Res() res: Response,
  ): Promise<void> {
    await this.saplingMcpService.handleGet(req, res);
  }

  @Delete()
  @ApiOperation({
    summary: 'Forward an MCP DELETE request',
    description:
      'Terminates a streamable HTTP interaction for the authenticated Sapling Model Context Protocol session.',
  })
  async handleDelete(
    @Req() req: Request & { user: PersonItem },
    @Res() res: Response,
  ): Promise<void> {
    await this.saplingMcpService.handleDelete(req, res);
  }
}
