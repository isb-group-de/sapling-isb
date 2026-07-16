import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import { AiService } from './ai.service';
import { SessionOrBearerAuthGuard } from '../../auth/guard/session-or-token-auth.guard';
import { AdminPermissionGuard } from '../../auth/guard/admin-permission.guard';
import { AdminPermission } from '../../auth/admin-permission';
import { PersonItem } from '../../entity/PersonItem';
import { AiChatMessageItem } from '../../entity/AiChatMessageItem';
import { AiProviderTypeItem } from '../../entity/AiProviderTypeItem';
import { AiProviderModelItem } from '../../entity/AiProviderModelItem';
import { CreateAiChatMessageSpeechDto } from './dto/chat.dto';
import {
  AiChatTranscriptionResponseDto,
  CreateAiChatTranscriptionDto,
} from './dto/transcription.dto';

@ApiTags('AI')
@ApiBearerAuth()
@Controller('api/ai')
@UseGuards(SessionOrBearerAuthGuard)
export class AiMediaController {
  constructor(private readonly aiService: AiService) {}

  @Get('transcription/providers')
  @ApiOperation({
    summary: 'List available transcription providers',
    description:
      'Returns the active AI providers that can currently be used for audio transcription.',
  })
  @ApiResponse({
    status: 200,
    description:
      'Active transcription providers available to the current user.',
    type: AiProviderTypeItem,
    isArray: true,
  })
  async listTranscriptionProviders(): Promise<AiProviderTypeItem[]> {
    return this.aiService.listActiveProviders('transcription', true);
  }

  @Get('transcription/models')
  @ApiOperation({
    summary: 'List available transcription models',
    description:
      'Returns the active transcription models. When providerHandle is supplied, only models from that provider are returned.',
  })
  @ApiQuery({
    name: 'providerHandle',
    required: false,
    type: String,
    description:
      'Optional provider handle used to limit the result to one transcription provider.',
  })
  @ApiResponse({
    status: 200,
    description: 'Active transcription models available to the current user.',
    type: AiProviderModelItem,
    isArray: true,
  })
  async listTranscriptionModels(
    @Query('providerHandle') providerHandle?: string,
  ): Promise<AiProviderModelItem[]> {
    return this.aiService.listActiveModels(
      providerHandle,
      'transcription',
      true,
    );
  }

  @Get('speech/providers')
  @ApiOperation({
    summary: 'List available speech providers',
    description:
      'Returns the active AI providers that can currently be used for speech synthesis.',
  })
  @ApiResponse({
    status: 200,
    description: 'Active speech providers available to the current user.',
    type: AiProviderTypeItem,
    isArray: true,
  })
  async listSpeechProviders(): Promise<AiProviderTypeItem[]> {
    return this.aiService.listActiveProviders('speech', true);
  }

  @Get('speech/models')
  @ApiOperation({
    summary: 'List available speech models',
    description:
      'Returns the active speech synthesis models. When providerHandle is supplied, only models from that provider are returned.',
  })
  @ApiQuery({
    name: 'providerHandle',
    required: false,
    type: String,
    description:
      'Optional provider handle used to limit the result to one speech provider.',
  })
  @ApiResponse({
    status: 200,
    description: 'Active speech models available to the current user.',
    type: AiProviderModelItem,
    isArray: true,
  })
  async listSpeechModels(
    @Query('providerHandle') providerHandle?: string,
  ): Promise<AiProviderModelItem[]> {
    return this.aiService.listActiveModels(providerHandle, 'speech', true);
  }

  @Post('chat/transcriptions')
  @ApiOperation({
    summary: 'Create a transcription draft from uploaded audio',
    description:
      'Uploads an audio file, runs transcription, and stores the resulting draft so it can be reused in chat workflows.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description:
      'Multipart form-data payload containing the audio file and optional client context.',
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Audio file that should be transcribed.',
        },
        sessionHandle: {
          type: 'number',
          description:
            'Optional existing chat session handle used to link the transcription to a conversation.',
          nullable: true,
        },
        providerHandle: {
          type: 'string',
          description:
            'Optional AI provider handle that should perform the transcription.',
          nullable: true,
        },
        modelHandle: {
          type: 'string',
          description:
            'Optional transcription model handle that should be used for the request.',
          nullable: true,
        },
        language: {
          type: 'string',
          description:
            'Optional language hint for the input audio, for example en or de.',
          nullable: true,
        },
        routeName: {
          type: 'string',
          description: 'Optional frontend route name active at upload time.',
          nullable: true,
        },
        url: {
          type: 'string',
          description: 'Optional full frontend URL active at upload time.',
          nullable: true,
        },
        pageTitle: {
          type: 'string',
          description: 'Optional frontend page title active at upload time.',
          nullable: true,
        },
        clientCurrentDateTime: {
          type: 'string',
          description:
            'Optional client-side timestamp captured when the upload was started.',
          nullable: true,
        },
        clientTimeZone: {
          type: 'string',
          description:
            'Optional IANA timezone reported by the client, such as Europe/Berlin.',
          nullable: true,
        },
        clientLocale: {
          type: 'string',
          description: 'Optional client locale, such as en-US or de-DE.',
          nullable: true,
        },
        clientUtcOffsetMinutes: {
          type: 'number',
          description:
            'Optional offset from UTC in minutes reported by the client.',
          nullable: true,
        },
        durationSeconds: {
          type: 'number',
          description:
            'Optional audio duration reported by the client recorder in seconds.',
          nullable: true,
        },
      },
      required: ['file'],
    },
  })
  @ApiResponse({
    status: 201,
    description:
      'Persisted transcription draft with status, detected metadata, and linked document information.',
    type: AiChatTranscriptionResponseDto,
  })
  @UseInterceptors(FileInterceptor('file'))
  async createTranscription(
    @Req() req: Request & { user: PersonItem },
    @UploadedFile() file: Express.Multer.File,
    @Body() body: CreateAiChatTranscriptionDto,
  ): Promise<AiChatTranscriptionResponseDto> {
    return this.aiService.createChatTranscription(body, file, req.user);
  }

  @Post('chat/attachments')
  @UseGuards(AdminPermissionGuard)
  @AdminPermission()
  @ApiOperation({
    summary: 'Upload an import candidate file for AI chat',
    description:
      'Uploads a CSV, TSV, or TXT file, analyzes it through the import batch pipeline, and returns a chat attachment handle.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        sessionHandle: {
          type: 'number',
          nullable: true,
          description: 'Optional chat session to attach the file to.',
        },
        purpose: {
          type: 'string',
          nullable: true,
          description: 'Attachment purpose, defaults to importAnalysis.',
        },
      },
      required: ['file'],
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  async createChatAttachment(
    @Req() req: Request & { user: PersonItem },
    @UploadedFile() file: Express.Multer.File,
    @Body()
    body: {
      sessionHandle?: number | string | null;
      purpose?: string | null;
    },
  ): Promise<Record<string, unknown>> {
    const sessionHandle =
      body.sessionHandle != null && String(body.sessionHandle).trim()
        ? Number(body.sessionHandle)
        : null;

    return this.aiService.createChatAttachment(file, req.user, {
      sessionHandle:
        sessionHandle != null && Number.isFinite(sessionHandle)
          ? sessionHandle
          : null,
      purpose: body.purpose ?? null,
    });
  }

  @Post('chat/messages/:handle/speech')
  @ApiOperation({
    summary: 'Create or reuse speech audio for an assistant message',
    description:
      'Generates or reuses a speech synthesis asset for an assistant message and stores the resulting audio reference on the message.',
  })
  @ApiBody({ type: CreateAiChatMessageSpeechDto })
  @ApiParam({
    name: 'handle',
    type: 'number',
    description: 'Numeric handle of the assistant message to synthesize.',
  })
  @ApiResponse({
    status: 201,
    description:
      'Updated assistant message record with the persisted speech artifact reference.',
    type: AiChatMessageItem,
  })
  async ensureAssistantMessageSpeech(
    @Req() req: Request & { user: PersonItem },
    @Param('handle') handle: number,
    @Body() body: CreateAiChatMessageSpeechDto,
  ): Promise<AiChatMessageItem> {
    return this.aiService.ensureAssistantMessageSpeech(handle, req.user, body);
  }
}
