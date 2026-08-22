export type UserRole = 'player' | 'staff' | 'admin';

export type BookingStatus =
  | 'pending'
  | 'confirmed'
  | 'checked_in'
  | 'in_play'
  | 'completed'
  | 'cancelled'
  | 'expired';

export interface User {
  id: number;
  username: string;
  email: string;
  role: UserRole;
  points?: number;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
}

export interface Arena {
  id: number;
  slug: string;
  name: string;
  type: string;
  description?: string;
  maxPlayers: number;
  minPlayers: number;
  difficulty: number;
  priceCentsPerPlayer: number;
  photoUrl?: string | null;
  active: boolean;
  maintenance?: boolean;
  tags?: string[];
  freeSlotsToday?: number;
  ratingAvg?: number;
  ratingCount?: number;
}

export interface SlotView {
  id: number;
  arenaId?: number;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  blocked?: boolean;
  arena?: Arena;
}

export interface MenuItem {
  id: number;
  name: string;
  kind?: string;
  description?: string;
  priceCents: number;
  active?: boolean;
}

export interface Mission {
  id: number;
  slug: string;
  name: string;
  mode: string;
  minutes: number;
  description?: string;
  photoUrl?: string | null;
}

export interface BookingLine {
  id?: number;
  kind?: string;
  label?: string;
  qty: number;
  unitPriceCents: number;
  amountCents?: number;
  subtotalCents?: number;
}

export interface QueueEntry {
  id: number;
  missionId: number;
  position: number;
  status: 'queued' | 'playing' | 'done';
  mission?: Mission | null;
}

export interface Booking {
  id: number;
  code?: string | null;
  status: BookingStatus;
  partySize: number;
  totalCents: number;
  expiresAt?: string | null;
  startsAt?: string | null;
  qrToken?: string | null;
  qrSvg?: string | null;
  extraHour?: boolean;
  slot?: {
    id: number;
    date: string;
    startTime: string;
    endTime: string;
    arenaId?: number;
    arena?: Partial<Arena> | null;
  } | null;
  lines?: BookingLine[];
}

export const STATUS_LABELS: Record<string, string> = {
  pending: 'Reservada',
  confirmed: 'Confirmada',
  checked_in: 'En puerta',
  in_play: 'En juego',
  completed: 'Jugada',
  cancelled: 'Cancelada',
  expired: 'Caducada',
};

export const TOKEN_KEY = 'fulgor.accessToken';
