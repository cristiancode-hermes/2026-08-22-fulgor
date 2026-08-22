import {
  canTransition,
  hasDuplicateUserSlot,
  holdConflict,
  isLivePending,
  pointsForCompleted,
  slotIsBusy,
  sumLines,
} from './booking-rules';

describe('booking-rules extra', () => {
  it('sweeper treats expired pending as not live', () => {
    const past = new Date(Date.now() - 60_000);
    expect(isLivePending('pending', past)).toBe(false);
    expect(isLivePending('pending', new Date(Date.now() + 60_000))).toBe(true);
    expect(isLivePending('confirmed', past)).toBe(false);
  });

  it('slot busy includes checked_in and in_play', () => {
    expect(slotIsBusy(false, [{ status: 'checked_in', expiresAt: null }])).toBe('busy');
    expect(slotIsBusy(false, [{ status: 'in_play', expiresAt: null }])).toBe('busy');
    expect(slotIsBusy(true, [])).toBe('blocked');
    expect(slotIsBusy(false, [{ status: 'expired', expiresAt: null }])).toBe('free');
  });

  it('same-user 409 also for checked_in', () => {
    expect(
      hasDuplicateUserSlot(
        [{ userId: 3, slotId: 1, status: 'checked_in', expiresAt: null }],
        3,
        1,
      ),
    ).toBe(true);
  });

  it('cannot skip to completed from confirmed', () => {
    expect(canTransition('confirmed', 'completed')).toBe(false);
    expect(canTransition('in_play', 'completed')).toBe(true);
  });

  it('derived points never use a base offset', () => {
    const parties = [8, 6, 4];
    const points = parties.reduce((a, p) => a + pointsForCompleted(p), 0);
    expect(points).toBe(80 + 60 + 40);
  });

  it('list and detail share SUM of lines', () => {
    const lines = [
      { qty: 10, unitPriceCents: 750 },
      { qty: 1, unitPriceCents: 400 },
    ];
    expect(sumLines(lines)).toBe(7900);
  });

  it('expired pending does not occupy slot', () => {
    expect(
      slotIsBusy(false, [
        { status: 'pending', expiresAt: new Date(Date.now() - 1000) },
      ]),
    ).toBe('free');
  });
});

describe('holdConflict order', () => {
  const now = new Date('2026-08-22T12:00:00Z');
  it('same-user pending wins over SLOT_TAKEN', () => {
    expect(
      holdConflict(
        [{ userId: 1, slotId: 9, status: 'pending', expiresAt: new Date('2026-08-22T12:10:00Z') }],
        1,
        9,
        now,
      ),
    ).toBe('ALREADY_HELD');
  });

  it('other user live is SLOT_TAKEN', () => {
    expect(
      holdConflict(
        [{ userId: 2, slotId: 9, status: 'confirmed', expiresAt: null }],
        1,
        9,
        now,
      ),
    ).toBe('SLOT_TAKEN');
  });

  it('empty is free', () => {
    expect(holdConflict([], 1, 9, now)).toBeNull();
  });
});
