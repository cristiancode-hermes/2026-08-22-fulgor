import {
  applyQueueOrder,
  canCancelByPolicy,
  canReorderQueue,
  canTransition,
  hasDuplicateUserSlot,
  nightSlotSortKey,
  pointsForCompleted,
  SLOT_HOURS,
  sortNightSlots,
  sumLines,
  validatePartySize,
} from './booking-rules';

describe('booking-rules', () => {
  it('points are 10 × partySize', () => {
    expect(pointsForCompleted(8)).toBe(80);
    expect(pointsForCompleted(4)).toBe(40);
  });

  it('sumLines matches qty × unit', () => {
    expect(
      sumLines([
        { qty: 8, unitPriceCents: 900 },
        { qty: 1, unitPriceCents: 400 },
      ]),
    ).toBe(7600);
  });

  it('partySize 4–max and ≤16', () => {
    expect(validatePartySize(4, 12).ok).toBe(true);
    expect(validatePartySize(3, 12).ok).toBe(false);
    expect(validatePartySize(13, 12).ok).toBe(false);
    expect(validatePartySize(16, 20).ok).toBe(true);
    expect(validatePartySize(17, 20).ok).toBe(false);
  });

  it('cancel policy 24h', () => {
    expect(canCancelByPolicy(24)).toBe(true);
    expect(canCancelByPolicy(23.9)).toBe(false);
  });

  it('transitions include check-in → in_play → completed', () => {
    expect(canTransition('pending', 'confirmed')).toBe(true);
    expect(canTransition('confirmed', 'checked_in')).toBe(true);
    expect(canTransition('checked_in', 'in_play')).toBe(true);
    expect(canTransition('in_play', 'completed')).toBe(true);
    expect(canTransition('pending', 'in_play')).toBe(false);
    expect(canTransition('completed', 'cancelled')).toBe(false);
  });

  it('same-user hold is blocked for pending live and confirmed', () => {
    const now = new Date('2026-08-22T12:00:00Z');
    const future = new Date('2026-08-22T12:10:00Z');
    const past = new Date('2026-08-22T11:00:00Z');
    expect(
      hasDuplicateUserSlot(
        [{ userId: 1, slotId: 9, status: 'pending', expiresAt: future }],
        1,
        9,
        now,
      ),
    ).toBe(true);
    expect(
      hasDuplicateUserSlot(
        [{ userId: 1, slotId: 9, status: 'confirmed', expiresAt: null }],
        1,
        9,
        now,
      ),
    ).toBe(true);
    expect(
      hasDuplicateUserSlot(
        [{ userId: 1, slotId: 9, status: 'in_play', expiresAt: null }],
        1,
        9,
        now,
      ),
    ).toBe(true);
    expect(
      hasDuplicateUserSlot(
        [{ userId: 1, slotId: 9, status: 'pending', expiresAt: past }],
        1,
        9,
        now,
      ),
    ).toBe(false);
    expect(
      hasDuplicateUserSlot(
        [{ userId: 2, slotId: 9, status: 'confirmed', expiresAt: null }],
        1,
        9,
        now,
      ),
    ).toBe(false);
  });

  it('00:00 is last in night grid', () => {
    const slots = [
      { startTime: '00:00' },
      { startTime: '11:00' },
      { startTime: '23:00' },
      { startTime: '18:00' },
    ];
    const sorted = sortNightSlots(slots).map((s) => s.startTime);
    expect(sorted).toEqual(['11:00', '18:00', '23:00', '00:00']);
    expect(nightSlotSortKey('00:00')).toBeGreaterThan(nightSlotSortKey('23:00'));
  });

  it('SLOT_HOURS ends with 00:00 and starts at 11:00', () => {
    const h = SLOT_HOURS();
    expect(h[0]).toBe('11:00');
    expect(h[h.length - 1]).toBe('00:00');
    expect(h.indexOf('00:00')).toBe(h.length - 1);
  });

  it('reorder cannot drop playing', () => {
    const entries = [
      { id: 1, status: 'playing' as const },
      { id: 2, status: 'queued' as const },
      { id: 3, status: 'queued' as const },
    ];
    expect(canReorderQueue(entries, [2, 3]).ok).toBe(false);
    expect(canReorderQueue(entries, [1, 3, 2]).ok).toBe(true);
  });

  it('applyQueueOrder keeps playing before queued', () => {
    const entries = [
      { id: 1, status: 'done' as const, position: 1 },
      { id: 2, status: 'playing' as const, position: 2 },
      { id: 3, status: 'queued' as const, position: 3 },
      { id: 4, status: 'queued' as const, position: 4 },
    ];
    const next = applyQueueOrder(entries, [4, 3]);
    expect(next.map((n) => n.id)).toEqual([1, 2, 4, 3]);
  });

  it('list total equals detail total (same lines)', () => {
    const lines = [
      { qty: 6, unitPriceCents: 850 },
      { qty: 1, unitPriceCents: 500 },
      { qty: 1, unitPriceCents: 350 },
    ];
    const listTotal = sumLines(lines);
    const detailTotal = lines.reduce((s, l) => s + l.qty * l.unitPriceCents, 0);
    expect(listTotal).toBe(detailTotal);
    expect(listTotal).toBe(5950);
  });
});
