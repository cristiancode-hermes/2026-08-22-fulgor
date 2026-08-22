import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { randomBytes } from 'crypto';
import {
  Arena,
  ArenaSlot,
  Booking,
  BookingLine,
  CheckIn,
  EmailLog,
  MenuItem,
  Mission,
  QueueEntry,
  User,
} from '../entities/entities';
import { Mutex } from '../common/mutex';
import {
  CANCEL_HOURS,
  HOLD_MINUTES,
  POINTS_PER_PLAYER,
  applyQueueOrder,
  buildQrPlaceholderSvg,
  canCancelByPolicy,
  canReorderQueue,
  canTransition,
  holdConflict,
  parseMadridLocal,
  sumLines,
  validatePartySize,
} from '../common/booking-rules';
import { HoldBookingDto, PatchBookingDto } from './bookings.dto';

function conflict(code: string, message: string) {
  return new HttpException({ statusCode: 409, code, message }, HttpStatus.CONFLICT);
}

@Injectable()
export class BookingsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('BookingSweeper');
  private readonly mutex = new Mutex();
  private sweeper: ReturnType<typeof setInterval> | null = null;

  constructor(
    @InjectRepository(Booking) private readonly bookings: Repository<Booking>,
    @InjectRepository(BookingLine) private readonly lines: Repository<BookingLine>,
    @InjectRepository(ArenaSlot) private readonly slots: Repository<ArenaSlot>,
    @InjectRepository(Arena) private readonly arenas: Repository<Arena>,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(MenuItem) private readonly menu: Repository<MenuItem>,
    @InjectRepository(EmailLog) private readonly emails: Repository<EmailLog>,
    @InjectRepository(QueueEntry) private readonly queue: Repository<QueueEntry>,
    @InjectRepository(Mission) private readonly missions: Repository<Mission>,
    @InjectRepository(CheckIn) private readonly checkIns: Repository<CheckIn>,
    private readonly dataSource: DataSource,
  ) {}

  onModuleInit() {
    this.sweeper = setInterval(() => {
      void this.expireStale().then((n) => {
        if (n > 0) this.logger.log(`${n} booking(s) pending vencido(s)`);
      });
    }, 30_000);
    this.sweeper.unref?.();
  }

  onModuleDestroy() {
    if (this.sweeper) clearInterval(this.sweeper);
  }

  async expireStale(): Promise<number> {
    const now = new Date();
    const pendings = await this.bookings.find({ where: { status: 'pending' } });
    let n = 0;
    for (const b of pendings) {
      if (b.expiresAt && new Date(b.expiresAt) < now) {
        b.status = 'expired';
        b.expiresAt = null;
        b.updatedAt = new Date();
        await this.bookings.save(b);
        n += 1;
      }
    }
    return n;
  }

  async hold(userId: number, dto: HoldBookingDto) {
    const slotId = dto.slotId;
    if (!slotId) throw new BadRequestException('slotId requerido');
    return this.mutex.run(async () => {
      await this.expireStale();
      const supportsLock = this.dataSource.options.type !== 'better-sqlite3';
      const qb = this.slots.createQueryBuilder('s').where('s.id = :id', { id: slotId });
      const slot = supportsLock
        ? await qb.setLock('pessimistic_write').getOne()
        : await qb.getOne();
      if (!slot) throw new NotFoundException('Franja no encontrada');
      if (slot.blocked) throw conflict('SLOT_TAKEN', 'La franja está bloqueada');

      const arena = await this.arenas.findOne({ where: { id: slot.arenaId, active: true } });
      if (!arena) throw new NotFoundException('Arena no disponible');

      const partyCheck = validatePartySize(dto.partySize, arena.maxPlayers, arena.minPlayers || 4);
      if (!partyCheck.ok) {
        throw new HttpException(
          {
            statusCode: 400,
            code: 'INVALID_PARTY_SIZE',
            message: `partySize debe ser ${arena.minPlayers || 4}–${arena.maxPlayers}`,
          },
          HttpStatus.BAD_REQUEST,
        );
      }

      const existingOnSlot = await this.bookings.find({ where: { slotId: slot.id } });
      const clash = holdConflict(existingOnSlot, userId, slot.id);
      if (clash === 'ALREADY_HELD') throw conflict('ALREADY_HELD', 'Ya tienes esta franja.');
      if (clash === 'SLOT_TAKEN') throw conflict('SLOT_TAKEN', 'Esta arena ya está cogida');

      const extraHour = !!dto.extraHour;
      const addonIds = dto.addonIds?.length ? dto.addonIds : dto.menuItemIds;
      const lineDefs = await this.buildLines(arena, slot, dto.partySize, extraHour, addonIds);
      const totalCents = sumLines(lineDefs);
      const expiresAt = new Date(Date.now() + HOLD_MINUTES * 60 * 1000);
      const now = new Date();
      const startsAt = parseMadridLocal(slot.date, slot.startTime);

      const booking = (await this.bookings.save({
        userId,
        slotId: slot.id,
        partySize: dto.partySize,
        status: 'pending',
        totalCents,
        expiresAt,
        qrToken: null,
        code: null,
        extraHour,
        startsAt,
        createdAt: now,
        updatedAt: now,
      } as any)) as Booking;

      for (const ld of lineDefs) {
        await this.lines.save({
          bookingId: booking.id,
          kind: ld.kind,
          label: ld.label,
          qty: ld.qty,
          unitPriceCents: ld.unitPriceCents,
          amountCents: ld.qty * ld.unitPriceCents,
          menuItemId: ld.menuItemId,
        } as any);
      }

      if (dto.missionIds?.length) {
        await this.persistQueue(booking.id, dto.missionIds, false);
      }

      const view = await this.loadView(booking.id);
      return {
        booking: view,
        expiresAt: expiresAt.toISOString(),
        lines: view.lines,
        queue: await this.queueView(booking.id),
        totalCents,
      };
    });
  }

  async patchHold(userId: number, id: number, dto: PatchBookingDto) {
    return this.mutex.run(async () => {
      const b = await this.bookings.findOne({
        where: { id },
        relations: { slot: { arena: true } },
      });
      if (!b) throw new NotFoundException('Reserva no encontrada');
      if (b.userId !== userId) throw new ForbiddenException('No es tu reserva');
      if (b.status !== 'pending') throw new ConflictException('Solo se edita un hold pendiente');
      const arena = b.slot?.arena;
      if (!arena) throw new NotFoundException('Arena no disponible');
      const partySize = dto.partySize ?? b.partySize;
      const extraHour = dto.extraHour ?? b.extraHour;
      const check = validatePartySize(partySize, arena.maxPlayers, arena.minPlayers || 4);
      if (!check.ok) throw new BadRequestException('partySize inválido');
      await this.lines.delete({ bookingId: id });
      const lineDefs = await this.buildLines(arena, b.slot!, partySize, extraHour, dto.addonIds);
      const totalCents = sumLines(lineDefs);
      for (const ld of lineDefs) {
        await this.lines.save({
          bookingId: id,
          kind: ld.kind,
          label: ld.label,
          qty: ld.qty,
          unitPriceCents: ld.unitPriceCents,
          amountCents: ld.qty * ld.unitPriceCents,
          menuItemId: ld.menuItemId,
        } as any);
      }
      b.partySize = partySize;
      b.extraHour = extraHour;
      b.totalCents = totalCents;
      b.updatedAt = new Date();
      await this.bookings.save(b);
      const view = await this.loadView(id);
      return { booking: view, lines: view.lines, totalCents };
    });
  }

  async confirm(userId: number, id: number) {
    const pre = await this.bookings.findOne({ where: { id } });
    if (!pre) throw new NotFoundException('Reserva no encontrada');
    if (pre.userId !== userId) throw new ForbiddenException('No es tu reserva');
    if (pre.status === 'pending' && pre.expiresAt && new Date(pre.expiresAt) < new Date()) {
      await this.dataSource.transaction(async (m) => {
        const repo = m.getRepository(Booking);
        const b = await repo.findOne({ where: { id } });
        if (b && b.status === 'pending') {
          b.status = 'expired';
          b.expiresAt = null;
          b.updatedAt = new Date();
          await repo.save(b);
        }
      });
      throw conflict('HOLD_EXPIRED', 'La retención expiró — elige otra franja');
    }

    return this.mutex.run(async () => {
      const b = await this.bookings.findOne({
        where: { id },
        relations: { lines: true, slot: { arena: true }, user: true },
      });
      if (!b) throw new NotFoundException('Reserva no encontrada');
      if (b.userId !== userId) throw new ForbiddenException('No es tu reserva');
      if (!canTransition(b.status, 'confirmed')) {
        throw new ConflictException(`No se puede confirmar desde ${b.status}`);
      }
      b.status = 'confirmed';
      b.expiresAt = null;
      b.confirmedAt = new Date();
      b.code = await this.generateCode();
      b.qrToken = randomBytes(16).toString('hex');
      b.updatedAt = new Date();
      await this.bookings.save(b);

      const user = await this.users.findOne({ where: { id: userId } });
      if (user) {
        const subject = `Fulgor — Partida confirmada ${b.code}`;
        const body = `Hola ${user.username},\n\nTu partida está confirmada.\nCódigo: ${b.code}\nFranja: ${b.slot?.date} ${b.slot?.startTime}-${b.slot?.endTime}\nArena: ${b.slot?.arena?.name || ''}\n\nPresenta el QR en puerta. — Fulgor`;
        await this.emails.save({
          userId,
          bookingId: b.id,
          toEmail: user.email,
          subject,
          body,
          kind: 'confirmation',
        } as any);
      }
      const booking = await this.loadView(b.id);
      const qrSvg = buildQrPlaceholderSvg(b.qrToken!, b.code!);
      return { booking, code: b.code, qrSvg };
    });
  }

  async listMine(userId: number, opts?: { status?: string }) {
    await this.expireStale();
    const rows = await this.bookings.find({
      where: { userId },
      relations: { lines: true, slot: { arena: true } },
      order: { createdAt: 'DESC' },
    });
    let items = rows.map((b) => this.listView(b));
    if (opts?.status) items = items.filter((i) => i.status === opts.status);
    return { items, total: items.length };
  }

  async detail(userId: number, id: number, role: string) {
    await this.expireStale();
    const b = await this.bookings.findOne({
      where: { id },
      relations: { lines: true, slot: { arena: true }, user: true, checkIn: true },
    });
    if (!b) throw new NotFoundException('Reserva no encontrada');
    if (b.userId !== userId && role !== 'staff' && role !== 'admin') {
      throw new ForbiddenException('No es tu reserva');
    }
    const booking = this.detailView(b);
    const qrSvg = b.qrToken && b.code ? buildQrPlaceholderSvg(b.qrToken, b.code) : null;
    const queue = await this.queueView(id);
    return { booking, lines: booking.lines, queue, qrSvg, checkIn: b.checkIn || null };
  }

  async setQueue(userId: number, id: number, missionIds: number[]) {
    const b = await this.bookings.findOne({ where: { id } });
    if (!b) throw new NotFoundException('Reserva no encontrada');
    if (b.userId !== userId) throw new ForbiddenException('No es tu reserva');
    if (b.status === 'in_play') {
      const playing = await this.queue.findOne({ where: { bookingId: id, status: 'playing' } });
      if (playing) throw new ConflictException('No se reemplaza la cola con una misión en juego');
    }
    if (!['pending', 'confirmed', 'checked_in', 'in_play'].includes(b.status)) {
      throw new ConflictException('La cola solo se edita en reservas vivas');
    }
    await this.persistQueue(id, missionIds, b.status === 'in_play');
    return { queue: await this.queueView(id) };
  }

  async reorderQueue(userId: number, id: number, orderedEntryIds: number[]) {
    const b = await this.bookings.findOne({ where: { id } });
    if (!b) throw new NotFoundException('Reserva no encontrada');
    if (b.userId !== userId) throw new ForbiddenException('No es tu reserva');
    const entries = await this.queue.find({ where: { bookingId: id } });
    const check = canReorderQueue(entries, orderedEntryIds);
    if (!check.ok) {
      throw new BadRequestException(check.code === 'PLAYING_MISSING' ? 'No se puede mover now-playing' : 'Cola inválida');
    }
    const queuedIds = orderedEntryIds.filter(
      (eid) => entries.find((e) => e.id === eid)?.status === 'queued',
    );
    const next = applyQueueOrder(entries, queuedIds);
    for (const row of next) {
      const e = entries.find((x) => x.id === row.id);
      if (e) {
        e.position = row.position;
        await this.queue.save(e);
      }
    }
    return { queue: await this.queueView(id) };
  }

  async advanceQueue(userId: number, id: number, entryId: number) {
    const b = await this.bookings.findOne({ where: { id } });
    if (!b) throw new NotFoundException('Reserva no encontrada');
    if (b.userId !== userId) throw new ForbiddenException('No es tu reserva');
    const current = await this.queue.findOne({ where: { id: entryId, bookingId: id } });
    if (!current) throw new NotFoundException('Entrada no encontrada');
    if (current.status !== 'playing') throw new BadRequestException('Solo se avanza la now-playing');
    current.status = 'done';
    await this.queue.save(current);
    const next = await this.queue.findOne({
      where: { bookingId: id, status: 'queued' },
      order: { position: 'ASC' },
    });
    if (next) {
      next.status = 'playing';
      await this.queue.save(next);
    }
    return { queue: await this.queueView(id) };
  }

  async removeQueueEntry(userId: number, id: number, entryId: number) {
    const b = await this.bookings.findOne({ where: { id } });
    if (!b) throw new NotFoundException('Reserva no encontrada');
    if (b.userId !== userId) throw new ForbiddenException('No es tu reserva');
    const e = await this.queue.findOne({ where: { id: entryId, bookingId: id } });
    if (!e) throw new NotFoundException('Entrada no encontrada');
    if (e.status === 'playing') {
      throw new HttpException(
        { statusCode: 400, code: 'PLAYING_LOCKED', message: 'No se puede quitar la misión en juego' },
        HttpStatus.BAD_REQUEST,
      );
    }
    await this.queue.delete({ id: entryId, bookingId: id });
    return { queue: await this.queueView(id) };
  }

  async cancel(userId: number, id: number) {
    return this.mutex.run(async () => {
      const b = await this.bookings.findOne({
        where: { id },
        relations: { lines: true, slot: { arena: true } },
      });
      if (!b) throw new NotFoundException('Reserva no encontrada');
      if (b.userId !== userId) throw new ForbiddenException('No es tu reserva');
      if (!canTransition(b.status, 'cancelled')) {
        throw new ConflictException(`No se puede cancelar desde ${b.status}`);
      }
      if (['confirmed', 'checked_in'].includes(b.status) && b.slot) {
        const start = parseMadridLocal(b.slot.date, b.slot.startTime);
        const hours = (start.getTime() - Date.now()) / 3_600_000;
        if (!canCancelByPolicy(hours, CANCEL_HOURS)) {
          throw new HttpException(
            {
              statusCode: 400,
              code: 'CANCEL_TOO_LATE',
              message: `Cancelación solo hasta ${CANCEL_HOURS}h antes de la franja`,
            },
            HttpStatus.BAD_REQUEST,
          );
        }
      }
      b.status = 'cancelled';
      b.expiresAt = null;
      b.cancelledAt = new Date();
      b.updatedAt = new Date();
      await this.bookings.save(b);
      const user = await this.users.findOne({ where: { id: userId } });
      if (user) {
        await this.emails.save({
          userId,
          bookingId: b.id,
          toEmail: user.email,
          subject: `Fulgor — Reserva cancelada`,
          body: `Tu partida ${b.code || '#' + b.id} ha sido cancelada.`,
          kind: 'cancellation',
        } as any);
      }
      return { booking: await this.loadView(id) };
    });
  }

  async complete(staffUserId: number, id: number) {
    const staff = await this.users.findOne({ where: { id: staffUserId } });
    if (!staff || (staff.role !== 'staff' && staff.role !== 'admin')) {
      throw new ForbiddenException();
    }
    const b = await this.bookings.findOne({ where: { id } });
    if (!b) throw new NotFoundException('Reserva no encontrada');
    if (!canTransition(b.status, 'completed')) {
      throw new ConflictException(`No se puede completar desde ${b.status}`);
    }
    b.status = 'completed';
    b.completedAt = new Date();
    b.updatedAt = new Date();
    await this.bookings.save(b);
    const pointsAwarded = POINTS_PER_PLAYER * b.partySize;
    const completed = await this.bookings.find({
      where: { userId: b.userId, status: 'completed' },
    });
    const user = await this.users.findOne({ where: { id: b.userId } });
    if (user) {
      user.points = completed.reduce((acc, row) => acc + POINTS_PER_PLAYER * row.partySize, 0);
      await this.users.save(user);
    }
    return { booking: await this.loadView(id), pointsAwarded };
  }

  async checkIn(staffUserId: number, code: string) {
    const staff = await this.users.findOne({ where: { id: staffUserId } });
    if (!staff || (staff.role !== 'staff' && staff.role !== 'admin')) {
      throw new ForbiddenException();
    }
    const normalized = String(code || '').trim().toUpperCase();
    if (!normalized) throw new BadRequestException('Código requerido');
    return this.mutex.run(async () => {
      const b = await this.bookings.findOne({
        where: { code: normalized },
        relations: { checkIn: true, slot: { arena: true } },
      });
      if (!b) throw new NotFoundException('Código no encontrado');
      const existing = await this.checkIns.findOne({ where: { bookingId: b.id } });
      if (existing || b.status === 'checked_in' || b.status === 'in_play' || b.status === 'completed') {
        throw conflict('ALREADY_CHECKED_IN', 'Este ticket ya pasó por puerta');
      }
      if (b.status !== 'confirmed') {
        throw new ConflictException(`No se puede hacer check-in desde ${b.status}`);
      }
      const ci = (await this.checkIns.save({
        bookingId: b.id,
        staffUserId,
        code: normalized,
        scannedAt: new Date(),
      } as any)) as CheckIn;
      // update() not save(entity): OneToOne inverse would NULL check_ins.bookingId
      await this.bookings.update(b.id, { status: 'in_play', updatedAt: new Date() });
      const first = await this.queue.findOne({
        where: { bookingId: b.id, status: 'queued' },
        order: { position: 'ASC' },
      });
      if (first) {
        first.status = 'playing';
        await this.queue.save(first);
      }
      return {
        booking: await this.loadView(b.id),
        queue: await this.queueView(b.id),
        checkIn: ci,
      };
    });
  }

  async listEmails(userId: number) {
    const items = await this.emails.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
    return { items };
  }

  async listCheckIns(date?: string) {
    const rows = await this.checkIns.find({
      relations: { booking: { slot: { arena: true } }, staff: true },
      order: { scannedAt: 'DESC' },
    });
    const items = date
      ? rows.filter((r) => r.booking?.slot?.date === date)
      : rows;
    return { items };
  }

  private isLive(b: Booking): boolean {
    if (b.status === 'confirmed' || b.status === 'checked_in' || b.status === 'in_play') return true;
    if (b.status === 'pending') {
      return !b.expiresAt || new Date(b.expiresAt) > new Date();
    }
    return false;
  }

  private async buildLines(
    arena: Arena,
    slot: ArenaSlot,
    partySize: number,
    extraHour: boolean,
    addonIds?: number[],
  ) {
    const lineDefs: {
      kind: 'base' | 'addon' | 'extra_hour';
      label: string;
      qty: number;
      unitPriceCents: number;
      menuItemId: number | null;
    }[] = [];
    lineDefs.push({
      kind: 'base',
      label: `${arena.name} × ${partySize} · ${slot.startTime}`,
      qty: partySize,
      unitPriceCents: arena.priceCentsPerPlayer,
      menuItemId: null,
    });
    if (extraHour) {
      lineDefs.push({
        kind: 'extra_hour',
        label: 'Hora extra',
        qty: partySize,
        unitPriceCents: arena.priceCentsPerPlayer,
        menuItemId: null,
      });
    }
    if (addonIds?.length) {
      const items = await this.menu.find({ where: { id: In(addonIds), active: true } });
      for (const item of items) {
        lineDefs.push({
          kind: 'addon',
          label: item.name,
          qty: 1,
          unitPriceCents: item.priceCents,
          menuItemId: item.id,
        });
      }
    }
    return lineDefs;
  }

  private async persistQueue(bookingId: number, missionIds: number[], keepPlaying: boolean) {
    const playing = keepPlaying
      ? await this.queue.findOne({ where: { bookingId, status: 'playing' } })
      : null;
    await this.queue.delete({ bookingId });
    const unique = [...new Set(missionIds.map((n) => Number(n)).filter((n) => Number.isFinite(n)))];
    let pos = 1;
    if (playing) {
      await this.queue.save({
        bookingId,
        missionId: playing.missionId,
        position: pos++,
        status: 'playing',
      } as any);
    }
    for (const missionId of unique) {
      if (playing && playing.missionId === missionId) continue;
      const mission = await this.missions.findOne({ where: { id: missionId, active: true } });
      if (!mission) continue;
      await this.queue.save({
        bookingId,
        missionId: mission.id,
        position: pos++,
        status: 'queued',
      } as any);
    }
  }

  private async queueView(bookingId: number) {
    const rows = await this.queue.find({
      where: { bookingId },
      relations: { mission: true },
      order: { position: 'ASC' },
    });
    return rows.map((e) => ({
      id: e.id,
      bookingId: e.bookingId,
      missionId: e.missionId,
      position: e.position,
      status: e.status,
      mission: e.mission
        ? { id: e.mission.id, slug: e.mission.slug, name: e.mission.name, mode: e.mission.mode, minutes: e.mission.minutes }
        : null,
    }));
  }

  private async loadView(id: number) {
    const b = await this.bookings.findOne({
      where: { id },
      relations: { lines: true, slot: { arena: true } },
    });
    if (!b) throw new NotFoundException();
    return this.detailView(b);
  }

  listView(b: Booking) {
    const linesSum = (b.lines || []).reduce((s, l) => s + (l.amountCents ?? l.qty * l.unitPriceCents), 0);
    return {
      id: b.id,
      status: b.status,
      partySize: b.partySize,
      totalCents: linesSum,
      linesTotalCents: linesSum,
      code: b.code,
      extraHour: b.extraHour,
      expiresAt: b.expiresAt ? new Date(b.expiresAt).toISOString() : null,
      startsAt: b.startsAt ? new Date(b.startsAt).toISOString() : null,
      createdAt: b.createdAt ? new Date(b.createdAt).toISOString() : null,
      updatedAt: b.updatedAt ? new Date(b.updatedAt).toISOString() : null,
      slot: b.slot
        ? {
            id: b.slot.id,
            date: b.slot.date,
            startTime: b.slot.startTime,
            endTime: b.slot.endTime,
            arenaId: b.slot.arenaId,
            arena: b.slot.arena
              ? {
                  id: b.slot.arena.id,
                  slug: b.slot.arena.slug,
                  type: b.slot.arena.type,
                  name: b.slot.arena.name,
                  photoUrl: b.slot.arena.photoUrl,
                }
              : null,
          }
        : null,
    };
  }

  detailView(b: Booking) {
    const base = this.listView(b);
    return {
      ...base,
      userId: b.userId,
      slotId: b.slotId,
      qrToken: b.qrToken,
      lines: (b.lines || []).map((l) => ({
        id: l.id,
        kind: l.kind,
        label: l.label,
        qty: l.qty,
        unitPriceCents: l.unitPriceCents,
        amountCents: l.amountCents ?? l.qty * l.unitPriceCents,
        subtotalCents: l.amountCents ?? l.qty * l.unitPriceCents,
        menuItemId: l.menuItemId,
      })),
      qrSvg: b.qrToken && b.code ? buildQrPlaceholderSvg(b.qrToken, b.code) : null,
    };
  }

  private async generateCode(): Promise<string> {
    for (let i = 0; i < 8; i++) {
      const code = 'FLG-' + randomBytes(3).toString('hex').toUpperCase();
      const exists = await this.bookings.findOne({ where: { code } });
      if (!exists) return code;
    }
    return 'FLG-' + Date.now().toString(36).toUpperCase();
  }
}
