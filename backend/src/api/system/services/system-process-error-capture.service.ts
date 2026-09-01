import {
  Injectable,
  OnApplicationShutdown,
  OnModuleInit,
} from '@nestjs/common';
import { SystemErrorRecorderService } from './system-error-recorder.service';

@Injectable()
export class SystemProcessErrorCaptureService
  implements OnModuleInit, OnApplicationShutdown
{
  constructor(private readonly errors: SystemErrorRecorderService) {}

  onModuleInit(): void {
    process.on('uncaughtExceptionMonitor', this.onUncaughtException);
    process.on('warning', this.onWarning);
  }

  onApplicationShutdown(): void {
    process.off('uncaughtExceptionMonitor', this.onUncaughtException);
    process.off('warning', this.onWarning);
  }

  private readonly onUncaughtException = (
    error: Error,
    origin: string,
  ): void => {
    void this.errors.record({
      source: 'process',
      operation: `process.${origin}`,
      error,
    });
  };

  private readonly onWarning = (warning: Error): void => {
    void this.errors.record({
      source: 'process',
      operation: 'process.warning',
      error: warning,
    });
  };
}
