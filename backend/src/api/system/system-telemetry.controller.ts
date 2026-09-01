import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import {
  ClientErrorTelemetryDto,
  ClientMetricTelemetryDto,
} from './dto/monitoring-query.dto';
import { SystemErrorRecorderService } from './services/system-error-recorder.service';
import { SystemTelemetryEnvironmentService } from './services/system-telemetry-environment.service';

@Controller()
export class SystemTelemetryController {
  private windowStartedAt = Date.now();
  private acceptedInWindow = 0;

  constructor(
    private readonly errors: SystemErrorRecorderService,
    private readonly em: EntityManager,
    private readonly environment: SystemTelemetryEnvironmentService,
  ) {}

  @Post('api/system/telemetry/client-error')
  @HttpCode(HttpStatus.ACCEPTED)
  async recordClientError(@Body() dto: ClientErrorTelemetryDto) {
    if (!this.acceptWithinLimit())
      return { accepted: false, rateLimited: true };
    await this.errors.record({
      source: 'frontend',
      operation: dto.operation,
      error: {
        name: dto.errorClass,
        code: dto.errorCode,
        message: dto.message,
        stack: dto.stack,
      },
      requestId: dto.requestId,
      correlationId: dto.correlationId,
    });
    return { accepted: true };
  }

  @Post('api/system/telemetry/client-metric')
  @HttpCode(HttpStatus.ACCEPTED)
  async recordClientMetric(@Body() dto: ClientMetricTelemetryDto) {
    if (!this.acceptWithinLimit())
      return { accepted: false, rateLimited: true };
    const em = this.em.fork();
    await this.environment.ensure(em);
    const instances = (await em.getConnection().execute(
      `select "handle" from "system_telemetry_instance_item"
       where "environment_handle" = ? and "status" = 'active'
       order by "process_started_at" desc limit 1`,
      [this.environment.currentId],
    )) as Array<{ handle: string }>;
    if (!instances[0]?.handle) return { accepted: false };
    await em.getConnection().execute(
      `insert into "system_metric_bucket_item" (
        "instance_handle", "bucket_start", "resolution", "metric_key", "dimension_key",
        "sample_count", "minimum", "maximum", "sum", "last", "created_at"
      ) values (?, date_bin(interval '1 minute', now(), timestamp '2000-01-01'), '1m', ?, ?, 1, ?, ?, ?, ?, now())
      on conflict ("instance_handle", "bucket_start", "resolution", "metric_key", "dimension_key") do update set
        "sample_count" = "system_metric_bucket_item"."sample_count" + 1,
        "minimum" = least("system_metric_bucket_item"."minimum", excluded."minimum"),
        "maximum" = greatest("system_metric_bucket_item"."maximum", excluded."maximum"),
        "sum" = "system_metric_bucket_item"."sum" + excluded."sum", "last" = excluded."last"`,
      [
        instances[0].handle,
        dto.metricKey,
        dto.page,
        dto.value,
        dto.value,
        dto.value,
        dto.value,
      ],
    );
    return { accepted: true };
  }

  @Get('api/health/live')
  @Header('Cache-Control', 'no-store')
  live() {
    return { status: 'alive' };
  }

  @Get('api/health/ready')
  @Header('Cache-Control', 'no-store')
  async ready() {
    await this.em.fork().getConnection().execute('select 1');
    return { status: 'ready' };
  }

  private acceptWithinLimit(): boolean {
    const now = Date.now();
    if (now - this.windowStartedAt >= 60_000) {
      this.windowStartedAt = now;
      this.acceptedInWindow = 0;
    }
    if (this.acceptedInWindow >= 100) return false;
    this.acceptedInWindow += 1;
    return true;
  }
}
