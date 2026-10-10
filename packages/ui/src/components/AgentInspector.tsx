import React, { useState, useEffect } from 'react';
import { eventBus } from '../events';

/**
 * Shows live data of the focused agent (click a sprite to focus, click
 * again to unfocus). In external mode the data comes from the external
 * interface (role, status, task, session, errors).
 */
export function AgentInspector() {
    const [agent, setAgent] = useState<any>(null);

    useEffect(() => {
        const handler = (e: Event) => {
            const detail = (e as CustomEvent).detail;
            setAgent(detail || null);
        };
        eventBus.addEventListener('agent-focus', handler);
        return () => eventBus.removeEventListener('agent-focus', handler);
    }, []);

    if (!agent) return null;

    return (
        <div style={{ position: 'absolute', right: 20, top: 90, width: 260, backgroundColor: 'rgba(0,0,0,0.8)', color: 'white', padding: 16, borderRadius: 8, border: '1px solid rgba(108,92,231,0.3)', zIndex: 10 }}>
            <h3 style={{ margin: '0 0 10px 0', fontSize: '13px' }}>🔍 Inspector: {agent.name}</h3>
            <div style={{ fontSize: '12px' }}>
                {agent.role ? <p style={{ margin: '4px 0' }}><strong>Role:</strong> {agent.role}</p> : null}
                {agent.status ? <p style={{ margin: '4px 0' }}><strong>Status:</strong> {agent.status}</p> : null}
                <p style={{ margin: '4px 0' }}><strong>Current Task:</strong> {agent.currentTask || 'None'}</p>
                {agent.session ? <p style={{ margin: '4px 0' }}><strong>Session:</strong> {agent.session}</p> : null}
                {agent.thought ? (
                    <p style={{ margin: '4px 0', fontStyle: 'italic', color: '#aaa' }}>"{agent.thought.slice(0, 120)}"</p>
                ) : null}
                {agent.error ? (
                    <p style={{ margin: '8px 0 0 0', padding: '6px 8px', backgroundColor: 'rgba(214,48,49,0.25)', border: '1px solid rgba(214,48,49,0.5)', borderRadius: 6, fontSize: '11px' }}>
                        🚨 {agent.error.slice(0, 200)}
                    </p>
                ) : null}
            </div>
        </div>
    );
}
