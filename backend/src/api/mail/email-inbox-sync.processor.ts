import { EntityManager, RequestContext } from '@mikro-orm/core';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Job } from 'bullmq';
import {
  EmailInboxSyncService,
  type EmailInboxSyncJob,
} from './email-inbox-sync.service';

@Processor('email-inbox-sync')
@Injectable()
export class EmailInboxSyncProcessor extends WorkerHost {
  constructor(
    private readonly service: EmailInboxSyncService,
    private readonly em: EntityManager,
  ) {
    super();
  }

  async process(job: Job<EmailInboxSyncJob>): Promise<void> {
    return RequestContext.create(this.em.fork(), () => this.processJob(job));
  }

  private async processJob(job: Job<EmailInboxSyncJob>): Promise<void> {
    switch (job.name) {
      case 'schedule-email-inbox-imports':
        await this.service.enqueueDueSubscriptions();
        return;
      case 'import-email-inbox':
        if (job.data.subscriptionHandle == null) {
          throw new Error('emailInboxSubscription.handleRequired');
        }
        await this.service.synchronizeSubscription(
          job.data.subscriptionHandle,
          job.data.since ? new Date(job.data.since) : undefined,
          job.data.manual === true,
        );
        return;
      case 'process-inbound-email':
        if (job.data.inboundEmailHandle == null) {
          throw new Error('inboundEmail.handleRequired');
        }
        await this.service.processInboundEmail(job.data.inboundEmailHandle);
        return;
      default:
        throw new Error(`emailInboxSubscription.unknownJob:${job.name}`);
    }
  }
}
