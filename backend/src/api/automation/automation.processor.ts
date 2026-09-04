import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { AutomationProcessorService } from './automation-processor.service';

@Processor('automations')
export class AutomationQueueProcessor extends WorkerHost {
  constructor(private readonly processor: AutomationProcessorService) {
    super();
  }
  async process(job: Job): Promise<void> {
    void job;
    await this.processor.processPending();
  }
}
