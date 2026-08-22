# QA Report — 2026-08-22 Fulgor

**Project:** Láser tag B2C — reserva de arena exclusiva por franja de 60 min, cola de misiones en vivo, check-in staff por QR.
**Stack:** Angular 22 (zoneless, signals) + NestJS 11 + TypeORM + SQLite (Neon-ready)
**Author:** Hermes Daily Builder + QA 07:00
**Design lock:** DESIGN_FREE (`isFinalDesign.true` ausente)

## ✅ 1. Build Verification

| Target | Status | Details |
|--------|--------|---------|
| API `tsc --incremental false` | ✅ | `apps/api/dist/main.js` presente |
| Web `ng build` production | ✅ | `apps/web/dist/web/browser/index.html` + `baseHref: "/"` |
| Jest | ✅ | 21/21 |

## ✅ 2. Test Results

21 test cases — ALL PASSED (`booking-rules` + extra: transiciones, 409 same-user, puntos 10×, suma de líneas, cancel 24h, partySize, sweeper, holdConflict order).

| Suite | Cases |
|-------|-------|
| booking-rules | 11 |
| booking-rules extra | 7 |
| holdConflict order (QA) | 3 |

New tests: 3 added (ALREADY_HELD before SLOT_TAKEN).

## ✅ 3. Binary / Runtime Verification

| Mode | Output | Status |
|------|--------|--------|
| API :3071 | Seed `demo@fulgor.dev` / `staff@fulgor.dev` · 6 arenas · 12 misiones · demo points=80 | ✅ |
| Endpoint smoke | 29/29 | ✅ |
| Hold 15 min `expiresAt` server | pending + ~15 min | ✅ |
| 409 same-user `ALREADY_HELD` | HTTP 409 | ✅ |
| 409 other-user `SLOT_TAKEN` | HTTP 409 | ✅ |
| Lista ↔ detalle `totalCents` | 5500 = 5500 | ✅ |
| QR en confirmación | SVG + código `FLG-*` | ✅ |
| Staff check-in + segundo scan | 201 → 409 `ALREADY_CHECKED_IN` | ✅ |
| Staff stats 403 para player | 403 | ✅ |
| Home = catálogo `freeSlotsToday` | 82 = 82 | ✅ |
| Franjas 00:00 última | sí | ✅ |

Auth: `RegisterDto` = username+email+password; login `identifier` **o** `login` alias; respuesta `{ accessToken, user }`. HTTP 201 en POST = PASS.

Fixes QA:
1. `emitDecoratorMetadata` TDZ `Booking`↔`CheckIn` (API no arrancaba).
2. `bookings.save` tras check-in anulaba `check_ins.bookingId` → 500; ahora `update()`.
3. `featured.freeSlotsToday` sumaba solo 4 arenas; ahora comparte el total del catálogo.
4. 409 same-user se evaluaba después de SLOT_TAKEN.

## ✅ 4. Quality Audit

| Criterion | Verdict | Notes |
|-----------|---------|-------|
| Auth routes antes de `**` | PASS | `/login` `/registro` `/entrar` top-level |
| Creds demo debajo, inputs vacíos | PASS | `autocomplete="off"` / `new-password` |
| JWT namespaced + dual-write `token` | PASS | `fulgor.accessToken` y `token` |
| Interceptor lee localStorage (no AuthService) | PASS | Bearer real (no `***`) |
| `provideZonelessChangeDetection` | PASS | |
| Rutas dinámicas `ngOnInit` | PASS | arenas/:id, mis-partidas/:id, confirmación |
| Capa de valor de verdad | PASS | mutex arena×franja + sweeper + 409 + cola now-playing |
| Contraste botones AA | PASS | light primary 7.31 / hover 9.37; dark 5.18 / 7.31 |
| contraste-hover (2026-08-19) | PASS | `a:hover:not(.btn)` + `color: on-primary` hover/focus/active |
| Home = catálogo `freeSlotsToday` | PASS | misma fuente `findAll` |
| Gráfico staff | PASS | ejes X/Y + fechas + `<title>` tooltips |

### Minor Issues

| Issue | Severity | Suggestion |
|-------|----------|------------|
| Screenshots portafolio `/assets/fulgor.png` | baja | Capture cron posterior (normal) |
| Eje Y del chart staff sin ticks numéricos | info | Hay ejes + fechas + tooltips; cumple regla #3 |

## ✅ 5. Security Scan

| Check | Result |
|-------|--------|
| JWT secret via ConfigService (registerAsync + strategy) | OK |
| Passwords bcrypt | OK |
| Guards JWT en bookings | OK |
| StaffGuard en check-in / stats | OK |
| ValidationPipe whitelist + forbidNonWhitelisted | OK |
| `.env` gitignored | OK |

## ✅ 6. Deployment

| Target | Result | Details |
|--------|--------|---------|
| Caddy | ✅ | `fulgor.proyectos.cristiancode.dev` → dist + `/api*` :3071 |
| manage-apis.sh | ✅ | port 3071 / name fulgor / dir 2026-08-22-fulgor aligned |
| Excel | ✅ | Row 88 Completado |
| Landing | ✅ | `name:'fulgor'` en proyectos.cristiancode.dev |
| GitHub | ✅ | https://github.com/cristiancode-hermes/2026-08-22-fulgor |
| Portfolio locales es/en/pt | ✅ | slug `fulgor` id 210 |
| Capture config | ✅ | `fulgor` + `fulgor.accessToken` |
| href / link2 / link3 | ✅ | 200 / 200 / 200 |
| API health vía Caddy | ✅ | 200 |

## Summary

**OVERALL: PASS ✅**
