---
name: subir-horas
description: >-
  Carga horas en Geek OS (gvia.io), dice qué días de la semana faltan
  y lista lo trabajado hoy o ayer. Usar cuando el usuario diga subir horas,
  cargar horas, registrar tiempo, qué me falta esta semana, qué trabajé hoy,
  qué trabajé ayer, listado de hoy, listado de ayer, timesheet o Mi tiempo en Geek OS.
---

# Subir horas a Geek OS

El usuario habla igual que siempre. Tú eliges el canal. No le preguntes cuál usar.

## Qué dice el usuario

- hora inicio (`11:35`)
- hora fin (`16:35`) o duración (`5` horas, o `1.5`)
- descripción de lo que hizo
- proyecto (nombre o cliente, por ejemplo `Solfium`)
- tarea (un pedazo del título, por ejemplo `frontend a WP`)

Si no dice la fecha, usa hoy en Ciudad de México. Si falta la descripción o la tarea, pregúntala. No las inventes.

Si da hora inicio y hora fin, esas mandan. Si además dijo una duración que no cuadra, guarda el rango de reloj y dile la duración real. Si inicio y fin no arman un rango válido (por ejemplo 21:00 a 12:00 el mismo día), pregunta qué quiso decir.

`Filpm` es el proyecto Feria del Libro Palacio de Minería. Búscalo como `Palacio de Minería`.

## Cuál canal

1. Si en esta sesión están las herramientas del MCP `geek-os` (`log_time`, `search_tasks`, `list_time_entries`), usa el MCP.
2. Si no están, o la llamada falla por conexión o token, usa el script. Dilo en una frase.
3. Una entrada se guarda por un solo canal. Si el MCP ya la guardó, no corras el script. Si el MCP rechaza la entrada (12 horas, futuro, subtareas, timer), enseña el error y no la reintentes con el script: es la misma regla.

Cursor pide confirmación antes de `log_time`, `create_task` y `update_time_entry`. Esa confirmación es el guardado.

## MCP

Horas en Ciudad de México. Tope de 12 horas por entrada, hasta 14 días hacia atrás, nada a futuro. Si piden más de 12 horas, dilo y espera: no partas la entrada por tu cuenta.

1. `list_projects` con `query` del proyecto. Si hay varios, listalos y espera.
2. `search_tasks` con el `projectId` y el texto de la tarea. Si un título normalizado (sin acentos, minúsculas) es igual al texto, usa ese aunque otro título más largo lo contenga. Si hay cero o varias, listalas y espera.
3. `get_task` de la elegida. Si tiene subtareas, no registres en el padre. Lista las subtareas y espera. Si pide crear una, `create_task` con `projectId`, `parentId` y `title`, y `assigneeId` el `id` de `whoami`. Luego registra en esa subtarea.
4. `get_active_timer`. Si hay uno corriendo, dilo y no registres.
5. `log_time` con `taskId`, `date` (`AAAA-MM-DD`), `start` (`HH:mm`), `end` (`HH:mm`) y `description`. Si `end` es menor que `start`, Geek OS la cierra al día siguiente.
6. `list_time_entries` de ese día. Si la entrada nueva se cruza con otra (`inicio < fin de la otra` y `inicio de la otra < fin`), avisa con tarea, proyecto y horario. Tocarse en el extremo no es cruce. No preguntes y no la vuelvas a guardar.

Para hoy, ayer o qué falta en la semana, `list_time_entries` con `from` y `to`. La semana empieza el lunes. En «qué falta», lista lunes a viernes y marca en cero los que no tienen horas. Enséñalo tal como vino.

Al terminar di proyecto, tarea, inicio, fin y descripción.

## Script, si no hay MCP

Desde la raíz de este repo. Las credenciales salen de `.env` (`USER` o `EMAIL`, y `PASSWORD`). No las imprimas.

```bash
node scripts/subir-horas.mjs \
  --inicio 11:35 \
  --horas 5 \
  --fecha 2026-09-23 \
  --desc "Integración del HTML al WP local" \
  --proyecto Solfium \
  --tarea "frontend a WP"
```

`--fin 16:35` vale si ya dio la hora de cierre. No pases `--fin` y `--horas` juntos.

Si el script sale con código 2, hay varias tareas: enséñalas y espera. El script ya avisa el cruce después de guardar; enseña ese aviso. No vuelvas a correr el comando.

```bash
node scripts/subir-horas.mjs --faltan
node scripts/subir-horas.mjs --hoy
node scripts/subir-horas.mjs --ayer
```
