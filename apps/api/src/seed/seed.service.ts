import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import {
  Arena,
  ArenaSlot,
  Booking,
  BookingLine,
  CheckIn,
  EmailLog,
  Favorite,
  MenuItem,
  Mission,
  QueueEntry,
  Review,
  User,
} from '../entities/entities';
import {
  POINTS_PER_PLAYER,
  SLOT_HOURS,
  addDaysYmd,
  buildQrPlaceholderSvg,
  madridDate,
  parseMadridLocal,
} from '../common/booking-rules';

const P = (id: string) =>
  `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=1400`;

const ARENA_DEFS = [
  { slug: 'bosque-negro', name: 'Bosque Negro', type: 'bosque', maxPlayers: 12, minPlayers: 4, difficulty: 3, priceCentsPerPlayer: 850, photoUrl: P('1578750'), description: 'Pinos, niebla y pasarelas. El escuadrón se pierde entre troncos y sensores.', tags: ['bosque', 'sigilo'], sortOrder: 1 },
  { slug: 'hangar-12', name: 'Hangar 12', type: 'almacen', maxPlayers: 16, minPlayers: 6, difficulty: 2, priceCentsPerPlayer: 750, photoUrl: P('236705'), description: 'Estanterías, cajas y pasillos de 4 m. Ideal para asalto frontal.', tags: ['almacen', 'asalto'], sortOrder: 2 },
  { slug: 'neón-bajo', name: 'Neón Bajo', type: 'neon', maxPlayers: 10, minPlayers: 4, difficulty: 4, photoUrl: P('2387793'), priceCentsPerPlayer: 950, description: 'Callejón de luz UV. El HUD se funde con el letrero.', tags: ['neon', 'noche'], sortOrder: 3 },
  { slug: 'cripta-técnica', name: 'Cripta Técnica', type: 'subterraneo', maxPlayers: 8, minPlayers: 4, difficulty: 5, photoUrl: P('2581922'), priceCentsPerPlayer: 990, description: 'Túneles estrechos y ecos. Una bala de luz vale más aquí.', tags: ['subterraneo', 'tactica'], sortOrder: 4 },
  { slug: 'muelle-seco', name: 'Muelle Seco', type: 'muelle', maxPlayers: 14, minPlayers: 6, difficulty: 3, photoUrl: P('2226458'), priceCentsPerPlayer: 820, description: 'Contenedores y grúas. Líneas de fuego largas.', tags: ['muelle', 'cobertura'], sortOrder: 5 },
  { slug: 'forja', name: 'Forja', type: 'industria', maxPlayers: 12, minPlayers: 4, difficulty: 4, photoUrl: P('1108101'), priceCentsPerPlayer: 880, description: 'Nave industrial con pasarelas altas y calor residual.', tags: ['industria', 'altura'], sortOrder: 6 },
];

const MISSION_DEFS = [
  { slug: 'asalto', name: 'Asalto', mode: 'asalto', minutes: 8, description: 'Rompe la línea y toma el punto en menos de ocho minutos.' },
  { slug: 'captura', name: 'Captura', mode: 'captura', minutes: 10, description: 'Dos banderas. Una por escuadra. Nadie sale sin la otra.' },
  { slug: 'infeccion', name: 'Infección', mode: 'infeccion', minutes: 8, description: 'Un infectado. El resto corre. Cada baja suma al enjambre.' },
  { slug: 'escolta', name: 'Escolta', mode: 'escolta', minutes: 9, description: 'El VIP no dispara. Llévalo al hangar o córtalo en el muelle.' },
  { slug: 'apagon', name: 'Apagón', mode: 'apagon', minutes: 7, description: 'Luces fuera. Solo el ámbar del chaleco.' },
  { slug: 'asedio', name: 'Asedio', mode: 'asedio', minutes: 10, description: 'Defiende el núcleo tres oleadas. Sin recargas extra.' },
  { slug: 'duelo', name: 'Duelo', mode: 'duelo', minutes: 6, description: 'Uno contra uno en pasillo corto. Mejor de tres.' },
  { slug: 'dominacion', name: 'Dominación', mode: 'dominacion', minutes: 10, description: 'Tres nodos. Quien los pinta, gana el reloj.' },
  { slug: 'convoy', name: 'Convoy', mode: 'convoy', minutes: 9, description: 'El pack se mueve. Si se para, se pierde.' },
  { slug: 'fantasma', name: 'Fantasma', mode: 'fantasma', minutes: 8, description: 'Un cazador invisible. El resto solo oye pasos.' },
  { slug: 'rehenes', name: 'Rehenes', mode: 'rehenes', minutes: 8, description: 'Saca a tres aliados. Cada baja civil resta.' },
  { slug: 'ultima-bala', name: 'Última bala', mode: 'ultima-bala', minutes: 7, description: 'Munición limitada. Cada disparo cuenta.' },
];

const MENU_DEFS = [
  { name: 'Chaleco extra', kind: 'gear', description: 'Sensor de reserva', priceCents: 400 },
  { name: 'Pack foto', kind: 'photo', description: 'Retrato de escuadrón post-partida', priceCents: 650 },
  { name: 'Briefing táctico', kind: 'briefing', description: 'Mapa y roles 10 min antes', priceCents: 500 },
  { name: 'Agua 50cl', kind: 'snack', description: 'Fría de nevera', priceCents: 180 },
  { name: 'Barrita energética', kind: 'snack', description: 'Cacao y avena', priceCents: 220 },
  { name: 'Pack cumpleaños', kind: 'pack', description: 'Foto + briefing + 4 aguas', priceCents: 1890 },
];

function endOf(start: string): string {
  const [h, m] = start.split(':').map(Number);
  return `${String((h + 1) % 24).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

@Injectable()
export class SeedService implements OnModuleInit {
  private readonly logger = new Logger('Seed');

  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Arena) private readonly arenas: Repository<Arena>,
    @InjectRepository(ArenaSlot) private readonly slots: Repository<ArenaSlot>,
    @InjectRepository(Booking) private readonly bookings: Repository<Booking>,
    @InjectRepository(BookingLine) private readonly lines: Repository<BookingLine>,
    @InjectRepository(MenuItem) private readonly menu: Repository<MenuItem>,
    @InjectRepository(Mission) private readonly missions: Repository<Mission>,
    @InjectRepository(QueueEntry) private readonly queue: Repository<QueueEntry>,
    @InjectRepository(Review) private readonly reviews: Repository<Review>,
    @InjectRepository(EmailLog) private readonly emails: Repository<EmailLog>,
    @InjectRepository(Favorite) private readonly favs: Repository<Favorite>,
    @InjectRepository(CheckIn) private readonly checkIns: Repository<CheckIn>,
  ) {}

  async onModuleInit() {
    if ((await this.users.count()) > 0) {
      this.logger.log('DB already seeded — skip');
      return;
    }
    await this.seed();
  }

  async seed() {
    this.logger.log('Seeding Fulgor…');
    const hash = await bcrypt.hash('demo1234', 10);

    const demo = (await this.users.save({
      username: 'demo',
      email: 'demo@fulgor.dev',
      passwordHash: hash,
      role: 'player',
      points: 0,
    } as any)) as User;

    const staff = (await this.users.save({
      username: 'staff',
      email: 'staff@fulgor.dev',
      passwordHash: hash,
      role: 'staff',
      points: 0,
    } as any)) as User;

    const arenas: Arena[] = [];
    for (const def of ARENA_DEFS) {
      arenas.push((await this.arenas.save({ ...def, active: true, maintenance: false } as any)) as Arena);
    }

    const menuItems: MenuItem[] = [];
    for (const def of MENU_DEFS) {
      menuItems.push((await this.menu.save({ ...def, active: true } as any)) as MenuItem);
    }

    const missions: Mission[] = [];
    for (const def of MISSION_DEFS) {
      missions.push((await this.missions.save({ ...def, photoUrl: null, active: true } as any)) as Mission);
    }

    const today = madridDate();
    const times = SLOT_HOURS();
    const slotsByKey = new Map<string, ArenaSlot>();
    for (const arena of arenas) {
      for (let d = -1; d < 8; d++) {
        const date = addDaysYmd(today, d);
        for (const startTime of times) {
          const slot = (await this.slots.save({
            arenaId: arena.id,
            date,
            startTime,
            endTime: endOf(startTime),
            blocked: false,
          } as any)) as ArenaSlot;
          slotsByKey.set(`${arena.id}|${date}|${startTime}`, slot);
        }
      }
    }

    const chaleco = menuItems[0];
    const foto = menuItems[1];

    const completedSlot = slotsByKey.get(`${arenas[0].id}|${addDaysYmd(today, -1)}|18:00`);
    const completed = await this.makeBooking({
      user: demo,
      slot: completedSlot!,
      partySize: 8,
      status: 'completed',
      extraHour: false,
      addons: [chaleco],
      missionIds: [missions[0].id, missions[1].id],
      code: 'FLG-SEED01',
    });
    completed.completedAt = new Date();
    await this.bookings.save(completed);

    const playSlot = slotsByKey.get(`${arenas[2].id}|${today}|18:00`);
    const inPlay = await this.makeBooking({
      user: demo,
      slot: playSlot!,
      partySize: 6,
      status: 'in_play',
      extraHour: false,
      addons: [foto],
      missionIds: [missions[2].id, missions[4].id, missions[7].id],
      code: 'FLG-LIVE01',
    });
    const q0 = await this.queue.find({ where: { bookingId: inPlay.id }, order: { position: 'ASC' } });
    if (q0[0]) {
      q0[0].status = 'playing';
      await this.queue.save(q0[0]);
    }
    await this.checkIns.save({
      bookingId: inPlay.id,
      staffUserId: staff.id,
      code: 'FLG-LIVE01',
      scannedAt: new Date(),
    } as any);

    const confSlot = slotsByKey.get(`${arenas[1].id}|${addDaysYmd(today, 2)}|20:00`);
    await this.makeBooking({
      user: demo,
      slot: confSlot!,
      partySize: 10,
      status: 'confirmed',
      extraHour: true,
      addons: [chaleco, foto],
      missionIds: [missions[5].id, missions[8].id],
      code: 'FLG-CONF01',
    });

    const pendSlot = slotsByKey.get(`${arenas[3].id}|${addDaysYmd(today, 1)}|21:00`);
    const pending = await this.makeBooking({
      user: demo,
      slot: pendSlot!,
      partySize: 4,
      status: 'pending',
      extraHour: false,
      addons: [],
      missionIds: [missions[3].id],
    });
    pending.expiresAt = new Date(Date.now() + 12 * 60 * 1000);
    await this.bookings.save(pending);

    const expSlot = slotsByKey.get(`${arenas[4].id}|${today}|16:00`);
    const expired = await this.makeBooking({
      user: demo,
      slot: expSlot!,
      partySize: 6,
      status: 'expired',
      extraHour: false,
      addons: [],
      missionIds: [],
    });
    expired.expiresAt = null;
    await this.bookings.save(expired);

    await this.reviews.save({
      userId: demo.id,
      arenaId: arenas[0].id,
      rating: 5,
      comment: 'Bosque Negro se come la luz. Volveremos.',
    } as any);

    await this.favs.save({ userId: demo.id, arenaId: arenas[2].id, missionId: null } as any);
    await this.favs.save({ userId: demo.id, arenaId: null, missionId: missions[2].id } as any);

    const completedRows = await this.bookings.find({ where: { userId: demo.id, status: 'completed' } });
    demo.points = completedRows.reduce((a, b) => a + POINTS_PER_PLAYER * b.partySize, 0);
    await this.users.save(demo);

    this.logger.log(`Seed OK — demo points=${demo.points} (derived)`);
  }

  private async makeBooking(opts: {
    user: User;
    slot: ArenaSlot;
    partySize: number;
    status: Booking['status'];
    extraHour: boolean;
    addons: MenuItem[];
    missionIds: number[];
    code?: string;
  }): Promise<Booking> {
    const arena = await this.arenas.findOne({ where: { id: opts.slot.arenaId } });
    const lineDefs: {
      kind: 'base' | 'addon' | 'extra_hour';
      label: string;
      qty: number;
      unitPriceCents: number;
      menuItemId: number | null;
    }[] = [
      {
        kind: 'base',
        label: `${arena!.name} × ${opts.partySize}`,
        qty: opts.partySize,
        unitPriceCents: arena!.priceCentsPerPlayer,
        menuItemId: null,
      },
    ];
    if (opts.extraHour) {
      lineDefs.push({
        kind: 'extra_hour' as const,
        label: 'Hora extra',
        qty: opts.partySize,
        unitPriceCents: arena!.priceCentsPerPlayer,
        menuItemId: null,
      });
    }
    for (const a of opts.addons) {
      lineDefs.push({
        kind: 'addon' as const,
        label: a.name,
        qty: 1,
        unitPriceCents: a.priceCents,
        menuItemId: a.id,
      });
    }
    const totalCents = lineDefs.reduce((s, l) => s + l.qty * l.unitPriceCents, 0);
    const now = new Date();
    const code = opts.code || null;
    const booking = (await this.bookings.save({
      userId: opts.user.id,
      slotId: opts.slot.id,
      partySize: opts.partySize,
      status: opts.status,
      totalCents,
      expiresAt: opts.status === 'pending' ? new Date(Date.now() + 15 * 60 * 1000) : null,
      qrToken: code ? randomBytes(16).toString('hex') : null,
      code,
      extraHour: opts.extraHour,
      confirmedAt: ['confirmed', 'checked_in', 'in_play', 'completed'].includes(opts.status) ? now : null,
      startsAt: parseMadridLocal(opts.slot.date, opts.slot.startTime),
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

    let pos = 1;
    for (const mid of opts.missionIds) {
      await this.queue.save({
        bookingId: booking.id,
        missionId: mid,
        position: pos++,
        status: 'queued',
      } as any);
    }

    if (code && opts.user) {
      await this.emails.save({
        userId: opts.user.id,
        bookingId: booking.id,
        toEmail: opts.user.email,
        subject: `Fulgor — ${code}`,
        body: `Ticket ${code}. QR listo en la app.`,
        kind: 'confirmation',
      } as any);
    }

    void buildQrPlaceholderSvg(booking.qrToken || 'seed', code || 'SEED');
    return booking;
  }
}
