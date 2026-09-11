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
  OutlookShowAs,
} from '../../../entity/CalendarSyncSubscriptionItem';
import { OUTLOOK_SHOW_AS_VALUES } from '../../outlook-availability.utils';

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

export class OutlookAvailabilityMappingDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  eventStatusHandle?: string | null;

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

  @ApiProperty({ enum: OUTLOOK_SHOW_AS_VALUES })
  @IsIn(OUTLOOK_SHOW_AS_VALUES)
  showAs!: OutlookShowAs;
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

  @ApiProperty({ type: () => OutlookAvailabilityMappingDto, isArray: true })
  outlookAvailabilityMappings!: OutlookAvailabilityMappingDto[];

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

  @ApiPropertyOptional({
    type: () => OutlookAvailabilityMappingDto,
    isArray: true,
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OutlookAvailabilityMappingDto)
  outlookAvailabilityMappings?: OutlookAvailabilityMappingDto[];
}
