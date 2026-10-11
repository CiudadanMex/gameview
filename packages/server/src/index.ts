import express from 'express';
import { Server } from 'colyseus';
import { createServer } from 'http';
import * as path from 'path';
import * as fs from 'fs';
import { OfficeRoom } from './rooms/OfficeRoom';
import { loadDotEnv, loadConfig, describeConfig } from './config';
import { registerExternalRoutes } from './external/routes';
import { createRealAgentsOrchestrator } from './integrations';
import { createControlRuntime } from './integrations/control';
import { registerControlRoutes } from './control/routes';
import { LocalTaskStore } from './integrations/tasks/TaskStore';
import { UnavailableDshTaskProvider } from './integrations/dsh/DshTaskProvider';
import { ClineTeamsObserver } from './integrations/dsh/ClineTeamsObserver';

// Load optional .env files (never overrides variables already set in
// the shell): first the repo root, then the current working directory.
loadDotEnv(path.resolve(__dirname, '../../../.env'));
loadDotEnv();
const config = loadConfig();

// Setup Express
const app = express();
app.use(express.json());

// Block 5 (FASE E): origin protection for non-loopback deployments.
// Same-origin/local requests carry no Origin header (or an allowed
// one); anything else is rejected unless ALLOWED_ORIGIN matches.
app.use((req, res, next) => {
    const isLoopback = config.host === '127.0.0.1' || config.host === 'localhost' || config.host === '::1';
    const origin = req.header('origin');
    if (isLoopback || !origin) { next(); return; }
    if (config.allowedOrigin && origin === config.allowedOrigin) { next(); return; }
    res.status(403).json({ ok: false, error: 'Origin no autorizado.' });
    return;
});

// Basic REST API for Office Management
app.get('/api/offices', (req, res) => {
    res.json({
        status: 'ok',
        offices: [],
        mode: config.mode,
        version: 'ciudadan-agentoffice/block-5'
    });
});

// Block 5 (FASE F): lightweight health endpoint for supervisors,
// Docker HEALTHCHECK and uptime probes.
app.get('/api/health', (req, res) => {
    res.json({
        ok: true,
        mode: config.mode,
        uptime: Math.round(process.uptime()),
        timestamp: new Date().toISOString()
    });
});

app.post('/api/vote-chaos', (req, res) => {
    const room = OfficeRoom.getActiveRoom();
    if (!room) {
        res.status(503).json({ ok: false, error: 'No active office room.' });
        return;
    }
    const { event, voterId } = req.body || {};
    const result = room.registerAudienceVote(event || 'server_outage', voterId);
    if (!result.accepted) {
        res.status(409).json({ ok: false, ...result });
        return;
    }
    res.json({ ok: true, ...result });
});

app.get('/api/episode-recap', (req, res) => {
    const room = OfficeRoom.getActiveRoom();
    if (!room) {
        res.status(503).json({ ok: false, error: 'No active office room.' });
        return;
    }
    res.json({ ok: true, recap: room.getEpisodeRecap() });
});

// External orchestration interface (Ciudadan AgentOffice).
// Served only on the same local server; requires external mode for writes.
registerExternalRoutes(app, config);

// ─── Block 4: interactive control center ───
// Task proposals live in their OWN store (swappable by a real DSH
// provider later); observed Cline Teams tasks are read-only.
const controlRuntime = createControlRuntime(config);
registerControlRoutes(app, config, {
    adapter: controlRuntime.adapter,
    instructions: controlRuntime.instructions,
    audit: controlRuntime.audit,
    tasks: new LocalTaskStore('./data/office-tasks.db'),
    dsh: new UnavailableDshTaskProvider(),
    clineTeams: new ClineTeamsObserver(config.clineDataDir),
    launcher: controlRuntime.launcher
});

// Create HTTP and Colyseus server
const httpServer = createServer(app);
const colyseusServer = new Server({
    server: httpServer,
});

// Define Rooms — the resolved orchestration mode travels with the room.
colyseusServer.define('office', OfficeRoom, { mode: config.mode });

// Block 5 (FASE F): production mode — a single process serves the
// compiled UI (packages/ui/dist) alongside the API/WebSocket, so the
// MVP does not depend on the Vite dev server.
const uiDist = path.resolve(__dirname, '../../ui/dist');
if (fs.existsSync(path.join(uiDist, 'index.html'))) {
    app.use(express.static(uiDist));
    // SPA fallback: any non-/api route serves the app.
    app.get(/^\/(?!api\/).*/, (req, res) => {
        res.sendFile(path.join(uiDist, 'index.html'));
    });
    console.log('[Server] Production UI served from packages/ui/dist (single-process mode).');
}

// Start listening — bound to config.host (127.0.0.1 by default,
// so nothing is exposed publicly unless explicitly configured).
colyseusServer.listen(config.port, config.host).then(() => {
    console.log(`[Server] AgentOffice Engine listening on ws://${config.host}:${config.port}`);
    console.log(`[Server] ${describeConfig(config)}`);
    if (config.mode === 'external') {
        console.log('[Server] No LLM inference, tools or autonomous actions will run.');
        // ─── Block 2: observe REAL Cline sessions (read-only) ───
        if (config.realAgentsEnabled) {
            const orchestrator = createRealAgentsOrchestrator(config);
            orchestrator.start();
            const shutdown = () => { orchestrator.stop(); process.exit(0); };
            process.on('SIGINT', shutdown);
            process.on('SIGTERM', shutdown);
        } else {
            console.log('[Server] Real agents integration disabled (REAL_AGENTS_ENABLED=false).');
        }
    }
});

