# Architecture — Fulgor

Monorepo `apps/api` (NestJS 11 + TypeORM + better-sqlite3) y `apps/web` (Angular 22 zoneless).

## Ciclo transaccional

1. `POST /api/bookings/hold` — mutex + expireStale + 409 SLOT_TAKEN / ALREADY_HELD.
2. `expiresAt` server + sweeper 30s.
3. `POST /api/bookings/:id/confirm` — QR + email simulado.
4. `POST /api/staff/check-in` — confirmed → in_play, primera misión `playing`.
5. Reorder solo `queued`. Advance playing → done.
6. `POST /api/bookings/:id/complete` — puntos = 10 × partySize derivados.

TZ Europe/Madrid. Neon-ready (`DATABASE_TYPE=postgres`).
