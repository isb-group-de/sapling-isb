import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsInt,
  IsPositive,
  IsOptional,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import type { DashboardWidget } from '../../../entity/dashboard-widget.types';

export class DashboardLayoutEntryDto {
  @ApiProperty({ example: 42 })
  @IsInt()
  @IsPositive()
  handle!: number;

  @ApiProperty({ type: [Number], example: [101, 102, 103] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @ArrayUnique()
  @IsInt({ each: true })
  @IsPositive({ each: true })
  kpiOrder?: number[];

  @ApiProperty({ type: 'array', items: { type: 'object' }, required: false })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  widgets?: DashboardWidget[];
}

export class UpdateDashboardLayoutDto {
  @ApiProperty({ type: [DashboardLayoutEntryDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ArrayUnique((entry: DashboardLayoutEntryDto) => entry.handle)
  @ValidateNested({ each: true })
  @Type(() => DashboardLayoutEntryDto)
  dashboards!: DashboardLayoutEntryDto[];
}

export class DashboardLayoutResultDto {
  @ApiProperty({ example: 3 })
  updatedCount!: number;

  @ApiProperty({ type: [Number], example: [42, 9, 17] })
  dashboardHandles!: number[];
}
