# Instalación de Ciudadan AgentOffice (máquinas Oracle)

> Guía reproducible para instalar una instancia independiente de AgentOffice por desarrollador, en la misma máquina donde corren su DSH y sus agentes Cline. Todo escucha **solo en 127.0.0.1** (sin exposición pública).

## Requisitos

| Requisito | Versión verificada | Nota |
|-----------|--------------------|------|
| Node.js | v22.x (verificado: v22.23.3) | `node -v` |
| npm | 10.x (verificado: 10.9.9) | viene con Node |
| Git + clave SSH de GitHub | — | clave `ciudadan-agentoffice-agents` añadida a la cuenta |
| Ollama | **NO necesario** | solo para modo `internal` |
| Redis / Docker | **NO necesarios** | no se usan |

## 1. Clonar el fork propio

```bash
cd ~/   # o el directorio de trabajo que prefieras
git clone git@github.com:CiudadanMex/gameview.git agent-office
cd agent-office
git checkout feature/ciudadan-agentoffice-base   # rama del Bloque 1
```

Remotes ya configurados en el fork: `origin` → `CiudadanMex/gameview` (push), `upstream` → `harishkotra/agent-office` (push bloqueado).

## 2. Instalar dependencias

```bash
npm ci          # instala los 5 workspaces (core, adapters, server, ui, cli)
```

> No se instala ningún modelo de Ollama, no se levanta Redis ni Docker.

## 3. Configurar variables (opcional)

```bash
cp .env.example .env
# Editar puertos si ya están ocupados:
#   PORT (defecto 3000) y UI_PORT (defecto 5173)
```

Variables clave (todas con valores por defecto seguros):
- `AGENT_OFFICE_MODE=external` — modo desacoplado (sin LLM)
- `HOST=127.0.0.1`, `PORT=3000` — servidor Colyseus+REST
- `UI_HOST=127.0.0.1`, `UI_PORT=5173` — UI (Vite)
- `EXTERNAL_DEMO_MODE=false` — datos de prueba `[DEMO]` (solo para verificar la UI)

## 4. Compilar

```bash
npm run build      # compila todos los workspaces en orden
npm test           # ejecuta los tests (core, adapters, server)
```

## 5. Arrancar (modo externo)

Terminal A — servidor (Colyseus + REST en 127.0.0.1:3000):

```bash
npm run start --workspace=@agent-office/server
# [Server] AgentOffice Engine listening on ws://127.0.0.1:3000
# [Server] mode=external ... seats=7 ... demoData=off
```

Terminal B — interfaz (Vite en 127.0.0.1:5173):

```bash
npm run dev --workspace=@agent-office/ui
```

> La sala `office` se crea al abrir la UI por primera vez. En modo externo NO se destruye al cerrar el navegador, así que los agentes registrados persisten mientras viva el proceso del servidor.

## 6. Acceso privado

- **Local (en la máquina)**: <http://127.0.0.1:5173>
- **Desde tu equipo vía SSH** (túnel):

```bash
ssh -L 5173:127.0.0.1:5173 -L 3000:127.0.0.1:3000 usuario@maquina-oracle
# luego abre http://localhost:5173 en tu navegador
```

## 7. Verificación rápida

```bash
# Salud del servidor + modo
curl -s http://127.0.0.1:3000/api/offices
# → {"status":"ok","offices":[],"mode":"external",...}

# Interfaz externa (tras abrir la UI una vez)
curl -s http://127.0.0.1:3000/api/external/status
```

Prueba con datos de prueba (opcional, claramente identificados como `[DEMO]`):

```bash
EXTERNAL_DEMO_MODE=true npm run start --workspace=@agent-office/server
# Verás 7 agentes [DEMO] caminando a sus puestos
```

## 8. Convivencia con DSH/Cline

- El servidor (3000) y la UI (5173) **no interfieren** con DSH/Cline (hub en 127.0.0.1:25463) ni con sus sesiones tmux.
- No se modifica ni reinicia ningún servicio ajeno al proyecto.
- El modo `external` no hace llamadas de red salvo localhost (sin LLM, sin búsquedas web).

## 9. Mantener sincronizado con upstream

```bash
git fetch upstream
git merge upstream/main     # en la rama que toque, nunca en main directamente
```
