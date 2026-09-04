import { BullModule, getQueueToken } from '@nestjs/bullmq';
import { Global, Module } from '@nestjs/common';
import {
  REDIS_ATTEMPTS,
  REDIS_BACKOFF_DELAY,
  REDIS_BACKOFF_STRATEGY,
  REDIS_ENABLED,
  REDIS_REMOVE_ON_COMPLETE,
  REDIS_REMOVE_ON_FAIL,
} from '../../constants/project.constants';
import { TemplateModule } from '../template/template.module';
import { AutomationEventService } from './automation-event.service';
import { AutomationReferenceResolverService } from './automation-reference-resolver.service';

@Global()
@Module({
  imports: [
    TemplateModule,
    ...(REDIS_ENABLED
      ? [
          BullModule.registerQueue({
            name: 'automations',
            defaultJobOptions: {
              attempts: REDIS_ATTEMPTS,
              backoff: {
                type: REDIS_BACKOFF_STRATEGY,
                delay: REDIS_BACKOFF_DELAY,
              },
              removeOnComplete: REDIS_REMOVE_ON_COMPLETE,
              removeOnFail: REDIS_REMOVE_ON_FAIL,
            },
          }),
        ]
      : []),
  ],
  providers: [
    AutomationEventService,
    AutomationReferenceResolverService,
    ...(!REDIS_ENABLED
      ? [
          {
            provide: getQueueToken('automations'),
            useValue: { add: () => null },
          },
        ]
      : []),
  ],
  exports: [
    AutomationEventService,
    AutomationReferenceResolverService,
    ...(REDIS_ENABLED ? [BullModule] : []),
  ],
})
export class AutomationEventsModule {}
