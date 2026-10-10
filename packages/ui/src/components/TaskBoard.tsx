import React, { useState, useEffect } from 'react';
import { getColyseusRoom } from '../game/Game';

interface TaskItem {
    id: number;
    title: string;
    assigned_to: string;
    status: string;
}

export function TaskBoard() {
    const [tasks, setTasks] = useState<TaskItem[]>([]);
    const [newTask, setNewTask] = useState('');
    const [targetAgent, setTargetAgent] = useState('auto');
    // Real agents present in the office (Block 2: Cline sessions, etc).
    const [agents, setAgents] = useState<Array<{ id: string; name: string; role: string }>>([]);

    useEffect(() => {
        const checkRoom = setInterval(() => {
            const room = getColyseusRoom();
            if (room) {
                room.onMessage('task-update', (data: any) => {
                    setTasks(prev => {
                        const existing = prev.find(t => t.title === data.task);
                        if (existing) {
                            return prev.map(t => t.title === data.task ? { ...t, status: data.status, assigned_to: data.agentId } : t);
                        }
                        return [...prev, { id: Date.now(), title: data.task, assigned_to: data.agentId, status: data.status }];
                    });
                });
                room.onMessage('tasks-sync', (serverTasks: any[]) => {
                    setTasks(serverTasks.map(t => ({
                        id: t.id,
                        title: t.title,
                        assigned_to: t.assigned_to || '',
                        status: t.status
                    })));
                });
                // Keep the agent selector in sync with the office state.
                room.state.agents.forEach((agent: any, id: string) => {
                    setAgents(prev =>
                        prev.some(a => a.id === id)
                            ? prev
                            : [...prev, { id, name: agent.name, role: agent.role || '' }]
                    );
                });
                room.state.agents.onAdd((agent: any, id: string) => {
                    setAgents(prev =>
                        prev.some(a => a.id === id)
                            ? prev
                            : [...prev, { id, name: agent.name, role: agent.role || '' }]
                    );
                });
                room.state.agents.onRemove((_agent: any, id: string) => {
                    setAgents(prev => prev.filter(a => a.id !== id));
                    if (targetAgent === id) setTargetAgent('auto');
                });
                clearInterval(checkRoom);
            }
        }, 500);
        return () => clearInterval(checkRoom);
    }, []);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTask.trim()) return;
        const room = getColyseusRoom();
        if (room) {
            room.send('assign-task', { title: newTask, agentId: targetAgent === 'auto' ? undefined : targetAgent });
            setNewTask('');
        }
    };

    const statusColor = (s: string) => {
        if (s === 'completed') return '#00b894';
        if (s === 'in_progress') return '#fdcb6e';
        return '#dfe6e9';
    };

    const statusIcon = (s: string) => {
        if (s === 'completed') return '✅';
        if (s === 'in_progress') return '🔄';
        return '⏳';
    };

    return (
        <div style={{
            position: 'absolute', left: 20, top: 20, width: 280,
            backgroundColor: 'rgba(10,10,30,0.92)', color: 'white',
            padding: 16, borderRadius: 12,
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(108,92,231,0.3)',
            maxHeight: '50vh', display: 'flex', flexDirection: 'column'
        }}>
            <h3 style={{ margin: '0 0 10px 0', fontSize: '14px', display: 'flex', alignItems: 'center', gap: 6 }}>
                📋 Task Board
            </h3>

            {/* Task Assignment Form */}
            <form onSubmit={handleSubmit} style={{ marginBottom: 10 }}>
                <input
                    type="text"
                    value={newTask}
                    onChange={(e) => setNewTask(e.target.value)}
                    placeholder="Assign a task..."
                    style={{
                        width: '100%', padding: '8px 10px', borderRadius: 6,
                        border: '1px solid #444', backgroundColor: '#1a1a3e',
                        color: 'white', fontSize: '12px', outline: 'none',
                        boxSizing: 'border-box', marginBottom: 6
                    }}
                />
                <div style={{ display: 'flex', gap: 6 }}>
                    <select
                        value={targetAgent}
                        onChange={(e) => setTargetAgent(e.target.value)}
                        style={{
                            flex: 1, padding: '6px', borderRadius: 6,
                            border: '1px solid #444', backgroundColor: '#1a1a3e',
                            color: '#aaa', fontSize: '11px'
                        }}
                    >
                        <option value="auto">🤖 Auto-assign</option>
                        {agents.map(agent => (
                            <option key={agent.id} value={agent.id}>
                                {agent.name}{agent.role ? ` (${agent.role})` : ''}
                            </option>
                        ))}
                    </select>
                    <button type="submit" style={{
                        padding: '6px 14px', borderRadius: 6, border: 'none',
                        backgroundColor: '#6c5ce7', color: 'white', fontSize: '11px',
                        cursor: 'pointer', fontWeight: 'bold'
                    }}>
                        Assign
                    </button>
                </div>
            </form>

            {/* Task List */}
            <div style={{ flex: 1, overflowY: 'auto', fontSize: '12px' }}>
                {tasks.length === 0 && (
                    <p style={{ color: '#666', fontStyle: 'italic', margin: 0, fontSize: '11px' }}>
                        No tasks yet. Type above to assign work to agents!
                    </p>
                )}
                {tasks.map(task => (
                    <div key={task.id} style={{
                        padding: '6px 8px', marginBottom: 4, borderRadius: 6,
                        backgroundColor: 'rgba(255,255,255,0.05)',
                        borderLeft: `3px solid ${statusColor(task.status)}`
                    }}>
                        <div style={{ fontWeight: 'bold', fontSize: '11px' }}>
                            {statusIcon(task.status)} {task.title}
                        </div>
                        <div style={{ fontSize: '10px', color: '#888', marginTop: 2 }}>
                            → {task.assigned_to || 'Unassigned'}
                        </div>
                    </div>
                ))}
            </div>

            <div style={{ marginTop: 8, fontSize: '10px', color: '#555', borderTop: '1px solid #333', paddingTop: 6 }}>
                🤖 Agentes reales (Cline) • 💾 SQLite
            </div>
        </div>
    );
}
