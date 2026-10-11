import React, { useState, useEffect, useCallback } from 'react';
import { controlJson, getControlToken, setControlToken } from '../controlApi';

/**
 * Block 4 (FASE C) — real-work TaskBoard.
 *
 * Sources are clearly separated (never mixed up):
 *  - 🏗 Propuestas locales (origin 'agentoffice'): created here, always
 *    labeled as proposals; only ORGANIZATIONAL statuses are editable.
 *    They can never appear as assigned/executed without confirmation
 *    from DSH or a validated dispatch (the server enforces it).
 *  - 🔎 Tareas observadas de Cline (read-only, from Cline Teams).
 *  - 🧠 Tareas DSH: shown only when a real DSH provider is connected
 *    (today: explicitly reported as not installed).
 */
interface OfficeTask {
    id: string; title: string; description: string;
    status: string; origin: string; sprintId: string | null;
    dependencies: string[]; createdAt: string;
}
interface ObservedTask {
    id: string; title: string; status: string;
    assignee: string | null; dependencies: string[]; origin: string;
}
interface Sprint { id: string; name: string; goal: string }

const STATUS_META: Record<string, { label: string; color: string; icon: string }> = {
    proposed: { label: 'Propuesta', color: '#a29bfe', icon: '🏗' },
    pending: { label: 'Pendiente', color: '#fdcb6e', icon: '⏳' },
    assigned: { label: 'Asignada', color: '#74b9ff', icon: '👤' },
    in_progress: { label: 'En ejecución', color: '#55efc4', icon: '⚙️' },
    blocked: { label: 'Bloqueada', color: '#ff7675', icon: '🚧' },
    in_review: { label: 'En revisión', color: '#ffeaa7', icon: '🔍' },
    completed: { label: 'Completada', color: '#00b894', icon: '✅' }
};
const EDITABLE = ['proposed', 'pending', 'in_review', 'blocked'];

/**
 * Block 4 (FASE C) — real-work TaskBoard.
 *
 * UI/UX Bloque 1: now an embedded view inside the Work Center
 * sidebar (`view="tasks"` or `view="sprints"`), no floating window.
 *
 * Sources are clearly separated (never mixed up):
 *  - 🏗 Propuestas locales (origin 'agentoffice'): created here, always
 *    labeled as proposals; only ORGANIZATIONAL statuses are editable.
 *    They can never appear as assigned/executed without confirmation
 *    from DSH or a validated dispatch (the server enforces it).
 *  - 🔎 Tareas observadas de Cline (read-only, from Cline Teams).
 *  - 🧠 Tareas DSH: shown only when a real DSH provider is connected
 *    (today: explicitly reported as not installed).
 */
export function TaskBoard({ view = 'tasks' }: { view?: 'tasks' | 'sprints' | 'full' }) {
    const [tasks, setTasks] = useState<OfficeTask[]>([]);
    const [observed, setObserved] = useState<ObservedTask[]>([]);
    const [sprints, setSprints] = useState<Sprint[]>([]);
    const [dsh, setDsh] = useState<{ available: boolean; description: string }>({ available: false, description: '' });
    const [newTask, setNewTask] = useState('');
    const [newSprint, setNewSprint] = useState('');
    const [tokenInput, setTokenInput] = useState('');
    const [message, setMessage] = useState<string | null>(null);
    const [hasToken, setHasToken] = useState(false);

    const refresh = useCallback(async () => {
        const data = await controlJson<{ proposals: OfficeTask[]; observed: ObservedTask[]; sprints: Sprint[]; dsh: any }>(
            '/tasks'
        );
        if (data.ok) {
            setTasks(data.proposals || []);
            setObserved(data.observed || []);
            setSprints(data.sprints || []);
            setDsh(data.dsh || { available: false, description: '' });
        }
        setHasToken(Boolean(getControlToken()));
    }, []);

    useEffect(() => { void refresh(); const t = setInterval(refresh, 10000); return () => clearInterval(t); }, [refresh]);

    const needsAuth = async (fn: () => Promise<{ ok: boolean; error?: string }>): Promise<boolean> => {
        const result = await fn();
        if (!result.ok) {
            setMessage(`⚠️ ${result.error || 'acción no permitida'}`);
            return false;
        }
        setMessage(null);
        void refresh();
        return true;
    };

    const createProposal = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTask.trim()) return;
        const ok = await needsAuth(() => controlJson('/tasks', {
            method: 'POST',
            body: JSON.stringify({ title: newTask.trim(), description: 'Propuesta creada desde AgentOffice (sin confirmar).' })
        }));
        if (ok) setNewTask('');
    };

    const createSprint = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newSprint.trim()) return;
        const ok = await needsAuth(() => controlJson('/sprints', {
            method: 'POST',
            body: JSON.stringify({ name: newSprint.trim(), goal: '' })
        }));
        if (ok) setNewSprint('');
    };

    const changeStatus = async (taskId: string, status: string) => {
        await needsAuth(() => controlJson(`/tasks/${taskId}`, {
            method: 'PATCH',
            body: JSON.stringify({ status })
        }));
    };

    const renderTask = (task: OfficeTask) => {
        const meta = STATUS_META[task.status] || { label: task.status, color: '#888', icon: '•' };
        return (
            <div key={task.id} style={{ padding: '6px 8px', marginBottom: 4, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.05)', borderLeft: `3px solid ${meta.color}` }}>
                <div style={{ fontWeight: 'bold', fontSize: '11px' }}>
                    {meta.icon} {task.title}
                </div>
                <div style={{ fontSize: '10px', color: '#999', marginTop: 2, display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ color: meta.color }}>{meta.label}</span>
                    {task.dependencies.length > 0 && <span>⛓ {task.dependencies.length} dep.</span>}
                </div>
                {EDITABLE.includes(task.status) && (
                    <select
                        value={task.status}
                        onChange={(e) => void changeStatus(task.id, e.target.value)}
                        style={{ marginTop: 4, fontSize: '10px', background: '#1a1a3e', color: '#ccc', border: '1px solid #444', borderRadius: 4, padding: '2px 4px' }}
                    >
                        {EDITABLE.map(s => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
                    </select>
                )}
            </div>
        );
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1, width: '100%' }}>
            {!hasToken ? (
                <form onSubmit={(e) => { e.preventDefault(); if (tokenInput.trim()) { setControlToken(tokenInput.trim()); setHasToken(true); void refresh(); } }}
                    className="gv-card" style={{ padding: '8px 10px', marginBottom: 8, background: 'rgba(251,191,36,0.06)', borderColor: 'rgba(251,191,36,0.3)' }}>
                    <p style={{ margin: '0 0 5px 0', fontSize: '10px', color: 'var(--gv-warn)' }}>
                        🔑 Credencial de control — solo para acciones de escritura (se guarda en esta
                        pestaña, nunca en disco):
                    </p>
                    <div style={{ display: 'flex', gap: 4 }}>
                        <input type="password" value={tokenInput} onChange={(e) => setTokenInput(e.target.value)}
                            placeholder="AGENTOFFICE_CONTROL_TOKEN…"
                            className="gv-input" style={{ flex: 1 }} />
                        <button type="submit" className="gv-btn gv-btn-primary">OK</button>
                    </div>
                </form>
            ) : null}

            {message && <p style={{ margin: '0 0 6px 0', fontSize: '10px', color: 'var(--gv-err)' }}>{message}</p>}

            {(view === 'tasks' || view === 'full') && (
                <>
                    <form onSubmit={createProposal} style={{ marginBottom: 8 }}>
                        <input value={newTask} onChange={(e) => setNewTask(e.target.value)}
                            placeholder="Nueva propuesta de tarea…"
                            className="gv-input" />
                        <button type="submit" className="gv-btn" style={{ marginTop: 4, width: '100%' }}>
                            🏗 Crear propuesta (requiere confirmación externa)
                        </button>
                    </form>

                    <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', fontSize: '12px' }}>
                        {(['proposed', 'in_progress', 'blocked', 'in_review', 'completed'] as const)
                            .filter(st => tasks.some(t => !t.sprintId && t.status === st))
                            .map(st => (
                                <div key={st}>
                                    <p style={{ margin: '8px 0 4px 0', fontSize: '10px', fontWeight: 700, color: STATUS_META[st].color }}>
                                        {STATUS_META[st].icon} {STATUS_META[st].label}s · backlog
                                    </p>
                                    {tasks.filter(t => !t.sprintId && t.status === st).map(renderTask)}
                                </div>
                            ))}
                        {tasks.filter(t => !t.sprintId).length === 0 && (
                            <p className="gv-hint">Sin propuestas aún. Las propuestas son organizativas: nunca se
                                muestran como ejecutadas sin confirmación del proveedor correspondiente (DSH o envío validado).</p>
                        )}

                        {observed.length > 0 && (
                            <>
                                <p style={{ margin: '12px 0 4px 0', fontSize: '10px', fontWeight: 700, color: '#7fcdaa' }}>🔎 Observadas de Cline (solo lectura)</p>
                                {observed.map(t => (
                                    <div key={t.id} style={{ padding: '4px 8px', marginBottom: 3, borderRadius: 6, background: 'rgba(0,184,148,0.06)', fontSize: '11px' }}>
                                        {t.title} <span style={{ color: 'var(--gv-muted)', fontSize: '10px' }}>· {t.status}</span>
                                    </div>
                                ))}
                            </>
                        )}

                        <p style={{ margin: '10px 0 0 0', fontSize: '9px', color: 'var(--gv-faint)', borderTop: '1px solid var(--gv-border)', paddingTop: 6 }}>
                            🧠 DSH: {dsh.available ? 'conectado' : 'no instalado'} — {dsh.available ? 'fuente de verdad de sus tareas' : 'las tareas DSH aparecerán cuando se despliegue'}
                        </p>
                    </div>
                </>
            )}

            {(view === 'sprints' || view === 'full') && (
                <>
                    <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', fontSize: '12px' }}>
                        {sprints.length === 0 && (
                            <p className="gv-hint">Sin sprints. Crea uno para agrupar propuestas (por ejemplo
                                «Sprint 1 — MVP web»); las dependencias de cada tarea se muestran junto a ella.</p>
                        )}
                        {sprints.map(sprint => (
                            <div key={sprint.id} style={{ marginBottom: 10 }}>
                                <p style={{ margin: '0 0 4px 0', fontSize: '11px', color: 'var(--gv-lilac)', fontWeight: 'bold' }}>🏃 {sprint.name}</p>
                                {tasks.filter(t => t.sprintId === sprint.id).map(renderTask)}
                                {tasks.filter(t => t.sprintId === sprint.id).length === 0 && (
                                    <p style={{ color: 'var(--gv-faint)', fontSize: '10px', fontStyle: 'italic', margin: '0 0 0 8px' }}>sin tareas</p>
                                )}
                            </div>
                        ))}
                    </div>

                    <form onSubmit={createSprint} style={{ marginTop: 8, display: 'flex', gap: 4 }}>
                        <input value={newSprint} onChange={(e) => setNewSprint(e.target.value)}
                            placeholder="Nuevo sprint…"
                            className="gv-input" style={{ flex: 1 }} />
                        <button type="submit" className="gv-btn">+</button>
                    </form>
                </>
            )}
        </div>
    );
}
