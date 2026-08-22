import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class HoldBookingDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  slotId?: number;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(4)
  @Max(16)
  partySize: number;

  @ApiPropertyOptional({ type: [Number] })
  @IsOptional()
  @IsArray()
  @Type(() => Number)
  @IsInt({ each: true })
  missionIds?: number[];

  @ApiPropertyOptional({ type: [Number] })
  @IsOptional()
  @IsArray()
  @Type(() => Number)
  addonIds?: number[];

  @ApiPropertyOptional({ type: [Number] })
  @IsOptional()
  @IsArray()
  @Type(() => Number)
  menuItemIds?: number[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  extraHour?: boolean;
}

export class PatchBookingDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(4)
  @Max(16)
  partySize?: number;

  @ApiPropertyOptional({ type: [Number] })
  @IsOptional()
  @IsArray()
  @Type(() => Number)
  addonIds?: number[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  extraHour?: boolean;
}

export class ConfirmBookingDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  paymentNonce?: string;
}

export class QueueReplaceDto {
  @ApiProperty({ type: [Number] })
  @IsArray()
  @Type(() => Number)
  @IsInt({ each: true })
  missionIds: number[];
}

export class QueueReorderDto {
  @ApiProperty({ type: [Number] })
  @IsArray()
  @Type(() => Number)
  @IsInt({ each: true })
  orderedEntryIds: number[];
}
