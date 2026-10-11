# Ciudadan GameView — App Shell UI/UX (Bloque UI/UX 1)

> Rama: `feature/agentoffice-agent1-gameview-uiux`. Este bloque es **solo UI/UX y
> conectividad**: no cambia la semántica ni la ejecución de agentes, el
> ClineControlAdapter, el InstructionService ni DSH.

## 1. Estructura visual (antes → después)

**Antes**: 10 paneles flotantes simultáneos (posiciones absolutas y
localStorage), oficina parcialmente oculta, varias barras de
desplazamiento, `Colyseus Sync: Failed (wss://gameview.ciudadan.org:3000)`.

**Después** — app shell con CSS Grid:

```
┌──────────────────── HEADER (48px) ────────────────────────────┐
│ ☰ · 🏢 Ciudadan GameView · 👥 activos · 🟢 Sincronizado ·      │
│   🖼 Solo mundo · ⚙ Extras · ⛶                                  │
├────────────┬───────────────────────────────────┬──────────────┤
│ SIDEBAR    │        MUNDO PHASER               │  PANEL       │
│ 300px      │        (domina la vista;          │  CONTEXTUAL  │
│ Agentes ·  │         sin paneles encima)       │  330px       │
│ Tareas ·   │                                   │  (solo con   │
│ Sprints ·  │                                   │   selección)│
│ Control    │                                   │              │
└────────────┴───────────────────────────────────┴──────────────┘
+ Drawer de Extras (oculto por defecto, Esc para cerrar)
+ "Solo mundo": colapsa todo, mundo a ancho completo
```

- **Sidebar colapsable** (botón ☰); **panel contextual** solo aparece al
  seleccionar agente (clic en personaje del mundo o en la lista Agentes);
  se cierra con ✕ o `Escape` (también quita el anillo de foco del mundo).
- El canvas Phaser se ajusta a su contenedor con `ResizeObserver` +
  `Phaser.Scale.RESIZE` — nunca se reinicia al cambiar paneles.
- Sin desbordamiento horizontal; scroll interno en cada panel (verificado
  en 1920/1440/1366/1280/390 con navegador real).
- <1024px: sidebar y panel contextual se convierten en drawers superpuestos.

## 2. Mapeo de paneles

| Antes (flotante) | Ahora |
|---|---|
| TaskBoard «Centro de Trabajo» | Sidebar: **Tareas** (propuestas agrupadas por estado + observadas + DSH) y **Sprints** |
| AgentInspector | **Panel contextual** derecho (inspector + acceso a instrucciones con preselección) |
| InstructionPanel | Sidebar: sección **Control** (pipeline íntegro: borrador → aprobación → envío → respuesta real) |
| Episode Recap, Agent Pulse, Highlights, Showrunner, Layout Editor, System Log, Chat, Relationship Graph | **Drawer Extras** (oculto por defecto; cada panel embebido y plegable) |

**Showrunner (ViralControlPanel)**: los escenarios/caos son ficticios
(herencia del proyecto original) y el servidor ya los rechaza en modo
external. La UI ahora lo muestra con los controles deshabilitados y una
explicación honesta — nunca generan actividad simulada en producción.

## 3. Corrección del WebSocket detrás de Cloudflare (FASE 10)

**Causa**: `resolveWsEndpoint` construía `wss://<host>:3000` incluso en
HTTPS. Cloudflare Tunnel/Access solo proxean WSS en el puerto estándar
(443) del dominio público; el puerto 3000 nunca llega al origen →
`Colyseus Sync: Failed (wss://gameview.ciudadan.org:3000)`.

**Corrección** (lógica pura en `src/wsEndpoint.ts`, unit-testeada):

1. `?ws=` (override de operador) — ahora en **sessionStorage** (nunca
   localStorage: una URL rota no queda pegada); se elimina la clave
   legada `agent-office:ws-url` al arrancar.
2. `VITE_WS_URL` (build, para embeds/Activity).
3. **Mismo origen**: página `https:` → `wss://<host>` **sin puerto**
   (Cloudflare termina WSS en 443 y lo reenvía a `127.0.0.1:3000`);
   página `http:` → `ws://<host>:<VITE_WS_PORT|3000>` (desarrollo).

La autenticación no se tocó: `OFFICE_WS_TOKEN` (si está configurado) sigue
exigiéndose vía `?wstoken=` + `onAuth` server-side; el token de control
sigue solo en sessionStorage.

**Validación pendiente del operador (requiere sesión de Cloudflare Access
en navegador)**: abrir `https://gameview.ciudadan.org` y confirmar que la
pilla del header dice «🟢 Sincronizado» y que la consola no muestra errores
de WebSocket. Internamente ya se verificó: conexión WS local ✓, agentes
reales en vivo ✓, cero errores de consola en 5 tamaños ✓.

## 4. Modo «Solo mundo» (FASE 8)

Botón del header: colapsa sidebar, cierra el contextual y Extras; el mundo
ocupa TODO el ancho (verificado: grid `0px 1920px 0px`). Volver (botón ☰,
botón «Solo mundo» o `Escape`) restaura el Centro de Trabajo. Phaser no se
desmonta ni reinicia.

## 5. Pruebas (FASE 12)

- Suite completa: **128/128** (110 previas intactas + 18 nuevas):
  - `wsEndpoint.test.ts` (7): la corrección Cloudflare y sus prioridades.
  - `shellState.test.ts` (11): máquina de estados del shell.
- Validación en navegador real (Playwright + Chromium headless):
  **24/24 checks** — boot, sync WS, agentes reales, 4 secciones, panel
  contextual con evidencia real, Escape, Extras honestamente bloqueado,
  «Solo mundo», 5 viewports sin overflow, cero errores de consola.
- Capturas REALES en `docs/ciudadan/screenshots/` (11 PNG).

Procedimiento de validación manual:
1. SSH: `ssh -L 3000:127.0.0.1:3000 usuario@oracle` → abrir
   `http://localhost:3000`.
2. Confirmar: oficina visible completa, un solo sidebar, sin ventanas
   encimadas, pilla «🟢 Sincronizado».
3. Clic en un personaje → panel contextual con actividad real; `Escape` →
   se cierra.
4. «Solo mundo» → oficina a pantalla completa; volver.
5. En `https://gameview.ciudadan.org` (con sesión de Cloudflare Access):
   repetir 2-4 — el WebSocket debe conectar vía `wss://gameview.ciudadan.org`.

## 6. Despliegue

El servidor de producción sirve `packages/ui/dist` **desde disco**:
`npm run build --workspace=@agent-office/ui` actualiza el sitio público
**sin reiniciar el proceso** (el build de este bloque ya está servido en
`:3000`). No se detuvo ni reinició ningún servicio ni proceso de Cline
durante el bloque.

