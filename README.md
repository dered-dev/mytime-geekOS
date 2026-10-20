# mytime-geekOS

Carga horas en [Geek OS](https://gvia.io) desde Cursor, con tu propia cuenta. Ves y registras solo lo que tu rol ya puede hacer en la app.

## Qué necesitas y de dónde sale

Hace falta una sola vía. El MCP no pide correo ni contraseña. El script no pide token.

| Vía | Qué pones | Dónde lo sacas |
| --- | --- | --- |
| MCP en Cursor, Claude Code o Codex | Un token personal, en la variable `GEEK_OS_TOKEN` | Entras a [gvia.io](https://gvia.io) con tu usuario de siempre. Abres **Mi cuenta → Agentes y MCP**, o directo [gvia.io/me/integrations](https://gvia.io/me/integrations). **Nuevo token**, le pones el nombre de la herramienta (`Cursor`, `Claude Code` o `Codex`) y lo copias. Se muestra una sola vez. Si lo pierdes, revocas ese y creas otro. |
| MCP en Claude (claude.ai, Desktop o móvil) | Nada que copiar | **Configuración → Conectores → Agregar conector personalizado**. Nombre `Geek OS`, URL `https://gvia.io/api/mcp`. Al conectar, Geek OS te pide tu correo y contraseña de siempre y autorizas. |
| Script de este repo | `USER` y `PASSWORD` en un `.env` | No se generan. Copia [`.env.example`](.env.example) a `.env` y reemplaza `REEMPLAZA_CON_TU_CORREO` y `REEMPLAZA_CON_TU_CONTRASEÑA` por el correo y la contraseña con los que entras a [gvia.io](https://gvia.io). |

Le dices al agente el proyecto, la tarea, a qué hora empezaste, a qué hora terminaste (o cuántas horas) y qué hiciste. Si no dices el día, usa hoy en Ciudad de México.

> Hoy, de las 11:00 a las 12:30, en Solfium, tarea Integración de frontend a WP. Logo issue mobile iOS.

Si hay varias tareas parecidas, te las lista y espera. No inventa la descripción ni la tarea. Si das hora de inicio y de fin, ese rango es el que se guarda.

También puedes preguntar qué trabajaste hoy o ayer, y qué días de lunes a viernes siguen en cero.

## Cómo se guarda

El agente elige el canal. Si el MCP de Geek OS está conectado, usa ese. Si no, usa el script de este repo. La misma entrada se guarda una sola vez.

Las dos vías hacen lo mismo que **Nueva entrada** en Mi tiempo.

## 1. MCP

Sirve en cualquier chat, no solo con este repo abierto. El manual está en [gvia.io/help/mcp](https://gvia.io/help/mcp).

1. En Geek OS entra a **Mi cuenta → Agentes y MCP** (`/me/integrations`) y crea un token. Ponle el nombre de la herramienta, por ejemplo `Cursor`.
2. Guárdalo en tu shell. No lo pegues en este repo ni en el chat.

   ```bash
   echo 'export GEEK_OS_TOKEN="pega-aquí-tu-token"' >> ~/.zshrc
   ```

3. En `~/.cursor/mcp.json` (Cursor Settings → MCP), agrega el servidor. Si el archivo ya tiene otros, suma solo el bloque `geek-os`.

   ```json
   {
     "mcpServers": {
       "geek-os": {
         "url": "https://gvia.io/api/mcp",
         "headers": { "Authorization": "Bearer ${env:GEEK_OS_TOKEN}" }
       }
     }
   }
   ```

4. Cierra Cursor por completo y ábrelo desde una terminal para que lea la variable:

   ```bash
   open -a Cursor
   ```

En Settings → MCP, `geek-os` tiene que verse en verde. El token es tu cuenta: quien lo tenga puede hacer en Geek OS lo mismo que tú. Si se filtra, revócalo en `/me/integrations`.

Cursor te pide confirmar antes de guardar. Esa confirmación es el registro.

Para que el agente siga este flujo, abre este repo o copia `.cursor/skills/subir-horas` a tus skills de Cursor.

## 2. Script

Hace falta Node 22. No instala dependencias. Entra con tu correo y contraseña, las mismas de la app.

```bash
cp .env.example .env
```

El `.env` queda así. Cambia solo los dos placeholders:

```
USER=REEMPLAZA_CON_TU_CORREO
PASSWORD=REEMPLAZA_CON_TU_CONTRASEÑA
```

`.env` está en `.gitignore`. No lo subas.

```bash
node scripts/subir-horas.mjs \
  --inicio 11:35 \
  --fin 16:35 \
  --desc "Qué hiciste" \
  --proyecto "Nombre del proyecto" \
  --tarea "pedazo del título"
```

`--horas 5` calcula la hora de fin. No lo combines con `--fin`. `--fecha 2026-09-23` es el día; si lo omites, es hoy.

```bash
node scripts/subir-horas.mjs --hoy
node scripts/subir-horas.mjs --ayer
node scripts/subir-horas.mjs --faltan
```

`--faltan` lista lunes a viernes de la semana y marca los días sin horas. Si el texto de la tarea coincide con varias, el script se detiene y las imprime. Elige una y vuelve a correrlo.

## Reglas de Geek OS

Son las de la app. Ni el MCP ni el script las saltan.

- La hora es de Ciudad de México.
- Máximo 12 horas por entrada. Si fue más, hay que partirla.
- Se puede registrar hasta 14 días hacia atrás. Nada a futuro.
- Si la tarea tiene subtareas, el tiempo va en una subtarea, no en el padre.
- Con un timer corriendo, el MCP no deja registrar. Páralo primero.
- Si el horario se empalma con otra entrada, igual se guarda y el agente avisa con cuál chocó.

El detalle para el agente está en `.cursor/skills/subir-horas/SKILL.md`.
