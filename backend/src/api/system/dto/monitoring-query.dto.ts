import { Transform, Type, type TransformFnParams } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsNumber,
  IsString,
  MaxLength,
  Max,
  Min,
} from 'class-validator';

export class MonitoringRangeQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(96)
  environment?: string;

  @IsOptional()
  @IsISO8601()
  from?: string;

  @IsOptional()
  @IsISO8601()
  to?: string;
}

export class MonitoringSeriesQueryDto extends MonitoringRangeQueryDto {
  @Transform((params: TransformFnParams) =>
    normalizeMetrics(params.value as unknown),
  )
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  metrics: string[] = [];

  @IsOptional()
  @IsIn(['auto', '10s', '1m', '15m', '1h'])
  resolution: 'auto' | '10s' | '1m' | '15m' | '1h' = 'auto';

  @IsOptional()
  @IsString()
  @MaxLength(128)
  instanceId?: string;
}

function normalizeMetrics(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value.map((entry: unknown) => entry);
  }
  if (value != null && typeof value !== 'string' && typeof value !== 'number') {
    return [value];
  }
  const serialized = typeof value === 'number' ? String(value) : (value ?? '');
  return serialized
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export class MonitoringUsersQueryDto extends MonitoringRangeQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 50;

  @IsOptional()
  @IsIn(['name', 'lastActivityAt', 'requests', 'errors', 'traffic', 'tokens'])
  sort = 'lastActivityAt';
}

export class MonitoringGroupQueryDto extends MonitoringRangeQueryDto {
  @IsOptional()
  @IsIn(['route', 'auth', 'provider', 'model', 'person', 'day'])
  groupBy = 'route';
}

export class UpdateSystemAlertRuleDto {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ allowInfinity: false, allowNaN: false })
  threshold?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(60)
  @Max(86400)
  windowSeconds?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  minimumCount?: number;
}

export class ClientErrorTelemetryDto {
  @IsString()
  @MaxLength(160)
  operation!: string;

  @IsString()
  @MaxLength(128)
  errorClass!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  errorCode?: string;

  @IsString()
  @MaxLength(500)
  message!: string;

  @IsOptional()
  @IsString()
  @MaxLength(8000)
  stack?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  requestId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  correlationId?: string;
}

export class ExecuteRemediationDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  incidentHandle?: number;
}

export class ClientMetricTelemetryDto {
  @IsIn(['web.lcpMs', 'web.cls', 'web.inpMs', 'web.bootMs'])
  metricKey!: 'web.lcpMs' | 'web.cls' | 'web.inpMs' | 'web.bootMs';

  @Type(() => Number)
  @IsNumber({ allowInfinity: false, allowNaN: false })
  @Min(0)
  value!: number;

  @IsString()
  @MaxLength(64)
  page!: string;
}
