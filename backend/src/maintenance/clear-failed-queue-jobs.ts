import { Queue } from 'bullmq';
import {
  REDIS_ENABLED,
  REDIS_PASSWORD,
  REDIS_PORT,
  REDIS_SERVER,
  REDIS_USERNAME,
} from '../constants/project.constants';
import { MONITORED_QUEUE_NAMES } from '../api/system/services/system-telemetry-collector.service';

const CONFIRMATION_FLAG = '--confirm';
const CLEAN_BATCH_SIZE = 1_000;

async function clearFailedQueueJobs(): Promise<void> {
  if (!REDIS_ENABLED) {
    throw new Error(
      'REDIS_ENABLED must be true to inspect or clean BullMQ queues.',
    );
  }

  const confirmed = process.argv.includes(CONFIRMATION_FLAG);
  const queues = MONITORED_QUEUE_NAMES.map(
    (name) =>
      new Queue(name, {
        connection: {
          host: REDIS_SERVER,
          port: REDIS_PORT,
          username: REDIS_USERNAME || undefined,
          password: REDIS_PASSWORD || undefined,
        },
      }),
  );

  try {
    for (const queue of queues) {
      const counts = await queue.getJobCounts('failed');
      const failed = Number(counts.failed ?? 0);
      if (!confirmed) {
        console.log(`${queue.name}: ${failed} failed jobs`);
        continue;
      }

      let removed = 0;
      while (true) {
        const batch = await queue.clean(0, CLEAN_BATCH_SIZE, 'failed');
        removed += batch.length;
        if (batch.length < CLEAN_BATCH_SIZE) break;
      }
      console.log(`${queue.name}: removed ${removed} failed jobs`);
    }

    if (!confirmed) {
      console.log(
        `Preview only. Run again with ${CONFIRMATION_FLAG} while the Sapling backend is stopped to delete these failed jobs.`,
      );
    }
  } finally {
    await Promise.allSettled(queues.map((queue) => queue.close()));
  }
}

void clearFailedQueueJobs().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
