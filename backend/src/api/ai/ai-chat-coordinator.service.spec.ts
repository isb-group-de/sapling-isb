import { describe, expect, it } from '@jest/globals';
import { ConflictException } from '@nestjs/common';
import { AiChatCoordinatorService } from './ai-chat-coordinator.service';

describe('AiChatCoordinatorService', () => {
  it('allows exactly one run per session and releases it afterwards', async () => {
    const service = new AiChatCoordinatorService();
    let finish!: () => void;
    const pending = service.run(
      42,
      () => new Promise<void>((resolve) => (finish = resolve)),
    );

    expect(service.isRunning(42)).toBe(true);
    await expect(
      service.run(42, () => Promise.resolve()),
    ).rejects.toBeInstanceOf(ConflictException);
    finish();
    await pending;
    expect(service.isRunning(42)).toBe(false);
  });

  it('aborts an active run and notifies idle listeners', async () => {
    const service = new AiChatCoordinatorService();
    const idleSessions: number[] = [];
    service.onIdle((handle) => idleSessions.push(handle));

    const pending = service.run(
      7,
      (signal) =>
        new Promise<void>((resolve) =>
          signal.addEventListener('abort', () => resolve(), { once: true }),
        ),
    );
    expect(service.interrupt(7)).toBe(true);
    await pending;
    expect(idleSessions).toEqual([7]);
  });
});
