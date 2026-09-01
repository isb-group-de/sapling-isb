import {
  Injectable,
  OnApplicationShutdown,
  OnModuleInit,
} from '@nestjs/common';
import { QueueEvents } from 'bullmq';
import {
  REDIS_ENABLED,
  REDIS_PASSWORD,
  REDIS_PORT,
  REDIS_SERVER,
  REDIS_USERNAME,
} from '../../../constants/project.constants';
import { SystemErrorRecorderService } from './system-error-recorder.service';
import { MONITORED_QUEUE_NAMES } from './system-telemetry-collector.service';

@Injectable()
export class SystemQueueErrorCaptureService
  implements OnModuleInit, OnApplicationShutdown
{
  private queueEvents: QueueEvents[] = [];

  constructor(private readonly errors: SystemErrorRecorderService) {}

  onModuleInit(): void {
    if (!REDIS_ENABLED) return;
    this.queueEvents = MONITORED_QUEUE_NAMES.map((queueName) => {
      const events = new QueueEvents(queueName, {
        connection: {
          host: REDIS_SERVER,
          port: REDIS_PORT,
          username: REDIS_USERNAME || undefined,
          password: REDIS_PASSWORD || undefined,
        },
      });
      events.on('failed', ({ failedReason }) => {
        void this.errors.record({
          source: 'job',
          operation: `queue.${queueName}.failed`,
          error: new Error(failedReason || 'queue job failed'),
        });
      });
      events.on('stalled', () => {
        void this.errors.record({
          source: 'job',
          operation: `queue.${queueName}.stalled`,
          error: new Error('queue job stalled'),
        });
      });
      events.on('error', (error) => {
        void this.errors.record({
          source: 'telemetry',
          operation: `queue.${queueName}.events`,
          error,
        });
      });
      return events;
    });
  }

  async onApplicationShutdown(): Promise<void> {
    await Promise.allSettled(this.queueEvents.map((events) => events.close()));
  }
}
