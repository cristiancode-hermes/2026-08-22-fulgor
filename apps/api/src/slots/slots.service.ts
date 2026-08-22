import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Booking, Arena, ArenaSlot } from '../entities/entities';
import { SLOT_HOURS, slotIsBusy, sortNightSlots } from '../common/booking-rules';

function endOf(start: string): string {
  const [h, m] = start.split(':').map(Number);
  const endH = (h + 1) % 24;
  return `${String(endH).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

@Injectable()
export class SlotsService {
  constructor(
    @InjectRepository(ArenaSlot) private readonly slots: Repository<ArenaSlot>,
    @InjectRepository(Arena) private readonly arenas: Repository<Arena>,
    @InjectRepository(Booking) private readonly bookings: Repository<Booking>,
  ) {}

  async listForArena(arenaId: number, date: string) {
    const arena = await this.arenas.findOne({ where: { id: arenaId } });
    if (!arena) throw new NotFoundException('Arena no encontrada');
    const rows = await this.slots.find({ where: { arenaId, date } });
    const slots = [];
    for (const s of rows) slots.push(await this.toView(s, arena));
    return { slots: sortNightSlots(slots) };
  }

  async findOne(id: number) {
    const slot = await this.slots.findOne({ where: { id }, relations: { arena: true } });
    if (!slot) throw new NotFoundException('Franja no encontrada');
    const view = await this.toView(slot, slot.arena);
    return { slot: view, arena: slot.arena };
  }

  async generate(arenaId: number, date: string, times?: string[]) {
    const arena = await this.arenas.findOne({ where: { id: arenaId } });
    if (!arena) throw new NotFoundException('Arena no encontrada');
    const list = times?.length ? times : SLOT_HOURS();
    let created = 0;
    for (const startTime of list) {
      const exists = await this.slots.findOne({ where: { arenaId, date, startTime } });
      if (exists) continue;
      await this.slots.save({
        arenaId,
        date,
        startTime,
        endTime: endOf(startTime),
        blocked: false,
      } as any);
      created += 1;
    }
    return { created };
  }

  async setBlocked(id: number, blocked: boolean) {
    const slot = await this.slots.findOne({ where: { id } });
    if (!slot) throw new NotFoundException('Franja no encontrada');
    slot.blocked = blocked;
    await this.slots.save(slot);
    return { slot };
  }

  private async toView(s: ArenaSlot, arena?: Arena) {
    const bks = await this.bookings.find({ where: { slotId: s.id } });
    const status = slotIsBusy(
      s.blocked,
      bks.map((b) => ({ status: b.status, expiresAt: b.expiresAt })),
    );
    return {
      id: s.id,
      arenaId: s.arenaId,
      date: s.date,
      startTime: s.startTime,
      endTime: s.endTime,
      blocked: s.blocked,
      status,
      arena: arena
        ? {
            id: arena.id,
            slug: arena.slug,
            type: arena.type,
            name: arena.name,
            priceCentsPerPlayer: arena.priceCentsPerPlayer,
            maxPlayers: arena.maxPlayers,
            minPlayers: arena.minPlayers,
            photoUrl: arena.photoUrl,
          }
        : undefined,
    };
  }
}
