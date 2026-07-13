import { ApiProperty } from '@nestjs/swagger';
import { KpiResponseDto } from './kpi-response.dto';

export class KpiBatchResponseDto {
  @ApiProperty({
    description:
      'Executed KPI results in the same order as the requested handles.',
    type: () => KpiResponseDto,
    isArray: true,
  })
  items!: KpiResponseDto[];
}
