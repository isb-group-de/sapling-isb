import { ApiProperty } from '@nestjs/swagger';

export class DocumentStorageEntityDto {
  @ApiProperty({ example: 'ticket' })
  entityHandle!: string;

  @ApiProperty({ example: 5242880, description: 'Stored file size in bytes.' })
  size!: number;

  @ApiProperty({ example: 12 })
  fileCount!: number;
}

export class DocumentStorageDto {
  @ApiProperty({
    example: 15728640,
    description: 'Total stored file size in bytes.',
  })
  totalSize!: number;

  @ApiProperty({ example: 31 })
  totalFileCount!: number;

  @ApiProperty({ example: 6 })
  entityCount!: number;

  @ApiProperty({ type: DocumentStorageEntityDto, isArray: true })
  entities!: DocumentStorageEntityDto[];
}
