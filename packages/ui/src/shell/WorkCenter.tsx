import React from 'react';
import { eventBus } from '../events';
import { ShellSection } from './shellState';
import { useOfficeAgents } from './useOfficeAgents';
import { TaskBoard } from '../components/TaskBoard';
import { InstructionPanel } from '../components/InstructionPanel';

/**
 * Ciudadan GameView — UI/UX Bloque 1 (FASE 3): the Work Center.
 * ONE sidebar panel with internal navigation — Agents, Tasks, Sprints
 * and Control. Only the active section renders (no simultaneous
 * information dump); sections keep their own state because each one
 * is a distinct component instance that stays mounted.
 */

const SECTIONS: Array<{ id: ShellSection; icon: string; label: string; hint: string }> = [
    { id: 'agents', icon: '👥', label: 'Agentes', hint: 'Sesiones Cline reales en la oficina. Haz clic para enfocar a un personaje.' },
    { id: 'tasks', icon: '📋', label: 'Tareas', hint: 'Propuestas locales + tareas observadas de Cline (solo lectura). Una propuesta nunca aparece como ejecutada sin confirmación externa.' },
    { id: 'sprints', icon: '🏃', label: 'Sprints', hint: 'Agrupa propuestas en sprints con dependencias visibles.' },
    { id: 'control', icon: '🎮', label: 'Control', hint: 'Instrucciones a sesiones 🎮 gestionadas por hub: borrador → aprobación → envío autorizado → respuesta real. Las sesiones TUI (👁) son de solo lectura.' }
];

const STATUS_COLORS: Record<string, string> = {
    working: '#4ade80', editing: '#f472b6', reading: '#60a5fa',
    testing: '#fbbf24', waiting: '#c4b5fd', waiting_input: '#c4b5fd',
    blocked: '#f87171', completed: '#34d399', offline: '#6d6499', idle: '#9b93c7',
    running: '#4ade80', thinking: '#c4b5fd', acting: '#4ade80', error: '#f87171'
};

export function WorkCenter({ section, onSection, selectedAgentId, onSelectAgent }: {
    section: ShellSection;
    onSection: (s: ShellSection) => void;
    selectedAgentId: string | null;
    onSelectAgent: (id: string) => void;
}) {
    const agents = useOfficeAgents();
    const activeHint = SECTIONS.find(s => s.id === section)?.hint || '';

    const focusAgent = (id: string) => {
        // Focus the character in the world + open the contextual panel.
        eventBus.dispatchEvent(new CustomEvent('agent-focus-request', { detail: { id } }));
        onSelectAgent(id);
    };

    return (
        <aside className="gv-sidebar" aria-label="Centro de Trabajo">
            <nav className="gv-nav" role="tablist">
                {SECTIONS.map(s => (
                    <button key={s.id}
                        className="gv-nav-btn"
                        data-active={section === s.id}
                        onClick={() => onSection(s.id)}
                        role="tab"
                        aria-selected={section === s.id}
                        title={s.hint}>
                        <span className="gv-nav-icon">{s.icon}</span>
                        <span>{s.label}</span>
                    </button>
                ))}
            </nav>

            <div className="gv-section" role="tabpanel">
                <div className="gv-hint">{activeHint}</div>

                {section === 'agents' && (
                    <>
                        {agents.length === 0 && (
                            <p className="gv-hint">
                                Sin agentes visibles todavía. Las sesiones Cline reales aparecen aquí al
                                ser detectadas (observación read-only); también puedes lanzar sesiones
                                gestionadas desde la sección 🎮 Control.
                            </p>
                        )}
                        {agents.map(a => (
                            <button key={a.id} className="gv-agent-row"
                                data-selected={a.id === selectedAgentId}
                                onClick={() => focusAgent(a.id)}>
                                <span className="gv-dot"
                                    style={{ color: STATUS_COLORS[a.status] || '#9b93c7' }}
                                    title={a.status} />
                                <span className="gv-row-main">
                                    <span className="gv-agent-name">{a.name}</span>
                                    <span className="gv-agent-task">{a.currentTask || a.role || a.status}</span>
                                </span>
                            </button>
                        ))}
                    </>
                )}

                {section === 'tasks' && <TaskBoard view="tasks" />}
                {section === 'sprints' && <TaskBoard view="sprints" />}
                {section === 'control' && <InstructionPanel embedded={true} />}
            </div>

            <div className="gv-sidebar-footer">
                Estados auténticos · sin simulaciones · auditoría activa
            </div>
        </aside>
    );
}
