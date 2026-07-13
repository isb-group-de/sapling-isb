import {
  Controller,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminPermission } from '../../auth/admin-permission';
import { AdminPermissionGuard } from '../../auth/guard/admin-permission.guard';
import { SessionOrBearerAuthGuard } from '../../auth/guard/session-or-token-auth.guard';
import { EmailInboxSyncService } from './email-inbox-sync.service';

@ApiTags('Inbound email')
@ApiBearerAuth()
@Controller('api/email-inbox')
@UseGuards(SessionOrBearerAuthGuard, AdminPermissionGuard)
@AdminPermission()
export class EmailInboxSyncController {
  constructor(private readonly service: EmailInboxSyncService) {}

  @Post('subscriptions/:handle/synchronize')
  @ApiOperation({ summary: 'Synchronize an inbound mailbox immediately' })
  async synchronize(
    @Param('handle', ParseIntPipe) handle: number,
  ): Promise<{ queued: true }> {
    await this.service.enqueueSubscriptionNow(handle);
    return { queued: true };
  }

  @Post('messages/:handle/reprocess')
  @ApiOperation({ summary: 'Retry AI processing for an inbound email' })
  async reprocess(
    @Param('handle', ParseIntPipe) handle: number,
  ): Promise<{ queued: true }> {
    await this.service.reprocessInboundEmail(handle);
    return { queued: true };
  }
}
