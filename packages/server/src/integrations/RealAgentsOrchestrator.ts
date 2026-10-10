import {
    ExternalOrchestratorAdapter,
    ExternalAgentExecutionStatus
} from '@agent-office/core';
import { ClineSessionSource } from './cline/ClineSessionSource';
import { ClineSessionSnapshot, ClineAgentState } from './cline/ClineTypes';
import { DshAdapter } from './dsh/DshAdapter';
import { ClineTeamsObserver } from './dsh/ClineTeamsObserver';
import { ServerConfig } from '../config';

/**
 * Ciudadan AgentOffice — Block 2 (FASE D).
 *
 * Connects the REAL observation sources (Cline sessions, Cline teams,
 * DSH slot) to the Block 1 external contract (ExternalBridge). Runs a
 * low-impact polling loop inside the AgentOffice server process:
 *
 *   Cline sessions.db/JSON  ─┐
 *   Cline teams.db          ─┼─► RealAgentsOrchestrator ─► ExternalBridge ─► Colyseus/UI
 *   DSH (slot, pending)     ─┘
 *
 * Guarantees:
 *  - Read-only against every observed system (no Cline/DSH writes ever).
 *  - Stable agent ids (Cline session_id) → no duplicates across polls.
 *  - No fictional agents to fill empty seats.
 *  - Re-attaches automatically when the office room (re)appears.
 *  - Survives source errors by skipping the cycle (keeps last snapshot).
 */

/** Cline state → office ExternalAgentExecutionStatus (1:1 for most). */
function toOfficeStatus(state: ClineAgentState): ExternalAgentExecutionStatus {
    switch (state) {
        case 'idle': return 'idle';
        case 'working': return 'working';
        case 'reading': return 'reading';
        case 'editing': return 'editing';
        case 'testing': return 'testing';
        case 'waiting': return 'waiting';
        case 'blocked': return 'blocked';
        case 'completed': return 'completed';
        case 'offline': return 'offline';
        default: return 'idle';
    }
}

/** Short, human summary of the last known activity (no content). */
function activityThought(session: ClineSessionSnapshot): string {
    const parts: string[] = [];
    if (session.lastToolName) parts.push(session.lastToolName);
    if (session.lastActivityAt) {
        const secs = Math.max(0, Math.round((Date.now() - session.lastActivityAt) / 1000));
        parts.push(secs < 60 ? `actividad hace ${secs}s` : `actividad hace ${Math.round(secs / 60)}min`);
    } else {
        parts.push('sin mensajes observables');
    }
    return parts.join(' · ').slice(0, 120);
}

interface OrchestratorDeps {
    config: ServerConfig;
    source: ClineSessionSource;
    teams: ClineTeamsObserver;
    dsh: DshAdapter;
    /** Resolves the current ExternalBridge (null while no room exists). */
    bridgeResolver: () => ExternalOrchestratorAdapter | null;
    /** Injectable clock for tests. */
    now?: () => number;
}

export class RealAgentsOrchestrator {
    private timer: ReturnType<typeof setInterval> | null = null;
    private ticking = false;
    /** Session ids already registered in the CURRENT room generation. */
    private registered = new Set<string>();
    /** Last office status pushed per session (change detection). */
    private lastStatus = new Map<string, string>();
    /** Bridge instance of the current generation (change → re-register). */
    private bridgeGeneration: ExternalOrchestratorAdapter | null = null;
    private announcedDshState = false;
    private readonly log = (msg: string) => console.log(`[RealAgents] ${msg}`);

    constructor(private readonly deps: OrchestratorDeps) {}

    start(): void {
        if (this.timer) return;
        const interval = this.deps.config.clinePollIntervalMs;
        this.log(
            `started (poll ${interval}ms, source: ${this.deps.source.describe()}, ` +
            `teams: ${this.deps.teams.describe()}, dsh: ${this.deps.dsh.describe()})`
        );
        void this.tick();
        this.timer = setInterval(() => void this.tick(), interval);
    }

    stop(): void {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
            this.log('stopped');
        }
    }

    /** One polling cycle. Never throws (errors keep the last snapshot). */
    async tick(): Promise<void> {
        if (this.ticking) return; // avoid overlapping cycles
        this.ticking = true;
        try {
            const bridge = this.deps.bridgeResolver();
            if (!bridge) return; // office room not created yet — retry later

            // Room generation changed (server/room restart) → re-register.
            if (this.bridgeGeneration !== bridge) {
                this.bridgeGeneration = bridge;
                this.registered.clear();
                this.lastStatus.clear();
                this.announcedDshState = false;
            }

            const sessions = await this.deps.source.listSessions();
            if (sessions.length === 0) return;

            // 1) Register new sessions (stable ids, no fake agents).
            for (const session of sessions) {
                if (this.registered.has(session.sessionId)) continue;
                const result = bridge.registerAgent({
                    id: session.sessionId,
                    name: session.name,
                    role: session.role
                });
                if (result.ok) {
                    this.registered.add(session.sessionId);
                    this.log(`registered ${session.name} (${session.sessionId}) → seat ${result.seat}`);
                } else {
                    this.log(`could not register ${session.sessionId}: ${result.error}`);
                    continue;
                }
                // Initial session info (model, workspace, git branch).
                this.pushSessionInfo(bridge, session);
            }

            // 2) Push state changes + reflect last known activity.
            for (const session of sessions) {
                if (!this.registered.has(session.sessionId)) continue;
                const officeStatus = toOfficeStatus(session.state);
                const changed = this.lastStatus.get(session.sessionId) !== officeStatus;
                this.lastStatus.set(session.sessionId, officeStatus);

                const update = bridge.updateAgentState(session.sessionId, {
                    status: officeStatus,
                    currentTask: session.title,
                    thought: activityThought(session)
                });
                if (!update.ok) {
                    this.log(`state update failed for ${session.sessionId}: ${update.error}`);
                    continue;
                }
                if (changed) {
                    // Announce meaningful transitions in the highlights feed.
                    bridge.pushEvent(session.sessionId, {
                        type: 'session',
                        title: `${session.name}: ${officeStatus}`,
                        body: session.title || ''
                    });
                }
            }

            // 3) Forward NEW sanitized assistant messages to the office chat.
            const texts = await this.deps.source.getNewAssistantTexts(sessions);
            for (const delta of texts) {
                if (!delta.text) continue;
                bridge.pushMessage(delta.sessionId, { content: delta.text });
            }

            // 4) Real team tasks (Cline native teams; NOT DSH — see
            //    ClineTeamsObserver). Only tasks with a registered assignee
            //    hit the TaskBoard; the rest are announced as events.
            const tasks = await this.deps.teams.listTasks();
            for (const task of tasks.slice(0, 10)) {
                if (!task.title) continue;
                const assignee = task.assigneeId && this.registered.has(task.assigneeId)
                    ? task.assigneeId
                    : undefined;
                if (assignee) {
                    bridge.pushTask(assignee, {
                        title: task.title,
                        status: task.status === 'completed' ? 'completed' : 'in_progress'
                    });
                } else {
                    bridge.pushEvent(sessions[0].sessionId, {
                        type: 'task',
                        title: `Task: ${task.title}`,
                        body: `estado=${task.status}${task.assigneeName ? ` · asignado a ${task.assigneeName}` : ' · sin asignar'}`
                    });
                }
            }

            // 5) DSH slot status — announced once per room generation.
            if (!this.announcedDshState) {
                this.announcedDshState = true;
                const dsh = await this.deps.dsh.observe();
                bridge.pushEvent(sessions[0].sessionId, {
                    type: 'info',
                    title: dsh.available ? 'DSH observado' : 'DSH no disponible',
                    body: dsh.available
                        ? dsh.description
                        : 'Los eventos de tareas del orquestador DSH se mostrarán aquí cuando esté instalado.'
                });
                if (!dsh.available) {
                    this.log(`DSH slot: ${dsh.source} (${dsh.description.slice(0, 120)})`);
                }
            }
        } catch (e: any) {
            this.log(`cycle error (kept last snapshot): ${e?.message || e}`);
        } finally {
            this.ticking = false;
        }
    }

    /** Publishes the session summary shown in the Inspector. */
    private pushSessionInfo(bridge: ExternalOrchestratorAdapter, session: ClineSessionSnapshot): void {
        const parts: string[] = [];
        if (session.model) parts.push(`modelo ${session.model}`);
        if (session.interactive) parts.push('sesión interactiva');
        if (session.gitBranch) parts.push(`rama ${session.gitBranch}`);
        if (session.teamName) parts.push(`equipo ${session.teamName}`);
        parts.push(session.workspaceRoot ? `workspace ${session.workspaceRoot}` : `cwd ${session.cwd}`);
        bridge.updateSession(session.sessionId, {
            state: session.state === 'offline' || session.state === 'completed' ? 'stopped' : 'active',
            sessionId: session.shortId,
            details: parts.join(' · ').slice(0, 160)
        });
    }
}
