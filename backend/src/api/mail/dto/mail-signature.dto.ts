import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, Min } from 'class-validator';

export class MailSignatureSettingsDto {
  @ApiProperty()
  @IsBoolean()
  signatureRotation!: boolean;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  defaultSignatureHandle?: number | null;
}
