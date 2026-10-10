# 🏢 Ciudadan AgentOffice

Interfaz web interactiva para visualizar y controlar hasta **siete agentes Cline reales**, coordinados por DeepSeek Harness (DSH).

> **Base**: fork de [harishkotra/agent-office](https://github.com/harishkotra/agent-office) — commit base `58f11f9b31770c10bcf3d7a0618325d22bd0ee9e` (rama `feature/ciudadan-agentoffice-base`).
> **Licencia**: MIT (se conserva la licencia y atribución originales — ver [LICENSE](./LICENSE)).

---

## ¿Qué es cada modo?

| Modo | Comportamiento | Uso |
|------|----------------|-----|
| `external` (**por defecto**) | La oficina es una *carcasa visual*: sin LLM, sin herramientas, sin agentes autónomos. Los agentes se registran y actualizan exclusivamente a través de la **interfaz externa** (`/api/external`). | Integración DSH/Cline (Bloque 2), visualización de agentes reales |
| `internal` | Comportamiento original de AgentOffice: ciclo de razonamiento Ollama (~15 s/agente), contratación autónoma, tareas autónomas, conversaciones ficticias, ejecución de herramientas, embeddings. | Compatibilidad con el proyecto upstream; requiere Ollama |

El modo se configura con `AGENT_OFFICE_MODE` (ver [`.env.example`](./.env.example)).

## Qué queda DESACTIVADO en modo `external`

- ❌ Ciclos de razonamiento (ninguna llamada a Ollama; el `OllamaAdapter` ni se instancia)
- ❌ Contratación autónoma de agentes (`hire_agent`)
- ❌ Generación autónoma de tareas (`create_task` desde el LLM)
- ❌ Conversaciones ficticias entre agentes
- ❌ Ejecución de herramientas y comandos (`ToolExecutor` no se instancia: ni `code_execute`, ni `web_search`, ni `read_file`)
- ❌ Embeddings de memoria (llamadas a `/api/embeddings` de Ollama)
- ❌ Motor de caos/escenarios y votos de audiencia (eventos narrativos ficticios)
- ❌ Jitter aleatorio de métricas virales (los valores los fija la interfaz externa)

## Qué se CONSERVA siempre

- ✅ Escenario pixel-art original (Phaser): suelo, paredes, salas, plantas, máquinas de café…
- ✅ Animaciones y desplazamiento (los agentes caminan a su puesto asignado)
- ✅ Selección de personajes (clic → cámara sigue + Inspector con datos reales)
- ✅ Paneles React: Chat, Tablero de tareas, Registro de actividad, Inspector, Editor de layout
- ✅ Sincronización en tiempo real vía Colyseus
- ✅ Persistencia SQLite de tareas y layouts
- ✅ **Máximo 7 puestos fijos** (sin expansión dinámica de la oficina)

## Arquitectura resultante (Bloque 1)

```
┌────────────────────────── Navegador ──────────────────────────┐
│  Phaser OfficeScene (pixel-art)  +  React (paneles)          │
└───────────────▲──────────────────────────────▲────────────────┘
                │ Colyseus WebSocket (:3000)  │ REST (proxy /api)
┌───────────────┴──────────────────────────────┴────────────────┐
│  @agent-office/server (Express + Colyseus)                    │
│  ├─ OfficeRoom — modo 'external': sin IA autónoma             │
│  ├─ ExternalBridge → aplica estado y difunde a los paneles    │
│  └─ /api/external/*  ← INTERFAZ EXTERNA (contrato del Bloque 2)
└──────────────────────────▲────────────────────────────────────┘
                           │ (Bloque 2: adaptador DSH/Cline — NO implementado)
                 ┌─────────┴────────┐
                 │  DSH + agentes   │
                 │  Cline reales    │
                 └──────────────────┘
```

Documentación completa de la interfaz externa: [`docs/ciudadan/EXTERNAL_INTERFACE.md`](./docs/ciudadan/EXTERNAL_INTERFACE.md)
Instalación reproducible (máquinas Oracle): [`docs/ciudadan/INSTALL.md`](./docs/ciudadan/INSTALL.md)

## Puertos y variables

| Variable | Defecto | Descripción |
|----------|---------|-------------|
| `AGENT_OFFICE_MODE` | `external` | Modo de orquestación |
| `HOST` | `127.0.0.1` | Interfaz del servidor (solo local por defecto) |
| `PORT` | `3000` | WebSocket Colyseus + REST |
| `UI_HOST` / `UI_PORT` | `127.0.0.1` / `5173` | Servidor Vite (UI) |
| `OLLAMA_URL` | `http://127.0.0.1:11434` | Solo modo `internal` |
| `EXTERNAL_API_ENABLED` | `true` | Acepta updates vía `/api/external` |
| `EXTERNAL_DEMO_MODE` | `false` | ⚠️ Datos de prueba `[DEMO]` (verificación de UI) |
| `DATABASE_PATH` | `./data/office-memory.db` | SQLite |
| `MAX_SEATS` | `7` | Tope duro de puestos (máx. 7) |

## Git

- `origin` → `CiudadanMex/gameview` (fork propio — destino de push)
- `upstream` → `harishkotra/agent-office` (push DESHABILITADO)
- Rama de trabajo del Bloque 1: `feature/ciudadan-agentoffice-base`
