import React, { useEffect, useState } from 'react';
import { eventBus } from '../events';
import { useOfficeAgents } from './useOfficeAgents';

/**
 * Ciudadan GameView — UI/UX Bloque 1 (FASE 2): top header.
 * Brand · office · live agent count · connection state · fullscreen ·
 * extras & focus-mode controls.
 */

export type SyncState = 'connecting' | 'connected' | 'active' | 'failed';

interface SyncStatusEvent {
    state: SyncState;
    label: string;
    endpoint: string;
}

export function Header({ focusMode, onToggleFocus, onToggleSidebar, onOpenExtras }: {
    focusMode: boolean;
    onToggleFocus: () => void;
    onToggleSidebar: () => void;
    onOpenExtras: () => void;
}) {
    const agents = useOfficeAgents();
    const [sync, setSync] = useState<SyncStatusEvent>({ state: 'connecting', label: 'Conectando…', endpoint: '' });

    useEffect(() => {
        const handler = (e: Event) => {
            const detail = (e as CustomEvent).detail as SyncStatusEvent;
            if (detail) setSync(detail);
        };
        eventBus.addEventListener('sync-status', handler as EventListener);
        return () => eventBus.removeEventListener('sync-status', handler as EventListener);
    }, []);

    const activeCount = agents.filter(a => !['offline', 'completed'].includes(a.status)).length;

    const syncPillClass = sync.state === 'active' ? 'gv-pill gv-pill-ok'
        : sync.state === 'failed' ? 'gv-pill gv-pill-err'
        : 'gv-pill gv-pill-warn';
    const syncIcon = sync.state === 'active' ? '🟢' : sync.state === 'failed' ? '🔴' : '🟡';

    const toggleFullscreen = () => {
        if (document.fullscreenElement) void document.exitFullscreen();
        else void document.documentElement.requestFullscreen?.();
    };

    return (
        <header className="gv-header">
            <button className="gv-btn gv-btn-icon" onClick={onToggleSidebar}
                title={focusMode ? 'Volver al Centro de Trabajo' : 'Mostrar/ocultar Centro de Trabajo'}>
                ☰
            </button>

            <div className="gv-brand">
                <span className="gv-brand-badge">🏢</span>
                <span>
                    Ciudadan <span style={{ color: 'var(--gv-lilac)' }}>GameView</span>
                    <div className="gv-brand-sub">oficina de agentes Cline reales</div>
                </span>
            </div>

            <div className="gv-header-divider" />

            <div className="gv-header-meta">
                <span className="gv-pill" title="Agentes activos ahora (estados reales)">
                    👥 {activeCount} activo{activeCount === 1 ? '' : 's'}
                    <span style={{ color: 'var(--gv-faint)' }}>/ {agents.length}</span>
                </span>
                <span className={syncPillClass} title={sync.endpoint ? `WebSocket: ${sync.endpoint}` : sync.label}>
                    {syncIcon} {sync.state === 'active' ? 'Sincronizado' : sync.label}
                </span>
            </div>

            <div className="gv-spacer" />

            <button
                className={`gv-btn ${focusMode ? 'gv-btn-active' : ''}`}
                onClick={onToggleFocus}
                title="Modo enfoque: solo el mundo, sin paneles (cámara intacta)">
                🖼 Solo mundo
            </button>
            <button className="gv-btn gv-btn-icon" onClick={onOpenExtras}
                title="Extras: paneles secundarios (Recap, Pulso, Highlights, Showrunner, Layout, Log, Chat, Relaciones)">
                ⚙ Extras
            </button>
            <button className="gv-btn gv-btn-icon" onClick={toggleFullscreen} title="Pantalla completa">
                ⛶
            </button>
        </header>
    );
}
