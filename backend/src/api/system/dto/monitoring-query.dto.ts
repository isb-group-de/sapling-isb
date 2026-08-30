import { Transform, Type } from 'class-transformer';
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
  Max,
  Min,
} from 'class-validator';

export class MonitoringRangeQueryDto {
  @IsOptional()
  @IsISO8601()
  from?: string;

  @IsOptional()
  @IsISO8601()
  to?: string;
}

export class MonitoringSeriesQueryDto extends MonitoringRangeQueryDto {
  @Transform(({ value }) =>
    Array.isArray(value)
      ? value
      : String(value ?? '')
          .split(',')
          .map((entry) => entry.trim())
          .filter(Boolean),
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
  instanceId?: string;
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
