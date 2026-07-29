import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import type {
  CalendarSyncProvider,
  CalendarSyncRange,
} from '../../../entity/CalendarSyncSubscriptionItem';

export class CalendarClassificationMappingDto {
  @ApiProperty()
  @IsString()
  @MaxLength(128)
  externalValue!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  eventTypeHandle?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  eventCategoryHandle?: string | null;
}

export class OutlookCalendarCategoryDto {
  @ApiProperty()
  displayName!: string;

  @ApiPropertyOptional()
  id?: string;

  @ApiPropertyOptional()
  color?: string;
}

export class CalendarSyncSubscriptionDto {
  @ApiPropertyOptional()
  handle?: number;

  @ApiProperty()
  isAvailable!: boolean;

  @ApiProperty({ enum: ['azure', 'google'] })
  provider!: CalendarSyncProvider;

  @ApiProperty()
  isActive!: boolean;

  @ApiProperty({ enum: ['day', 'week', 'month'] })
  syncRange!: CalendarSyncRange;

  @ApiProperty()
  intervalMinutes!: number;

  @ApiProperty()
  defaultEventTypeHandle!: string;

  @ApiProperty()
  defaultEventCategoryHandle!: string;

  @ApiProperty({ type: () => CalendarClassificationMappingDto, isArray: true })
  classificationMappings!: CalendarClassificationMappingDto[];

  @ApiPropertyOptional({ type: 'string', format: 'date-time' })
  lastRunAt?: Date | null;

  @ApiPropertyOptional({ type: 'string', format: 'date-time' })
  lastSuccessAt?: Date | null;

  @ApiPropertyOptional()
  lastError?: string | null;

  @ApiProperty()
  lastImportedCount!: number;

  @ApiProperty()
  lastCreatedCount!: number;

  @ApiProperty()
  lastUpdatedCount!: number;

  @ApiProperty()
  lastSkippedCount!: number;
}

export class UpdateCalendarSyncSubscriptionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ enum: ['day', 'week', 'month'] })
  @IsOptional()
  @IsIn(['day', 'week', 'month'])
  syncRange?: CalendarSyncRange;

  @ApiPropertyOptional({ minimum: 5, maximum: 1440 })
  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(1440)
  intervalMinutes?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  defaultEventTypeHandle?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  defaultEventCategoryHandle?: string;

  @ApiPropertyOptional({
    type: () => CalendarClassificationMappingDto,
    isArray: true,
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CalendarClassificationMappingDto)
  classificationMappings?: CalendarClassificationMappingDto[];
}
