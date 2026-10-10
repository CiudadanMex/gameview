import express from 'express';
import { Server } from 'colyseus';
import { createServer } from 'http';
import * as path from 'path';
import { OfficeRoom } from './rooms/OfficeRoom';
import { loadDotEnv, loadConfig, describeConfig } from './config';
import { registerExternalRoutes } from './external/routes';
import { createRealAgentsOrchestrator } from './integrations';

// Load optional .env files (never overrides variables already set in
// the shell): first the repo root, then the current working directory.
loadDotEnv(path.resolve(__dirname, '../../../.env'));
loadDotEnv();
const config = loadConfig();

// Setup Express
const app = express();
app.use(express.json());

// Basic REST API for Office Management
app.get('/api/offices', (req, res) => {
    res.json({
        status: 'ok',
        offices: [],
        mode: config.mode,
        version: 'ciudadan-agentoffice/block-1'
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

// Create HTTP and Colyseus server
const httpServer = createServer(app);
const colyseusServer = new Server({
    server: httpServer,
});

// Define Rooms — the resolved orchestration mode travels with the room.
colyseusServer.define('office', OfficeRoom, { mode: config.mode });

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

