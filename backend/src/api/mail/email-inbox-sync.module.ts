import { BullModule, getQueueToken } from '@nestjs/bullmq';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Module } from '@nestjs/common';
import {
  REDIS_ATTEMPTS,
  REDIS_BACKOFF_DELAY,
  REDIS_BACKOFF_STRATEGY,
  REDIS_ENABLED,
  REDIS_REMOVE_ON_COMPLETE,
  REDIS_REMOVE_ON_FAIL,
} from '../../constants/project.constants';
import { ENTITY_REGISTRY } from '../../entity/global/entity.registry';
import { AuthModule } from '../../auth/auth.module';
import { AiModule } from '../ai/ai.module';
import { DocumentModule } from '../document/document.module';
import { MailModule } from './mail.module';
import { EmailInboxProcessingService } from './email-inbox-processing.service';
import { EmailInboxProviderService } from './email-inbox-provider.service';
import { EmailInboxSyncController } from './email-inbox-sync.controller';
import { EmailInboxSyncProcessor } from './email-inbox-sync.processor';
import { EmailInboxSyncService } from './email-inbox-sync.service';
import { EMAIL_INBOX_SYNC_SERVICE_TOKEN } from './email-inbox-sync.token';

const MockQueue = {
  add: () => null,
};

@Module({
  imports: [
    AuthModule,
    AiModule,
    DocumentModule,
    MailModule,
    MikroOrmModule.forFeature(
      ENTITY_REGISTRY.map((entry) => entry.class as new () => unknown),
    ),
    ...(REDIS_ENABLED
      ? [
          BullModule.registerQueue({
            name: 'email-inbox-sync',
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
  controllers: [EmailInboxSyncController],
  providers: [
    EmailInboxProviderService,
    EmailInboxProcessingService,
    EmailInboxSyncService,
    {
      provide: EMAIL_INBOX_SYNC_SERVICE_TOKEN,
      useExisting: EmailInboxSyncService,
    },
    ...(REDIS_ENABLED ? [EmailInboxSyncProcessor] : []),
    ...(!REDIS_ENABLED
      ? [
          {
            provide: getQueueToken('email-inbox-sync'),
            useValue: MockQueue,
          },
        ]
      : []),
  ],
  exports: [EmailInboxSyncService, EMAIL_INBOX_SYNC_SERVICE_TOKEN],
})
export class EmailInboxSyncModule {}
