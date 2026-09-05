import { Transform } from 'class-transformer';
import { IsNotEmpty, IsObject, IsString, Matches } from 'class-validator';
import type { EntityTemplateDto } from '../../template/dto/entity-template.dto';

export type MergeSource = 'loser' | 'winner';

export class GenericMergePairDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'number' ? String(value) : value,
  )
  @IsString()
  @IsNotEmpty()
  loserHandle!: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'number' ? String(value) : value,
  )
  @IsString()
  @IsNotEmpty()
  winnerHandle!: string;
}

export class GenericMergeDto extends GenericMergePairDto {
  @IsString()
  @Matches(/^[a-f0-9]{64}$/)
  previewToken!: string;

  @IsObject()
  selections!: Record<string, MergeSource>;
}

export interface GenericMergeField {
  property: string;
  template: EntityTemplateDto;
  loserValue: unknown;
  winnerValue: unknown;
  selectedSource: MergeSource;
  selectable: boolean;
}

export interface GenericMergePreview {
  loser: Record<string, unknown>;
  winner: Record<string, unknown>;
  fields: GenericMergeField[];
  previewToken: string;
}

export interface GenericMergeResult {
  winner: object;
  deletedHandle: string | number;
}
