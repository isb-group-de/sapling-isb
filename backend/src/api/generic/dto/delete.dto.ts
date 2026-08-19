import { ApiProperty } from '@nestjs/swagger';

export type GenericDeleteAction = 'delete' | 'cancel';

export class GenericDeleteReferenceDto {
  @ApiProperty()
  name!: string;

  @ApiProperty()
  entityHandle!: string;

  @ApiProperty({ enum: ['1:m'] })
  kind!: '1:m';
}

export class GenericDeleteImpactDto {
  @ApiProperty({ enum: ['delete', 'cancel'] })
  action!: GenericDeleteAction;

  @ApiProperty({ type: [GenericDeleteReferenceDto] })
  references!: GenericDeleteReferenceDto[];
}

export class GenericDeleteResultDto {
  @ApiProperty({ enum: ['deleted', 'canceled'] })
  action!: 'deleted' | 'canceled';
}
