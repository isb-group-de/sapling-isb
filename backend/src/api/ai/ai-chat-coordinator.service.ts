import { ConflictException, Injectable } from '@nestjs/common';

@Injectable()
export class AiChatCoordinatorService {
  private readonly activeRuns = new Map<number, AbortController>();
  private readonly idleListeners = new Set<(sessionHandle: number) => void>();

  onIdle(listener: (sessionHandle: number) => void): () => void {
    this.idleListeners.add(listener);
    return () => this.idleListeners.delete(listener);
  }

  isRunning(sessionHandle: number): boolean {
    return this.activeRuns.has(sessionHandle);
  }

  interrupt(sessionHandle: number): boolean {
    const controller = this.activeRuns.get(sessionHandle);
    if (!controller) return false;
    controller.abort();
    return true;
  }

  async run<T>(
    sessionHandle: number,
    task: (signal: AbortSignal) => Promise<T>,
  ): Promise<T> {
    if (this.activeRuns.has(sessionHandle)) {
      throw new ConflictException('ai.chatRunAlreadyActive');
    }
    const controller = new AbortController();
    this.activeRuns.set(sessionHandle, controller);
    try {
      return await task(controller.signal);
    } finally {
      if (this.activeRuns.get(sessionHandle) === controller) {
        this.activeRuns.delete(sessionHandle);
        for (const listener of this.idleListeners) listener(sessionHandle);
      }
    }
  }
}
