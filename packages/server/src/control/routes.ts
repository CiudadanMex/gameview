import { Express, Request, Response, NextFunction } from 'express';
import { ServerConfig } from '../config';
import { ClineControlAdapter, InstructionService, AuditLog } from '../integrations/control';
import { TaskProvider, OfficeTaskStatus } from '../integrations/tasks/TaskStore';
import { DshTaskProvider } from '../integrations/dsh/DshTaskProvider';
import { ClineTeamsObserver } from '../integrations/dsh/ClineTeamsObserver';
import { OfficeRoom } from '../rooms/OfficeRoom';

/**
 * Block 4 — REST surface of the interactive control center.
 *
 * Authorization model (FASE F):
 *  - READ endpoints (GET) are open on localhost (same trust boundary
 *    as the rest of the office).
 *  - WRITE endpoints REQUIRE the server-side control credential in the
 *    `X-AgentOffice-Control-Token` header. When the credential is not
 *    configured, writes answer 503 — they never open silently. A React
 *    confirmation is never treated as authorization.
 *  - Every action is audited; responses never contain secrets.
 */

export interface ControlRuntime {
    adapter: ClineControlAdapter;
    instructions: InstructionService;
    audit: AuditLog;
    tasks: TaskProvider;
    dsh: DshTaskProvider;
    clineTeams: ClineTeamsObserver;
}

export function registerControlRoutes(app: Express, config: ServerConfig, runtime: ControlRuntime): void {
    const requireWriteAuth = (req: Request, res: Response, next: NextFunction) => {
        if (!config.controlToken) {
            res.status(503).json({
                ok: false,
                error: 'Control deshabilitado: falta la credencial de control del servidor (AGENTOFFICE_CONTROL_TOKEN).'
            });
            return;
        }
        // Canonical header name: X-AgentOffice-Control-Token.
        const header = req.header('x-agentoffice-control-token') || '';
        const auth = (req.header('authorization') || '').replace(/^Bearer\s+/i, '');
        if (header !== config.controlToken && auth !== config.controlToken) {
            res.status(401).json({ ok: false, error: 'Credencial de control inválida.' });
            return;
        }
        next();
    };

    // ── READ: capabilities (what is really enabled and why) ──
    app.get('/api/control/capabilities', async (req: Request, res: Response) => {
        const caps = await runtime.adapter.getCapabilities();
        const bridge = OfficeRoom.getActiveRoom()?.getExternalBridge();
        res.json({
            ok: true,
            controlEnabled: Boolean(config.controlToken),
            dispatchConfigEnabled: config.instructionDispatchEnabled,
            capabilities: caps,
            agents: bridge
                ? bridge.getStatus().agents.map(a => ({ id: a.id, name: a.name, status: a.status }))
                : [],
            dsh: runtime.dsh.describe()
        });
    });

    // ── READ: instructions ──
    app.get('/api/control/instructions', (req: Request, res: Response) => {
        res.json({ ok: true, instructions: runtime.instructions.list() });
    });

    // ── WRITE: create draft (idempotent by requestId) ──
    app.post('/api/control/instructions', requireWriteAuth, (req: Request, res: Response) => {
        const { requestId, sessionId, prompt } = req.body || {};
        const result = runtime.instructions.create({
            requestId: String(requestId || ''),
            sessionId: String(sessionId || ''),
            prompt: String(prompt || ''),
            actor: 'operator'
        });
        if (!result.ok) { res.status(400).json(result); return; }
        res.status(result.duplicated ? 200 : 201).json(result);
    });

    // ── WRITE: submit for approval ──
    app.post('/api/control/instructions/:requestId/submit', requireWriteAuth, (req: Request, res: Response) => {
        const result = runtime.instructions.submit(req.params.requestId, 'operator');
        if (!result.ok) { res.status(400).json(result); return; }
        res.json(result);
    });

    // ── WRITE: approve (server-side human authorization) ──
    app.post('/api/control/instructions/:requestId/approve', requireWriteAuth, async (req: Request, res: Response) => {
        const result = await runtime.instructions.approve(req.params.requestId, 'operator');
        if (!result.ok) { res.status(400).json(result); return; }
        res.json(result);
    });

    // ── WRITE: reject ──
    app.post('/api/control/instructions/:requestId/reject', requireWriteAuth, (req: Request, res: Response) => {
        const result = runtime.instructions.reject(
            req.params.requestId, 'operator', String((req.body || {}).reason || '')
        );
        if (!result.ok) { res.status(400).json(result); return; }
        res.json(result);
    });

    // ── READ: tasks (proposals + observed Cline teams + DSH state) ──
    app.get('/api/control/tasks', async (req: Request, res: Response) => {
        const [proposals, observed, sprints] = await Promise.all([
            runtime.tasks.listTasks(),
            runtime.clineTeams.listTasks(),
            runtime.tasks.listSprints()
        ]);
        const dshAvailable = await runtime.dsh.available();
        res.json({
            ok: true,
            proposals,
            observed: observed.map(t => ({
                id: t.id, title: t.title, status: t.status,
                assignee: t.assigneeId, dependencies: t.dependsOn, origin: 'cline' as const
            })),
            sprints,
            dsh: { available: dshAvailable, description: runtime.dsh.describe() }
        });
    });

    // ── WRITE: create a proposal ──
    app.post('/api/control/tasks', requireWriteAuth, async (req: Request, res: Response) => {
        try {
            const task = await runtime.tasks.createProposal({
                title: String((req.body || {}).title || ''),
                description: String((req.body || {}).description || '')
            });
            res.status(201).json({ ok: true, task });
        } catch (e: any) {
            res.status(400).json({ ok: false, error: String(e?.message || e) });
        }
    });

    // ── WRITE: update proposal status (organizational only) ──
    app.patch('/api/control/tasks/:id', requireWriteAuth, async (req: Request, res: Response) => {
        try {
            const task = await runtime.tasks.updateStatus(
                req.params.id, String((req.body || {}).status || '') as OfficeTaskStatus
            );
            if (!task) { res.status(404).json({ ok: false, error: 'Tarea no encontrada.' }); return; }
            res.json({ ok: true, task });
        } catch (e: any) {
            res.status(400).json({ ok: false, error: String(e?.message || e) });
        }
    });

    // ── WRITE: sprints ──
    app.post('/api/control/sprints', requireWriteAuth, async (req: Request, res: Response) => {
        try {
            const sprint = await runtime.tasks.createSprint({
                name: String((req.body || {}).name || ''),
                goal: String((req.body || {}).goal || '')
            });
            res.status(201).json({ ok: true, sprint });
        } catch (e: any) {
            res.status(400).json({ ok: false, error: String(e?.message || e) });
        }
    });

    app.post('/api/control/tasks/:id/sprint', requireWriteAuth, async (req: Request, res: Response) => {
        const sprintId = (req.body || {}).sprintId || null;
        const task = await runtime.tasks.assignToSprint(req.params.id, sprintId ? String(sprintId) : null);
        if (!task) { res.status(404).json({ ok: false, error: 'Tarea no encontrada.' }); return; }
        res.json({ ok: true, task });
    });

    // ── READ: audit tail (sanitized; accountability) ──
    app.get('/api/control/audit', (req: Request, res: Response) => {
        res.json({ ok: true, entries: runtime.audit.tail(50) });
    });

    console.log('[Server] Control center REST registered under /api/control ' +
        `(writes ${config.controlToken ? 'require control token' : 'DISABLED — no server credential configured'}).`);
}