import { Module } from '@nestjs/common';
import { GenericModule } from '../generic/generic.module';
import { InboxModule } from '../inbox/inbox.module';
import { AutomationConditionService } from './automation-condition.service';
import { AutomationProcessorService } from './automation-processor.service';
import { TeamsModule } from '../teams/teams.module';
import { WebhookModule } from '../webhook/webhook.module';
import { AutomationEventsModule } from './automation-events.module';
import { AutomationQueueProcessor } from './automation.processor';
import { REDIS_ENABLED } from '../../constants/project.constants';
import { CurrentModule } from '../current/current.module';

@Module({
  imports: [
    AutomationEventsModule,
    GenericModule,
    InboxModule,
    TeamsModule,
    WebhookModule,
    CurrentModule,
  ],
  providers: [
    AutomationConditionService,
    AutomationProcessorService,
    ...(REDIS_ENABLED ? [AutomationQueueProcessor] : []),
  ],
})
export class AutomationModule {}
