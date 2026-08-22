import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Arena, ArenaSlot, Booking } from '../entities/entities';
import { addDaysYmd, isLivePending, madridDate } from '../common/booking-rules';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { StaffGuard } from '../auth/current-user';

@ApiTags('stats')
@Controller('stats')
export class StatsController {
  constructor(
    @InjectRepository(Booking) private readonly bookings: Repository<Booking>,
    @InjectRepository(ArenaSlot) private readonly slots: Repository<ArenaSlot>,
    @InjectRepository(Arena) private readonly arenas: Repository<Arena>,
  ) {}

  @Get('occupancy')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, StaffGuard)
  async occupancy(@Query('date') date?: string) {
    const d = date || madridDate();
    const daySlots = await this.slots.find({ where: { date: d, blocked: false } });
    let occupied = 0;
    for (const s of daySlots) {
      const bks = await this.bookings.find({ where: { slotId: s.id } });
      const busy = bks.some(
        (b) =>
          b.status === 'confirmed' ||
          b.status === 'checked_in' ||
          b.status === 'in_play' ||
          isLivePending(b.status, b.expiresAt),
      );
      if (busy) occupied += 1;
    }
    const total = daySlots.length;
    const pct = total === 0 ? 0 : Math.round((1000 * occupied) / total) / 10;
    return { occupied, total, pct, date: d, arenas: await this.arenas.count({ where: { active: true } }) };
  }

  @Get('revenue')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, StaffGuard)
  async revenue(@Query('days') days?: string) {
    const n = Math.min(31, Math.max(1, Number(days) || 7));
    const today = madridDate();
    const start = addDaysYmd(today, -(n - 1));
    const series: { date: string; cents: number; bookings: number }[] = [];
    for (let i = 0; i < n; i++) {
      const date = addDaysYmd(start, i);
      const daySlots = await this.slots.find({ where: { date } });
      let cents = 0;
      let count = 0;
      for (const s of daySlots) {
        const bks = await this.bookings.find({ where: { slotId: s.id } });
        for (const b of bks) {
          if (['confirmed', 'checked_in', 'in_play', 'completed'].includes(b.status)) {
            cents += b.totalCents;
            count += 1;
          }
        }
      }
      series.push({ date, cents, bookings: count });
    }
    return { series };
  }
}
