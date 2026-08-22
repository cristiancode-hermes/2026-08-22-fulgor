export function eur(cents: number): string {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(
    (cents || 0) / 100,
  );
}

export function nightSlotSortKey(startTime: string): number {
  const [hRaw, mRaw] = String(startTime || '00:00').split(':');
  const h = Number(hRaw);
  const m = Number(mRaw);
  const hh = Number.isFinite(h) ? h : 0;
  const mm = Number.isFinite(m) ? m : 0;
  return (hh < 11 ? hh + 24 : hh) * 60 + mm;
}

export function sortNightSlots<T extends { startTime: string }>(slots: T[]): T[] {
  return [...slots].sort((a, b) => nightSlotSortKey(a.startTime) - nightSlotSortKey(b.startTime));
}

export function remainingLabel(expiresAt: string | null | undefined, nowMs: number): string {
  if (!expiresAt) return '';
  const sec = Math.max(0, Math.floor((new Date(expiresAt).getTime() - nowMs) / 1000));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
