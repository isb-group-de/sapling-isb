import { Type, Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class GenericBulkUpdateTargetDto {
  @Transform(({ value }: { value: unknown }): unknown =>
    typeof value === 'string' || typeof value === 'number'
      ? String(value).trim()
      : value,
  )
  @IsString()
  @IsNotEmpty()
  handle!: string;

  @IsOptional()
  @IsDateString()
  expectedUpdatedAt?: string;
}

export class GenericBulkUpdateDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => GenericBulkUpdateTargetDto)
  targets!: GenericBulkUpdateTargetDto[];

  @IsObject()
  changes!: Record<string, unknown>;
}

export class GenericBulkUpdateResponseDto {
  updatedCount!: number;
  handles!: string[];
}
