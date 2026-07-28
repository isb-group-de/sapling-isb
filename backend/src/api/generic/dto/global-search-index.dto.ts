import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type {
  GlobalSearchIndexRebuildState,
  GlobalSearchIndexRebuildStatus,
} from '../global-search-index.service';

export class GlobalSearchIndexRebuildStatusDto implements GlobalSearchIndexRebuildStatus {
  @ApiProperty({
    enum: ['idle', 'running', 'completed', 'failed'],
  })
  state!: GlobalSearchIndexRebuildState;

  @ApiProperty()
  processedRecords!: number;

  @ApiProperty()
  indexedEntities!: number;

  @ApiProperty()
  indexedItems!: number;

  @ApiPropertyOptional({ nullable: true })
  currentEntityHandle!: string | null;

  @ApiProperty()
  currentEntityProcessed!: number;

  @ApiProperty()
  currentEntityTotal!: number;

  @ApiPropertyOptional({ nullable: true, format: 'date-time' })
  startedAt!: string | null;

  @ApiPropertyOptional({ nullable: true, format: 'date-time' })
  completedAt!: string | null;

  @ApiPropertyOptional({ nullable: true })
  durationMs!: number | null;

  @ApiPropertyOptional({ nullable: true })
  error!: string | null;
}
