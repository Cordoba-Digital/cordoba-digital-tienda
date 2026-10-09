# Migraciones de la base

El esquema vive en `src/db/schema.ts`. Cada cambio se guarda como una migración
SQL en `drizzle/`, que se revisa en el PR y se aplica con un comando. Ya no se
usa `drizzle-kit push` (aplicaba cambios sin historial y, como no conocía las
tablas que crea la app sola, proponía borrarlas).

## Cambiar el esquema

1. Editar `src/db/schema.ts`.
2. `npm run db:generate -- --name que_cambia` escribe `drizzle/NNNN_que_cambia.sql`.
3. Leer el SQL generado y commitearlo junto con el cambio del schema.
   El CI falla si el schema cambió sin su migración.

## Aplicar en una base

```bash
npm run db:migrate -- --status   # muestra qué falta, no escribe
npm run db:migrate               # aplica lo pendiente
```

Con `DATABASE_URL` apuntando a la base que corresponda (local, preview o
producción). Antes de correrlo en producción: hacer un backup (en Neon, crear un
branch de la base sirve de punto de restauración).

## Línea base

`0000_linea_base.sql` es el esquema tal como estaba en producción cuando se
pasó a migraciones (construido con `push` más las tablas que crea la app al
primer uso). En una base que ya tiene tablas y ningún historial, `db:migrate`
la marca como aplicada sin correrla y sigue con las demás. En una base vacía la
corre entera.
