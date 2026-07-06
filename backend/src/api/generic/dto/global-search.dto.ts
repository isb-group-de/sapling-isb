import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class GlobalSearchQueryDto {
  @ApiProperty({
    description: 'Free-text query used for metadata-driven global record search.',
    example: 'Müller',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  query!: string;

  @ApiPropertyOptional({
    description: 'Maximum number of results returned across all entities.',
    default: 12,
    minimum: 1,
    maximum: 25,
    type: Number,
  })
  @IsOptional()
  limit?: number;

  @ApiPropertyOptional({
    description:
      'Optional comma-separated entity handles that constrain the search scope.',
    example: 'person,company',
    type: String,
  })
  @IsOptional()
  @IsString()
  entityHandles?: string;
}

export class GlobalSearchMatchDto {
  @ApiProperty({ description: 'Matched field name.' })
  field!: string;

  @ApiProperty({ description: 'Short human-readable field value preview.' })
  value!: string;
}

export class GlobalSearchResultDto {
  @ApiProperty({ description: 'Source entity handle.' })
  entityHandle!: string;

  @ApiProperty({ description: 'Source record handle.', oneOf: [{ type: 'string' }, { type: 'number' }] })
  recordHandle!: string | number;

  @ApiProperty({ description: 'Human-readable record label.' })
  label!: string;

  @ApiPropertyOptional({ description: 'Short preview of the matching content.' })
  preview?: string;

  @ApiPropertyOptional({ description: 'Entity icon used by the frontend.' })
  icon?: string | null;

  @ApiPropertyOptional({ description: 'Fallback frontend path for the record.' })
  path?: string;

  @ApiProperty({
    description: 'Relative match score used for result ordering.',
    type: Number,
  })
  score!: number;

  @ApiProperty({
    description: 'Matched fields with compact previews.',
    type: [GlobalSearchMatchDto],
  })
  matches!: GlobalSearchMatchDto[];
}

export class GlobalSearchResponseDto {
  @ApiProperty({ description: 'Normalized query that was executed.' })
  query!: string;

  @ApiProperty({
    description: 'Global record search results.',
    type: [GlobalSearchResultDto],
  })
  items!: GlobalSearchResultDto[];
}
