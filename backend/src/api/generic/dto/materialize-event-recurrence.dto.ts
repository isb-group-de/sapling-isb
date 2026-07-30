import { IsDateString, IsOptional } from 'class-validator';

export class MaterializeEventRecurrenceDto {
  @IsOptional()
  @IsDateString()
  expectedUpdatedAt?: string;
}

export class MaterializeEventRecurrenceResponseDto {
  materializedCount!: number;
  handles!: Array<string | number>;
}
