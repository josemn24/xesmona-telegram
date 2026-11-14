# xesmona-telegram: visión general

## Qué es

Monorepo (pnpm + Turborepo) para crear **varios bots de Telegram de Xesmona** que comparten
motores de juego, Mini Apps y servicios comunes. Cada bot es una app pequeña que combina las
piezas que necesita. El primer bot es de **juegos**: empieza con **tres en raya** jugado en el
propio chat, sigue con **4 en raya** como primera Mini App y después llega **Muros**, el primer
juego con motor propio de verdad.

## Juegos

| Juego        | Dónde se juega              | Para qué sirve                                                                                                                           |
| ------------ | --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Tres en raya | Chat: teclado inline de 3×3 | MVP. Valida bot, persistencia, versiones de jugada y concurrencia sin Mini App.                                                          |
| 4 en raya    | Mini App                    | Motor trivial (7×6 con gravedad): valida la tubería completa de Mini App (`initData` → JWT → Realtime). Primera versión de `GameEngine`. |
| Muros        | Mini App                    | Carrera de peones y colocación de muros. Motor no trivial; consolida `GameEngine`.                                                       |
| Dados        | Mini App                    | Juego de dados con nombre y diseño propios (no «Barricade», marca registrada).                                                           |

**Muros** (nombre y diseño propios; no usar «Quoridor», marca registrada): tablero de 9×9; cada
jugador lleva su peón al lado opuesto o coloca muros que ocupan dos casillas para frenar al
rival. Un muro nunca puede cortar el último camino de un jugador a su meta (se comprueba con una
búsqueda de caminos en cada colocación). Primero 2 jugadores; 4 jugadores más adelante.

Nombres de juego genéricos o propios: evita marcas como «Conecta 4», «Quoridor» o «Barricade».

## Stack

| Capa        | Tecnología                                                                    |
| ----------- | ----------------------------------------------------------------------------- |
| Lenguaje    | TypeScript estricto, Node 24 LTS                                              |
| Bots        | grammY (webhook en producción, long polling en local)                         |
| API         | Hono, en el mismo proceso Node que los bots                                   |
| Mini Apps   | Vite + React (SPA), Tailwind, Motion + SVG para tableros, `@tma.js/sdk-react` |
| Datos       | Supabase Postgres, migraciones SQL, Zod                                       |
| Tiempo real | Supabase Realtime (canales privados; eventos emitidos desde Postgres)         |
| Trabajos    | Supabase Queues (pgmq)                                                        |
| Hosting     | Railway (un servicio Node + Mini Apps estáticas) y Supabase Cloud (UE)        |
| Calidad     | ESLint, Prettier, Vitest, Playwright (Fase 2), GitHub Actions                 |

## Principios

1. **El servidor es la autoridad.** El cliente solo muestra estado optimista; toda jugada se
   valida, versiona y persiste en una transacción.
2. **Motores puros.** Las reglas de un juego no dependen de React, grammY ni Supabase.
3. **Identidad verificada.** En la Mini App se valida siempre el `initData` original con el
   token del bot que la abrió; nunca `initDataUnsafe`. En el chat, la identidad es el `from` del
   callback query que envía Telegram.
4. **Abstracciones con el segundo caso.** El contrato `GameEngine` tiene una primera versión
   mínima con 4 en raya y se consolida con Muros (dos tipos de jugada, recursos limitados y otra
   condición de victoria); el SDK de módulos, al llegar el segundo bot o módulo.
5. **Telegram en grupos:** los botones `web_app` no se permiten en grupos; se usan botones `url`
   con direct link (`https://t.me/<bot>/<app>?startapp=<param>`). El modo inline permite invitar
   desde cualquier chat.

## Flujos

### Tres en raya en el chat (MVP)

1. `@bot` en cualquier chat (modo inline) o `/play` en un grupo.
2. El bot publica la invitación; un segundo jugador pulsa «Unirme».
3. El tablero es un teclado inline de 3×3. Cada botón lleva `ttt:<partida>:<casilla>:<versión>`
   en `callback_data` (máx. 64 bytes).
4. El servidor comprueba que juega quien tiene el turno y que la versión coincide, guarda la
   jugada en una transacción y edita el mensaje. A quien no juega se le responde con un aviso.
5. Al terminar, el mensaje muestra el resultado y un botón de revancha. En modo inline los
   callbacks llegan con `inline_message_id` y el bot no necesita estar en el chat.

### Juegos en Mini App (4 en raya, Muros)

1. `@bot` en cualquier chat (modo inline) o `/play` en un grupo.
2. El bot publica la invitación con un direct link a la Mini App.
3. Se une un segundo jugador; ambos abren la Mini App, el backend valida su identidad y les da
   acceso al canal privado de la partida.
4. Cada jugada se valida en el servidor y se guarda con su versión; el evento Realtime sale
   desde la base de datos.
5. Al terminar, una cola edita la invitación con el resultado y un botón de revancha.

## Roadmap

0. **Pruebas técnicas:** teclados inline y edición de mensajes en grupos y en modo inline;
   direct link a la Mini App en grupos. Resultado: ADRs.
1. **Tres en raya en el chat de principio a fin:** `/play`, modo inline, jugadas persistidas con
   versión, revancha.
2. **4 en raya en Mini App:** tubería completa (`initData` → JWT → canal privado con RLS →
   Realtime), resultado publicado en el grupo. Primera versión de `GameEngine`.
3. **Fiabilidad:** límites de Telegram al editar mensajes, pulsaciones simultáneas, reconexión
   en la Mini App, partidas abandonadas y caducadas, colas.
4. **Muros para 2 jugadores:** colocación de muros, validación de caminos, saltos. Consolida
   `GameEngine`.
5. **Segundo bot o módulo (p. ej. encuestas):** se extrae el SDK de módulos.
6. **Muros para 4 jugadores, juego de dados propio y rankings.**

**Backlog:** ajedrez.
