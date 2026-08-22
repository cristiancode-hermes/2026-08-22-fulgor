import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CheckInDto {
  @ApiProperty()
  @IsString()
  @MinLength(3)
  code: string;
}
