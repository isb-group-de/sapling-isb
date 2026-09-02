import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsObject,
  IsOptional,
} from 'class-validator';

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

export class DetachEventOccurrencesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @IsDateString({}, { each: true })
  occurrenceStarts!: string[];

  @IsObject()
  event!: Record<string, unknown>;

  @IsOptional()
  @IsDateString()
  expectedUpdatedAt?: string;
}

export class DetachEventOccurrencesResponseDto {
  seriesHandle!: string | number;
  seriesEvent!: object;
  detachedCount!: number;
  detachedEvents!: object[];
}
