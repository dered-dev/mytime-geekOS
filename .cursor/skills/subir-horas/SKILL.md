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

### 1. Proyecto

`list_projects` con `query` del proyecto (compara sin acentos y en minúsculas, también contra el cliente).

- Uno: úsalo.
- Varios: lístalos numerados y espera.
- Ninguno: llama `list_projects` sin `query` (todos los que el usuario puede ver, con `limit` 100) y lístalos numerados con su cliente. Espera a que elija uno. No adivines.

### 2. Tarea

`search_tasks` con el `projectId` y el texto de la tarea. Si un título normalizado (sin acentos, minúsculas) es igual al texto, usa ese aunque otro título más largo lo contenga.

- Una: úsala.
- Varias: lístalas numeradas y espera.
- Ninguna: no te quedes ahí. Llama `search_tasks` solo con el `projectId` (`limit` 100) y compara tú, sin acentos, contra cada palabra del texto. Enseña todas las tareas del proyecto numeradas (título, status, assignee; marca las subtareas y las que tienen subtareas). Luego ofrece los tres caminos de abajo.

**Los tres caminos cuando la tarea no existe.** Pregunta una sola vez y espera:

1. **Registrar en una tarea existente** de la lista. Sugiere la más parecida si hay alguna.
2. **Crear una subtarea** con el título que dijo el usuario bajo la tarea padre más lógica (por ejemplo `Mantenimiento Técnico Drupal` para trabajo técnico del sitio). Di cuál padre propones.
3. **Crear una tarea nueva** de primer nivel en el proyecto con ese título. Requiere permiso de editar el proyecto; si `create_task` lo rechaza, enseña el error y ofrece el camino 2.

Al crear, usa `create_task` con `projectId`, `title`, `assigneeId` el `id` de `whoami`, y `parentId` si es subtarea. Crear notifica al equipo: por eso se pregunta antes.

### 3. Subtareas

`get_task` de la elegida. Si tiene subtareas, no registres en el padre. Lista las subtareas y ofrece usar una o crear una nueva bajo ese padre (camino 2).

### 4. Timer

`get_active_timer`. Con un timer corriendo Geek OS no deja registrar. Si hay uno:

1. Di en qué tarea está y desde qué hora corre.
2. Pide confirmación para pararlo. Si no la da, no registres.
3. Con el sí, `stop_timer` (el tiempo corrido queda guardado como entrada).
4. Registra la entrada (paso 5).
5. Al terminar pregunta qué hacer con el timer, con estas dos opciones:
   - **Continuar**: `start_timer` en la misma tarea que estaba corriendo.
   - **Pararlo definitivamente**: no hagas nada más.

Mover una tarea a `IN_PROGRESS` con `update_task_status` arranca un timer si el usuario es el assignee, y sacarla de ahí lo detiene. Avísalo antes de cambiar el status.

### 5. Registrar

`log_time` con `taskId`, `date` (`AAAA-MM-DD`), `start` (`HH:mm`), `end` (`HH:mm`) y `description`. Si `end` es menor que `start`, Geek OS la cierra al día siguiente.

### 6. Revisar

`list_time_entries` de ese día. Si la entrada nueva se cruza con otra (`inicio < fin de la otra` y `inicio de la otra < fin`), avisa con tarea, proyecto y horario. Tocarse en el extremo no es cruce. No preguntes y no la vuelvas a guardar.

### Listados

Para hoy, ayer o qué falta en la semana, `list_time_entries` con `from` y `to`. La semana empieza el lunes. En «qué falta», lista lunes a viernes y marca en cero los que no tienen horas. Enséñalo tal como vino.

Al terminar di proyecto, tarea, fecha, inicio, fin y descripción.

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

Si el script sale con código 2, no encontró el proyecto o la tarea, o hay varias. Enseña la lista tal como vino y espera:

- Sin proyecto: lista los proyectos que el usuario ve. Que elija uno.
- Sin tarea: lista las parecidas y todas las del proyecto, con los tres caminos (tarea existente, subtarea nueva, tarea nueva). El script no crea tareas: si elige 2 o 3 y está el MCP, créala con `create_task`; si no, que la cree en gvia.io y vuelve a correr el comando.

El script solo ve los proyectos y tareas donde el usuario tiene tareas asignadas (`/api/me/tasks`). Si la tarea existe pero no está asignada a él, no aparece: usa el MCP o pídele que se la asigne en la app.

El script no maneja el timer. Si Geek OS rechaza la entrada por un timer corriendo, dilo y que lo pare en la app. El script ya avisa el cruce después de guardar; enseña ese aviso. No vuelvas a correr el comando.

```bash
node scripts/subir-horas.mjs --faltan
node scripts/subir-horas.mjs --hoy
node scripts/subir-horas.mjs --ayer
node scripts/subir-horas.mjs --proyectos
node scripts/subir-horas.mjs --tareas --proyecto Roshfrans
```
