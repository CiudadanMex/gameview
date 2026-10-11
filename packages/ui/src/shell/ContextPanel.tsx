import React, { useEffect, useState } from 'react';
import { eventBus } from '../events';

/**
 * Ciudadan GameView — UI/UX Bloque 1 (FASE 4/5): contextual panel.
 * Opens ONLY when an agent is selected (world click or Agents list).
 * Shows the real inspector data + access to the instruction flow for
 * controllable (hub-managed) sessions; read-only sessions state it
 * explicitly. Closes with the × button or Escape.
 */

const STATUS_LABELS: Record<string, string> = {
    working: 'Trabajando', editing: 'Editando', reading: 'Leyendo',
    testing: 'Ejecutando pruebas', waiting: 'Esperando respuesta',
    waiting_input: 'Esperando respuesta', blocked: 'Bloqueado',
    completed: 'Completado', offline: 'Desconectado', idle: 'Inactivo',
    running: 'Trabajando', thinking: 'Pensando', acting: 'Trabajando'
};

export interface AgentFocusPayload {
    id: string; name: string; role: string; status: string;
    currentTask: string; thought: string; session: string; error: string;
    activeFile: string; workspace: string; gitBranch: string;
    sessionType: string; lastTool: string; updatedAt: number;
}

export function relTime(updatedAt: number): string {
    if (!updatedAt) return '—';
    const secs = Math.max(0, Math.round((Date.now() - updatedAt) / 1000));
    if (secs < 60) return `hace ${secs}s`;
    return `hace ${Math.round(secs / 60)}min`;
}

export function Row({ label, value, muted }: { label: string; value?: string | null; muted?: boolean }) {
    const missing = !value || value === '';
    return (
        <p style={{ margin: '3px 0', fontSize: '11px', color: muted ? 'var(--gv-muted)' : undefined }}>
            <strong style={{ color: 'var(--gv-lilac)' }}>{label}:</strong>{' '}
            {missing
                ? <span style={{ color: 'var(--gv-faint)', fontStyle: 'italic' }}>no disponible</span>
                : <span style={{ wordBreak: 'break-all' }}>{value}</span>}
        </p>
    );
}

export function ContextPanel({ open, onClose, onGoControl }: {
    open: boolean;
    onClose: () => void;
    onGoControl: () => void;
}) {
    const [agent, setAgent] = useState<AgentFocusPayload | null>(null);

    useEffect(() => {
        const handler = (e: Event) => {
            const detail = (e as CustomEvent).detail as AgentFocusPayload | null;
            setAgent(detail || null);
        };
        eventBus.addEventListener('agent-focus', handler as EventListener);
        return () => eventBus.removeEventListener('agent-focus', handler as EventListener);
    }, []);

    // Relative time refresher while open.
    const [, forceTick] = useState(0);
    useEffect(() => {
        if (!open) return;
        const t = setInterval(() => forceTick(n => n + 1), 5000);
        return () => clearInterval(t);
    }, [open]);

    if (!open) return null;

    return (
        <aside className="gv-context" aria-label="Panel contextual">
            <div className="gv-context-head">
                <div className="gv-context-title">
                    🔍 {agent ? agent.name : 'Agente'}
                </div>
                <button className="gv-btn gv-btn-icon" onClick={onClose} title="Cerrar (Esc)">✕</button>
            </div>

            <div className="gv-context-body">
                {!agent ? (
                    <p className="gv-hint">Esperando datos del agente seleccionado…</p>
                ) : (
                    <>
                        <p style={{ margin: '0 0 8px 0', fontSize: '10px', color: 'var(--gv-muted)' }}>
                            {agent.role || 'Cline'}
                        </p>

                        {/* Derived state */}
                        <div className="gv-card">
                            <p style={{ margin: 0, fontSize: 11 }}>
                                <strong>⚙ Estado:</strong>{' '}
                                <span className={`gv-status-${agent.status}`}>
                                    {STATUS_LABELS[agent.status] || agent.status || '—'}
                                </span>
                            </p>
                            <p style={{ margin: '2px 0 0 0', fontSize: 9, color: 'var(--gv-faint)', fontStyle: 'italic' }}>
                                derivado por reglas de evidencia (docs/ciudadan)
                            </p>
                            <p style={{ margin: '4px 0 0 0', fontSize: 11 }}>
                                <strong>Tarea:</strong>{' '}
                                {agent.currentTask
                                    ? <span style={{ wordBreak: 'break-all' }}>{agent.currentTask}</span>
                                    : <span style={{ color: 'var(--gv-faint)', fontStyle: 'italic' }}>no disponible</span>}
                            </p>
                        </div>

                        {/* Real observed evidence */}
                        <div className="gv-card">
                            <p style={{ margin: 0, fontSize: 10, color: 'var(--gv-ok)' }}>🔎 Actividad real observada</p>
                            <Row label="Última herramienta" value={agent.lastTool} />
                            <Row label="Última actividad" value={agent.updatedAt ? relTime(agent.updatedAt) : ''} />
                            <Row label="Archivo activo" value={agent.activeFile} />
                            <Row label="Tipo de sesión" value={agent.sessionType === 'interactive' ? 'Interactiva' : agent.sessionType} />
                            <Row label="Rama Git" value={agent.gitBranch} />
                            <Row label="Workspace" value={agent.workspace} />
                            <Row label="Sesión" value={agent.session} />
                        </div>

                        {agent.thought && (
                            <div className="gv-card gv-card-muted">
                                <p style={{ margin: 0, fontSize: 10, color: 'var(--gv-muted)' }}>💬 Último mensaje permitido</p>
                                <p style={{ margin: '3px 0 0 0', fontSize: 11 }}>{agent.thought}</p>
                            </div>
                        )}

                        {agent.error && (
                            <p style={{ margin: '0 0 8px 0', padding: '6px 8px', backgroundColor: 'rgba(248,113,113,0.12)', border: '1px solid rgba(248,113,113,0.4)', borderRadius: 8, fontSize: 11 }}>
                                🚨 {agent.error.slice(0, 200)}
                            </p>
                        )}

                        {/* Instruction access */}
                        <div className="gv-card">
                            <p style={{ margin: 0, fontSize: 10, color: 'var(--gv-lilac)' }}>🎮 Control</p>
                            <p style={{ margin: '4px 0', fontSize: 10, color: 'var(--gv-muted)' }}>
                                Las instrucciones solo se envían a sesiones 🎮 gestionadas por hub (reales,
                                con aprobación y credencial). Las sesiones 👁 TUI son de solo lectura.
                            </p>
                            <button className="gv-btn gv-btn-primary" style={{ width: '100%' }}
                                onClick={() => {
                                    eventBus.dispatchEvent(new CustomEvent('instruction-panel:select-agent', {
                                        detail: { id: agent.id }
                                    }));
                                    onGoControl();
                                }}
                                title="Abrir el flujo de instrucciones en el Centro de Trabajo">
                                📝 Instrucciones para este agente
                            </button>
                        </div>

                        <p style={{ margin: 0, fontSize: 9, color: 'var(--gv-faint)', borderTop: '1px solid var(--gv-border)', paddingTop: 6 }}>
                            Origen: observación read-only de sesiones Cline · actualizado {relTime(agent.updatedAt)}
                        </p>
                    </>
                )}
            </div>
        </aside>
    );
}

