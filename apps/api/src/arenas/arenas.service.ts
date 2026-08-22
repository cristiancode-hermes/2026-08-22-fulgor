import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Arena, Review, Booking, ArenaSlot } from '../entities/entities';
import { CreateArenaDto, UpdateArenaDto } from './arenas.dto';
import { madridDate, isLivePending } from '../common/booking-rules';

@Injectable()
export class ArenasService {
  constructor(
    @InjectRepository(Arena) private readonly arenas: Repository<Arena>,
    @InjectRepository(Review) private readonly reviews: Repository<Review>,
    @InjectRepository(Booking) private readonly bookings: Repository<Booking>,
    @InjectRepository(ArenaSlot) private readonly slots: Repository<ArenaSlot>,
  ) {}

  async freeSlotsFor(arenaId: number, date: string): Promise<number> {
    const slots = await this.slots.find({ where: { arenaId, date, blocked: false } });
    let free = 0;
    for (const s of slots) {
      const bks = await this.bookings.find({ where: { slotId: s.id } });
      const busy = bks.some(
        (b) =>
          b.status === 'confirmed' ||
          b.status === 'checked_in' ||
          b.status === 'in_play' ||
          isLivePending(b.status, b.expiresAt),
      );
      if (!busy) free += 1;
    }
    return free;
  }

  private async withAvailability(arena: Arena, today = madridDate()) {
    const freeSlotsToday = await this.freeSlotsFor(arena.id, today);
    return { ...arena, freeSlotsToday };
  }

  async findAll(q?: { type?: string; q?: string; date?: string }) {
    const qb = this.arenas.createQueryBuilder('a').where('a.active = :a', { a: true });
    if (q?.q) {
      qb.andWhere('(a.name LIKE :q OR a.description LIKE :q)', { q: `%${q.q}%` });
    }
    if (q?.type) qb.andWhere('a.type = :type', { type: q.type });
    qb.orderBy('a.sortOrder', 'ASC');
    const [items, total] = await qb.getManyAndCount();
    const today = q?.date || madridDate();
    const enriched = [];
    let freeSlotsToday = 0;
    for (const arena of items) {
      const row = await this.withAvailability(arena, today);
      freeSlotsToday += row.freeSlotsToday;
      enriched.push(row);
    }
    return { items: enriched, total, freeSlotsToday };
  }

  async featured(date?: string) {
    const items = await this.arenas.find({
      where: { active: true },
      order: { sortOrder: 'ASC' },
      take: 4,
    });
    const today = date || madridDate();
    const out = [];
    let freeSlotsToday = 0;
    for (const arena of items) {
      const row = await this.withAvailability(arena, today);
      freeSlotsToday += row.freeSlotsToday;
      out.push(row);
    }
    return { items: out, freeSlotsToday };
  }

  async findOne(id: number) {
    const arena = await this.arenas.findOne({ where: { id } });
    if (!arena) throw new NotFoundException('Arena no encontrada');
    const revs = await this.reviews.find({ where: { arenaId: id } });
    const ratingCount = revs.length;
    const ratingAvg =
      ratingCount === 0
        ? 0
        : Math.round((revs.reduce((a, r) => a + r.rating, 0) / ratingCount) * 10) / 10;
    const freeSlotsToday = await this.freeSlotsFor(id, madridDate());
    return {
      arena: { ...arena, freeSlotsToday, ratingAvg, ratingCount },
      ratingAvg,
      ratingCount,
    };
  }

  async create(dto: CreateArenaDto) {
    const exists = await this.arenas.findOne({ where: { slug: dto.slug } });
    if (exists) throw new ConflictException('Slug de arena ya existe');
    const arena = (await this.arenas.save({
      slug: dto.slug,
      name: dto.name,
      type: (dto.type as any) || 'almacen',
      description: dto.description || '',
      maxPlayers: dto.maxPlayers ?? 12,
      minPlayers: dto.minPlayers ?? 4,
      difficulty: dto.difficulty ?? 3,
      priceCentsPerPlayer: dto.priceCentsPerPlayer,
      photoUrl: dto.photoUrl ?? null,
      active: true,
      maintenance: false,
      tags: [],
      sortOrder: 99,
    } as any)) as Arena;
    return { arena };
  }

  async update(id: number, dto: UpdateArenaDto) {
    const arena = await this.arenas.findOne({ where: { id } });
    if (!arena) throw new NotFoundException('Arena no encontrada');
    if (dto.name !== undefined) arena.name = dto.name;
    if (dto.description !== undefined) arena.description = dto.description;
    if (dto.maxPlayers !== undefined) arena.maxPlayers = dto.maxPlayers;
    if (dto.priceCentsPerPlayer !== undefined) arena.priceCentsPerPlayer = dto.priceCentsPerPlayer;
    if (dto.type !== undefined) arena.type = dto.type as any;
    if (dto.active !== undefined) arena.active = dto.active;
    if (dto.maintenance !== undefined) arena.maintenance = dto.maintenance;
    if (dto.photoUrl !== undefined) arena.photoUrl = dto.photoUrl;
    await this.arenas.save(arena);
    return { arena };
  }

  async softDelete(id: number) {
    const arena = await this.arenas.findOne({ where: { id } });
    if (!arena) throw new NotFoundException('Arena no encontrada');
    arena.active = false;
    await this.arenas.save(arena);
    return { ok: true };
  }
}
