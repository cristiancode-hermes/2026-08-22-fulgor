import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { SlotsService } from './slots.service';
import { BlockSlotDto, GenerateSlotsDto } from './slots.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { StaffGuard } from '../auth/current-user';
import { madridDate } from '../common/booking-rules';

@ApiTags('slots')
@Controller()
export class SlotsController {
  constructor(private readonly slots: SlotsService) {}

  @Get('arenas/:arenaId/slots')
  list(
    @Param('arenaId', ParseIntPipe) arenaId: number,
    @Query('date') date?: string,
  ) {
    return this.slots.listForArena(arenaId, date || madridDate());
  }

  @Get('slots/:id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.slots.findOne(id);
  }

  @Post('arenas/:arenaId/slots/generate')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, StaffGuard)
  generate(
    @Param('arenaId', ParseIntPipe) arenaId: number,
    @Body() dto: GenerateSlotsDto,
  ) {
    return this.slots.generate(arenaId, dto.date || madridDate(), dto.times);
  }

  @Patch('slots/:id/block')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, StaffGuard)
  block(@Param('id', ParseIntPipe) id: number, @Body() dto: BlockSlotDto) {
    return this.slots.setBlocked(id, !!dto.blocked);
  }
}
