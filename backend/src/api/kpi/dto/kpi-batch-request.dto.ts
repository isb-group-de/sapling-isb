import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayMinSize, IsArray } from 'class-validator';

export class KpiBatchRequestDto {
  @ApiProperty({
    description: 'KPI handles that should be executed in one request.',
    type: Number,
    isArray: true,
    maxItems: 50,
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  handles!: Array<number | string>;
}
