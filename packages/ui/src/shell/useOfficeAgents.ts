import { useEffect, useState } from 'react';
import { getColyseusRoom } from '../game/Game';
import { eventBus } from '../events';

/**
 * Ciudadan GameView — UI/UX Bloque 1 (FASE 3).
 *
 * Real office agents, read straight from the Colyseus room state
 * (the same source of truth Phaser renders). Re-subscribes whenever
 * the connection becomes active again.
 */
export interface OfficeAgentRow {
    id: string;
    name: string;
    role: string;
    status: string;
    currentTask: string;
    thought: string;
}

export function useOfficeAgents(): OfficeAgentRow[] {
    const [agents, setAgents] = useState<OfficeAgentRow[]>([]);

    useEffect(() => {
        let disposed = false;

        const read = () => {
            const room = getColyseusRoom();
            if (!room) return;
            const list: OfficeAgentRow[] = [];
            room.state.agents.forEach((agent: any, id: string) => {
                list.push({
                    id,
                    name: String(agent.name || id),
                    role: String(agent.role || ''),
                    status: String(agent.status || ''),
                    currentTask: String(agent.currentTask || ''),
                    thought: String(agent.thought || '')
                });
            });
            if (!disposed) setAgents(list);
        };

        const onSync = () => { if (!disposed) read(); };
        // Initial read + refresh when the connection turns active and on
        // every state change broadcast by the game engine.
        read();
        const timer = setInterval(read, 5000);
        eventBus.addEventListener('sync-status', onSync as EventListener);

        return () => {
            disposed = true;
            clearInterval(timer);
            eventBus.removeEventListener('sync-status', onSync as EventListener);
        };
    }, []);

    return agents;
}
