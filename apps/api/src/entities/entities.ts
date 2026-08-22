import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

export type UserRole = 'player' | 'staff' | 'admin';
export type BookingStatus =
  | 'pending'
  | 'confirmed'
  | 'checked_in'
  | 'in_play'
  | 'completed'
  | 'cancelled'
  | 'expired';
export type BookingLineKind = 'base' | 'addon' | 'extra_hour';
export type ArenaType =
  | 'bosque'
  | 'almacen'
  | 'neon'
  | 'subterraneo'
  | 'muelle'
  | 'industria';
export type QueueStatus = 'queued' | 'playing' | 'done';

export const LIVE_STATUSES: BookingStatus[] = [
  'pending',
  'confirmed',
  'checked_in',
  'in_play',
];

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 40, unique: true })
  username: string;

  @Column({ type: 'varchar', length: 120, unique: true })
  email: string;

  @Column({ type: 'varchar', length: 200 })
  passwordHash: string;

  @Column({ type: 'varchar', length: 16, default: 'player' })
  role: UserRole;

  @Column({ type: 'int', default: 0 })
  points: number;

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @OneToMany(() => Booking, (b: Booking) => b.user)
  bookings?: Booking[];
}

@Entity('arenas')
export class Arena {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 64, unique: true })
  slug: string;

  @Column({ type: 'varchar', length: 80 })
  name: string;

  @Column({ type: 'varchar', length: 24, default: 'almacen' })
  type: ArenaType;

  @Column({ type: 'varchar', length: 2000, default: '' })
  description: string;

  @Column({ type: 'int', default: 16 })
  maxPlayers: number;

  @Column({ type: 'int', default: 4 })
  minPlayers: number;

  @Column({ type: 'int', default: 3 })
  difficulty: number;

  @Column({ type: 'int' })
  priceCentsPerPlayer: number;

  @Column({ type: 'varchar', length: 400, nullable: true })
  photoUrl: string | null;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  @Column({ type: 'boolean', default: false })
  maintenance: boolean;

  @Column({ type: 'simple-json', default: '[]' })
  tags: string[];

  @Column({ type: 'int', default: 0 })
  sortOrder: number;

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @OneToMany(() => ArenaSlot, (s: ArenaSlot) => s.arena)
  slots?: ArenaSlot[];
}

@Entity('arena_slots')
@Unique(['arenaId', 'date', 'startTime'])
export class ArenaSlot {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  arenaId: number;

  @ManyToOne(() => Arena, (a: Arena) => a.slots, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'arenaId' })
  arena?: Arena;

  @Column({ type: 'varchar', length: 10 })
  date: string;

  @Column({ type: 'varchar', length: 5 })
  startTime: string;

  @Column({ type: 'varchar', length: 5 })
  endTime: string;

  @Column({ type: 'boolean', default: false })
  blocked: boolean;

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @OneToMany(() => Booking, (b: Booking) => b.slot)
  bookings?: Booking[];
}

@Entity('bookings')
export class Booking {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  userId: number;

  @ManyToOne(() => User, (u: User) => u.bookings)
  @JoinColumn({ name: 'userId' })
  user?: User;

  @Column({ type: 'int' })
  slotId: number;

  @ManyToOne(() => ArenaSlot, (s: ArenaSlot) => s.bookings)
  @JoinColumn({ name: 'slotId' })
  slot?: ArenaSlot;

  @Column({ type: 'int' })
  partySize: number;

  @Column({ type: 'varchar', length: 16, default: 'pending' })
  status: BookingStatus;

  @Column({ type: 'int', default: 0 })
  totalCents: number;

  @Column({ type: 'datetime', nullable: true })
  expiresAt: Date | null;

  @Column({ type: 'varchar', length: 64, nullable: true, unique: true })
  qrToken: string | null;

  @Column({ type: 'varchar', length: 24, nullable: true, unique: true })
  code: string | null;

  @Column({ type: 'boolean', default: false })
  extraHour: boolean;

  @Column({ type: 'datetime', nullable: true })
  confirmedAt: Date | null;

  @Column({ type: 'datetime', nullable: true })
  startsAt: Date | null;

  @Column({ type: 'datetime', nullable: true })
  completedAt: Date | null;

  @Column({ type: 'datetime', nullable: true })
  cancelledAt: Date | null;

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  updatedAt: Date;

  @OneToMany(() => BookingLine, (l: BookingLine) => l.booking)
  lines?: BookingLine[];

  @OneToMany(() => QueueEntry, (q: QueueEntry) => q.booking)
  queue?: QueueEntry[];

  @OneToOne(() => CheckIn, (c: CheckIn) => c.booking)
  checkIn?: CheckIn | null;
}

@Entity('booking_lines')
export class BookingLine {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  bookingId: number;

  @ManyToOne(() => Booking, (b: Booking) => b.lines, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'bookingId' })
  booking?: Booking;

  @Column({ type: 'varchar', length: 16 })
  kind: BookingLineKind;

  @Column({ type: 'varchar', length: 120 })
  label: string;

  @Column({ type: 'int' })
  qty: number;

  @Column({ type: 'int' })
  unitPriceCents: number;

  @Column({ type: 'int' })
  amountCents: number;

  @Column({ type: 'int', nullable: true })
  menuItemId: number | null;
}

@Entity('menu_items')
export class MenuItem {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 80 })
  name: string;

  @Column({ type: 'varchar', length: 16, default: 'gear' })
  kind: string;

  @Column({ type: 'varchar', length: 255, default: '' })
  description: string;

  @Column({ type: 'int' })
  priceCents: number;

  @Column({ type: 'boolean', default: true })
  active: boolean;
}

@Entity('missions')
export class Mission {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 64, unique: true })
  slug: string;

  @Column({ type: 'varchar', length: 80 })
  name: string;

  @Column({ type: 'varchar', length: 24 })
  mode: string;

  @Column({ type: 'int', default: 8 })
  minutes: number;

  @Column({ type: 'varchar', length: 2000, default: '' })
  description: string;

  @Column({ type: 'varchar', length: 400, nullable: true })
  photoUrl: string | null;

  @Column({ type: 'boolean', default: true })
  active: boolean;
}

@Entity('queue_entries')
@Unique(['bookingId', 'missionId'])
export class QueueEntry {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  bookingId: number;

  @ManyToOne(() => Booking, (b: Booking) => b.queue, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'bookingId' })
  booking?: Booking;

  @Column({ type: 'int' })
  missionId: number;

  @ManyToOne(() => Mission)
  @JoinColumn({ name: 'missionId' })
  mission?: Mission;

  @Column({ type: 'int' })
  position: number;

  @Column({ type: 'varchar', length: 12, default: 'queued' })
  status: QueueStatus;
}

@Entity('check_ins')
export class CheckIn {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int', unique: true })
  bookingId: number;

  @OneToOne(() => Booking, (b: Booking) => b.checkIn)
  @JoinColumn({ name: 'bookingId' })
  booking?: Booking;

  @Column({ type: 'int' })
  staffUserId: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'staffUserId' })
  staff?: User;

  @Column({ type: 'varchar', length: 24 })
  code: string;

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  scannedAt: Date;
}

@Entity('reviews')
@Unique(['userId', 'arenaId'])
export class Review {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  userId: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user?: User;

  @Column({ type: 'int' })
  arenaId: number;

  @ManyToOne(() => Arena)
  @JoinColumn({ name: 'arenaId' })
  arena?: Arena;

  @Column({ type: 'int' })
  rating: number;

  @Column({ type: 'varchar', length: 2000, default: '' })
  comment: string;

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;
}

@Entity('email_logs')
export class EmailLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  userId: number;

  @Column({ type: 'int', nullable: true })
  bookingId: number | null;

  @Column({ type: 'varchar', length: 120 })
  toEmail: string;

  @Column({ type: 'varchar', length: 200 })
  subject: string;

  @Column({ type: 'varchar', length: 4000 })
  body: string;

  @Column({ type: 'varchar', length: 32, default: 'confirmation' })
  kind: string;

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;
}

@Entity('favorites')
export class Favorite {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  userId: number;

  @Column({ type: 'int', nullable: true })
  arenaId: number | null;

  @Column({ type: 'int', nullable: true })
  missionId: number | null;

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;
}

export const ALL_ENTITIES = [
  User,
  Arena,
  ArenaSlot,
  Booking,
  BookingLine,
  MenuItem,
  Mission,
  QueueEntry,
  CheckIn,
  Review,
  EmailLog,
  Favorite,
];
