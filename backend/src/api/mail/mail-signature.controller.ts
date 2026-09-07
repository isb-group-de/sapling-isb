import { Body, Controller, Get, Patch, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { SessionOrBearerAuthGuard } from '../../auth/guard/session-or-token-auth.guard';
import { ImpersonationReadOnly } from '../../auth/impersonation-read-only';
import { PersonItem } from '../../entity/PersonItem';
import { MailSignatureService } from './mail-signature.service';
import { MailSignatureSettingsDto } from './dto/mail-signature.dto';

@ApiTags('Mail')
@ApiBearerAuth()
@Controller('api/mail/signature-settings')
@UseGuards(SessionOrBearerAuthGuard)
export class MailSignatureController {
  constructor(private readonly signatures: MailSignatureService) {}

  @Get()
  settings(@Req() req: Request & { user: PersonItem }) {
    return this.signatures.settings(req.user);
  }

  @Patch()
  @ImpersonationReadOnly()
  save(
    @Req() req: Request & { user: PersonItem },
    @Body() dto: MailSignatureSettingsDto,
  ) {
    return this.signatures.saveSettings(req.user, dto);
  }
}
