# Fulgor

Arenas de láser tag por franja + cola de misiones en vivo. Angular 22 + NestJS.

- Demo: `demo@fulgor.dev` / `demo1234`
- Staff: `staff@fulgor.dev` / `demo1234`
- API default: puerto **3071**
- JWT: `fulgor.accessToken`

## Desarrollo

```bash
# API
cd apps/api && npm run build && PORT=3071 node dist/main.js

# Web
cd apps/web && npm run build
```

No arrancar en el cron de build. QA despliega.
