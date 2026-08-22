import { IsArray, IsBoolean, IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class GenerateSlotsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  date?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  times?: string[];
}

export class BlockSlotDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  blocked?: boolean;
}
