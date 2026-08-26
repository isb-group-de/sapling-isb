import { ApiProperty } from '@nestjs/swagger';

export class DatabaseTableDto {
  @ApiProperty({ example: 'public' })
  schema!: string;

  @ApiProperty({ example: 'document_item' })
  name!: string;

  @ApiProperty({
    example: 12582912,
    description: 'Table and index size in bytes.',
  })
  size!: number;
}

export class DatabaseDto {
  @ApiProperty({ example: 'PostgreSQL' })
  engine!: string;

  @ApiProperty({ example: 'sapling' })
  name!: string;

  @ApiProperty({ example: '17.4' })
  version!: string;

  @ApiProperty({ example: 'public' })
  schema!: string;

  @ApiProperty({ example: 157286400, description: 'Database size in bytes.' })
  size!: number;

  @ApiProperty({ example: 8 })
  activeConnections!: number;

  @ApiProperty({ example: 100 })
  maxConnections!: number;

  @ApiProperty({ example: '2026-08-25T05:31:00.000Z' })
  startedAt!: string;

  @ApiProperty({ example: 142 })
  tableCount!: number;

  @ApiProperty({ type: DatabaseTableDto, isArray: true })
  largestTables!: DatabaseTableDto[];
}
