import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  SetMetadata,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { PersonItem } from '../../entity/PersonItem';
import { SessionOrBearerAuthGuard } from '../../auth/guard/session-or-token-auth.guard';
import { MailService } from './mail.service';
import {
  MailContextCcDto,
  MailContextCcResponseDto,
  MailPreviewDto,
  MailPreviewResponseDto,
  MailSenderListResponseDto,
  MailSendDto,
} from './dto/mail.dto';
import { EmailDeliveryItem } from '../../entity/EmailDeliveryItem';
import {
  GENERIC_PERMISSION_RESOLVE_KEY,
  GenericPermission,
} from '../generic/generic.decorator';
import { GenericPermissionGuard } from '../../auth/guard/generic-permission.guard';
import { ImpersonationReadOnly } from '../../auth/impersonation-read-only';

type MailPermissionBody = {
  entityHandle?: string | number;
};

const resolveMailEntityPermission = (
  req: Request<Record<string, string>, unknown, MailPermissionBody>,
) => {
  const body = req.body;

  return {
    entityHandle:
      body?.entityHandle !== undefined ? String(body.entityHandle) : undefined,
  };
};

@ApiTags('Mail')
@ApiBearerAuth()
@Controller('api/mail')
@UseGuards(SessionOrBearerAuthGuard)
export class MailController {
  constructor(private readonly mailService: MailService) {}

  @Get('senders')
  @ApiOperation({
    summary: 'List available sender addresses',
    description:
      'Returns the sender addresses that the authenticated user can choose from for the currently configured mail provider.',
  })
  @ApiResponse({
    status: 200,
    description: 'Available sender addresses grouped by the active provider.',
    type: MailSenderListResponseDto,
  })
  @ApiQuery({
    name: 'entityHandle',
    required: false,
    description:
      'Optional entity context used to preselect an assigned shared mailbox.',
  })
  async listSenders(
    @Req() req: Request & { user: PersonItem },
    @Query('entityHandle') entityHandle?: string,
  ): Promise<MailSenderListResponseDto> {
    return this.mailService.listSenderOptions(req.user, entityHandle);
  }

  @Post('preview')
  @ApiOperation({
    summary: 'Render an email preview',
    description:
      'Builds an email draft from entity context, template data, and optional manual overrides without dispatching it.',
  })
  @ApiBody({
    type: MailPreviewDto,
    description:
      'Message draft and rendering context used to resolve recipients, subject, body, and attachments.',
  })
  @ApiResponse({
    status: 201,
    description:
      'Resolved email preview with recipients, subject, and rendered body.',
    type: MailPreviewResponseDto,
  })
  @UseGuards(GenericPermissionGuard)
  @GenericPermission('allowRead')
  @SetMetadata(GENERIC_PERMISSION_RESOLVE_KEY, resolveMailEntityPermission)
  @ImpersonationReadOnly()
  async preview(
    @Req() req: Request & { user: PersonItem },
    @Body() previewDto: MailPreviewDto,
  ): Promise<MailPreviewResponseDto> {
    return this.mailService.previewEmail(previewDto, req.user);
  }

  @Post('context-cc')
  @ApiOperation({
    summary: 'Resolve configured customer CC recipients',
    description:
      'Returns customer-specific CC addresses that are not already present in To, CC, or BCC.',
  })
  @ApiBody({ type: MailContextCcDto })
  @ApiResponse({ status: 201, type: MailContextCcResponseDto })
  @UseGuards(GenericPermissionGuard)
  @GenericPermission('allowRead')
  @SetMetadata(GENERIC_PERMISSION_RESOLVE_KEY, resolveMailEntityPermission)
  @ImpersonationReadOnly()
  async resolveContextCc(
    @Body() contextDto: MailContextCcDto,
  ): Promise<MailContextCcResponseDto> {
    return this.mailService.resolveContextCc(contextDto);
  }

  @Post('send')
  @ApiOperation({
    summary: 'Queue or send an email',
    description:
      'Builds an email from entity context and dispatches it through the configured delivery pipeline.',
  })
  @ApiBody({
    type: MailSendDto,
    description:
      'Message payload that should be rendered and then queued or sent immediately.',
  })
  @ApiResponse({
    status: 201,
    description:
      'Persisted email delivery record for the queued or sent message.',
    type: EmailDeliveryItem,
  })
  @UseGuards(GenericPermissionGuard)
  @GenericPermission('allowUpdate')
  @SetMetadata(GENERIC_PERMISSION_RESOLVE_KEY, resolveMailEntityPermission)
  async send(
    @Req() req: Request & { user: PersonItem },
    @Body() sendDto: MailSendDto,
  ): Promise<EmailDeliveryItem> {
    return this.mailService.sendEmail(sendDto, req.user);
  }
}
