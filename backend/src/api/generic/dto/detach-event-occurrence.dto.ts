import { IsDateString, IsObject, IsOptional } from 'class-validator';

export class DetachEventOccurrenceDto {
  @IsDateString()
  occurrenceStart!: string;

  @IsObject()
  event!: Record<string, unknown>;

  @IsOptional()
  @IsDateString()
  expectedUpdatedAt?: string;
}

export class DetachEventOccurrenceResponseDto {
  seriesHandle!: string | number;
  detachedEvent!: object;
}
