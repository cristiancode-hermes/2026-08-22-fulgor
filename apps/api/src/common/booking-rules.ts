import type { BookingStatus, QueueStatus } from '../entities/entities';

export const HOLD_MINUTES = 15;
export const POINTS_PER_PLAYER = 10;
export const CANCEL_HOURS = 24;
export const MIN_PARTY = 4;
export const MAX_PARTY_CAP = 16;

export const LIVE_BOOKING: BookingStatus[] = [
  'pending',
  'confirmed',
  'checked_in',
  'in_play',
];

export const TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  pending: ['confirmed', 'cancelled', 'expired'],
  confirmed: ['checked_in', 'cancelled'],
  checked_in: ['in_play', 'cancelled'],
  in_play: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
  expired: [],
};

export function canTransition(from: BookingStatus, to: BookingStatus): boolean {
  return (TRANSITIONS[from] || []).includes(to);
}

export function hasDuplicateUserSlot(
  existing: { userId: number; slotId: number; status: BookingStatus; expiresAt?: Date | string | null }[],
  userId: number,
  slotId: number,
  now = new Date(),
): boolean {
  return existing.some((b) => {
    if (b.userId !== userId || b.slotId !== slotId) return false;
    if (b.status === 'confirmed' || b.status === 'checked_in' || b.status === 'in_play') {
      return true;
    }
    if (b.status === 'pending') {
      if (!b.expiresAt) return true;
      return new Date(b.expiresAt).getTime() > now.getTime();
    }
    return false;
  });
}

export function pointsForCompleted(partySize: number): number {
  return partySize * POINTS_PER_PLAYER;
}

export function sumLines(lines: { qty: number; unitPriceCents: number }[]): number {
  return lines.reduce((a, l) => a + l.qty * l.unitPriceCents, 0);
}

export function canCancelByPolicy(
  hoursUntilStart: number,
  cancelHours = CANCEL_HOURS,
): boolean {
  return hoursUntilStart >= cancelHours;
}

export function validatePartySize(
  partySize: number,
  maxPlayers: number,
  minPlayers = MIN_PARTY,
): { ok: boolean; code?: string } {
  const cap = Math.min(maxPlayers, MAX_PARTY_CAP);
  if (!Number.isFinite(partySize) || partySize < minPlayers || partySize > cap) {
    return { ok: false, code: 'INVALID_PARTY_SIZE' };
  }
  return { ok: true };
}

export function buildQrPlaceholderSvg(token: string, code: string): string {
  const cells = 21;
  const size = 168;
  const cell = size / cells;
  let rects = '';
  for (let y = 0; y < cells; y++) {
    for (let x = 0; x < cells; x++) {
      const h = hashByte(token, x, y);
      const finder =
        (x < 7 && y < 7) ||
        (x >= cells - 7 && y < 7) ||
        (x < 7 && y >= cells - 7);
      const on = finder ? finderOn(x, y, cells) : h % 2 === 0;
      if (on) {
        rects += `<rect x="${(x * cell).toFixed(2)}" y="${(y * cell).toFixed(2)}" width="${cell.toFixed(2)}" height="${cell.toFixed(2)}" fill="#141920"/>`;
      }
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size + 28}" width="${size}" height="${size + 28}" role="img" aria-label="QR ${code}"><rect width="100%" height="100%" fill="#fff"/>${rects}<text x="${size / 2}" y="${size + 18}" text-anchor="middle" font-family="monospace" font-size="12" fill="#141920">${code}</text></svg>`;
}

function hashByte(token: string, x: number, y: number): number {
  let h = 0;
  const s = `${token}:${x},${y}`;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

function finderOn(x: number, y: number, cells: number): boolean {
  const regions = [
    [0, 0],
    [cells - 7, 0],
    [0, cells - 7],
  ];
  for (const [ox, oy] of regions) {
    const lx = x - ox;
    const ly = y - oy;
    if (lx >= 0 && lx < 7 && ly >= 0 && ly < 7) {
      if (lx === 0 || ly === 0 || lx === 6 || ly === 6) return true;
      if (lx >= 2 && lx <= 4 && ly >= 2 && ly <= 4) return true;
      return false;
    }
  }
  return false;
}

export function madridDate(d = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

export function addDaysYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

export function parseMadridLocal(date: string, time: string): Date {
  return new Date(`${date}T${time}:00+02:00`);
}

export function isLivePending(
  status: BookingStatus,
  expiresAt: Date | string | null,
  now = new Date(),
): boolean {
  if (status !== 'pending') return false;
  if (!expiresAt) return true;
  return new Date(expiresAt).getTime() > now.getTime();
}

export function slotIsBusy(
  blocked: boolean,
  activeBookings: { status: BookingStatus; expiresAt: Date | string | null }[],
  now = new Date(),
): 'blocked' | 'busy' | 'free' {
  if (blocked) return 'blocked';
  const busy = activeBookings.some(
    (b) =>
      b.status === 'confirmed' ||
      b.status === 'checked_in' ||
      b.status === 'in_play' ||
      isLivePending(b.status, b.expiresAt, now),
  );
  return busy ? 'busy' : 'free';
}

/** After-midnight (00:00–11:59) sorts AFTER evening (12:00–23:59). */
export function nightSlotSortKey(startTime: string): number {
  const [hRaw, mRaw] = String(startTime || '00:00').split(':');
  const h = Number(hRaw);
  const m = Number(mRaw);
  const hh = Number.isFinite(h) ? h : 0;
  const mm = Number.isFinite(m) ? m : 0;
  return (hh < 11 ? hh + 24 : hh) * 60 + mm;
}

export function sortNightSlots<T extends { startTime: string }>(slots: T[]): T[] {
  return [...slots].sort(
    (a, b) => nightSlotSortKey(a.startTime) - nightSlotSortKey(b.startTime),
  );
}

export function canReorderQueue(
  entries: { id: number; status: QueueStatus }[],
  orderedEntryIds: number[],
): { ok: boolean; code?: string } {
  const playing = entries.filter((e) => e.status === 'playing');
  if (playing.length > 1) return { ok: false, code: 'MULTIPLE_PLAYING' };
  const playingId = playing[0]?.id;
  if (playingId && !orderedEntryIds.includes(playingId)) {
    return { ok: false, code: 'PLAYING_MISSING' };
  }
  const queuedIds = entries.filter((e) => e.status === 'queued').map((e) => e.id);
  const incomingQueued = orderedEntryIds.filter((id) => id !== playingId);
  if (queuedIds.length !== incomingQueued.length) {
    return { ok: false, code: 'QUEUE_MISMATCH' };
  }
  const set = new Set(queuedIds);
  if (incomingQueued.some((id) => !set.has(id))) {
    return { ok: false, code: 'QUEUE_MISMATCH' };
  }
  return { ok: true };
}

export function applyQueueOrder(
  entries: { id: number; status: QueueStatus; position: number }[],
  orderedQueuedIds: number[],
): { id: number; position: number }[] {
  const playing = entries.find((e) => e.status === 'playing');
  const done = entries
    .filter((e) => e.status === 'done')
    .sort((a, b) => a.position - b.position);
  const next: { id: number; position: number }[] = [];
  let pos = 1;
  for (const d of done) next.push({ id: d.id, position: pos++ });
  if (playing) next.push({ id: playing.id, position: pos++ });
  for (const id of orderedQueuedIds) next.push({ id, position: pos++ });
  return next;
}

export function SLOT_HOURS(): string[] {
  const hours: string[] = [];
  for (let h = 11; h <= 23; h++) hours.push(`${String(h).padStart(2, '0')}:00`);
  hours.push('00:00');
  return hours;
}
