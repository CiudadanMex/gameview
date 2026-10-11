import React, { useEffect, useReducer, useRef } from 'react';
import './shell/shell.css';
import { shellReducer, initialShellState, ShellSection } from './shell/shellState';
import { Header } from './shell/Header';
import { WorkCenter } from './shell/WorkCenter';
import { ContextPanel } from './shell/ContextPanel';
import { ExtrasDrawer } from './shell/ExtrasDrawer';
import { eventBus } from './events';
import { setupPhaser, getPhaserGame } from './game/Game';

/**
 * Ciudadan GameView — UI/UX Bloque 1 (FASE 2): app shell.
 *
 *  ┌───────────── HEADER (brand · agents · sync · fullscreen) ─────────────┐
 *  │ SIDEBAR (Centro de   │  MUNDO PHASER (domina, sin paneles   │ PANEL   │
 *  │ Trabajo: Agentes ·   │  flotantes permanentes encima)       │ CONTEXT │
 *  │ Tareas · Sprints ·   │                                     │ (sel.)  │
 *  │ Control)             │                                     │         │
 *  └──────────────────────┴─────────────────────────────────────┴─────────┘
 *  + Extras drawer (oculto por defecto) + "Solo mundo" (modo enfoque).
 *
 * The world mounts ONCE (never remounts when panels toggle); a
 * ResizeObserver keeps the Phaser canvas at the size of its container
 * using the existing Phaser.Scale capabilities (no scene changes).
 */

export function App() {
    const [state, dispatch] = useReducer(shellReducer, initialShellState);
    const worldRef = useRef<HTMLDivElement>(null);

    // ── Boot Phaser once, inside the world area ──────────────────
    useEffect(() => {
        setupPhaser('phaser-container');
    }, []);

    // ── Keep the Phaser canvas sized to its container ────────────
    useEffect(() => {
        const world = worldRef.current;
        if (!world) return;
        const apply = () => {
            const game = getPhaserGame();
            const w = Math.max(64, world.clientWidth);
            const h = Math.max(64, world.clientHeight);
            game?.scale.resize(w, h);
        };
        apply();
        const observer = new ResizeObserver(apply);
        observer.observe(world);
        return () => observer.disconnect();
    }, []);

    // ── World agent clicks ↔ shell state ─────────────────────────
    useEffect(() => {
        const handler = (e: Event) => {
            const detail = (e as CustomEvent).detail as { id: string } | null;
            if (detail?.id) dispatch({ type: 'select-agent', agentId: detail.id });
            else dispatch({ type: 'select-agent', agentId: null });
        };
        eventBus.addEventListener('agent-focus', handler as EventListener);
        return () => eventBus.removeEventListener('agent-focus', handler as EventListener);
    }, []);

    // ── Escape closes panels / exits focus mode ───────────────────
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            const tag = (e.target as HTMLElement)?.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
            if (e.key === 'Escape') {
                // Unfocus the world character so the panel stays closed
                // (the game keeps emitting payloads while focused).
                eventBus.dispatchEvent(new CustomEvent('agent-unfocus-request'));
                dispatch({ type: 'keyboard', key: 'Escape' });
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, []);

    const goControl = () => {
        dispatch({ type: 'select-section', section: 'control' as ShellSection });
    };

    return (
        <div className="gv-shell">
            <Header
                focusMode={state.focusMode}
                onToggleFocus={() => dispatch({ type: 'toggle-focus' })}
                onToggleSidebar={() => dispatch({ type: 'toggle-sidebar' })}
                onOpenExtras={() => dispatch({ type: 'open-extras' })}
            />

            <div
                className="gv-body"
                data-sidebar={state.sidebarOpen && !state.focusMode ? 'open' : 'closed'}
                data-context={state.contextOpen && !state.focusMode ? 'open' : 'closed'}
            >
                <WorkCenter
                    section={state.section}
                    onSection={(s) => dispatch({ type: 'select-section', section: s })}
                    selectedAgentId={state.selectedAgentId}
                    onSelectAgent={(id) => dispatch({ type: 'select-agent', agentId: id })}
                />

                <main className="gv-world" ref={worldRef} aria-label="Oficina pixel-art">
                    <div id="phaser-container" className="gv-world-phaser" />
                </main>

                {!state.focusMode && (
                    <ContextPanel
                        open={state.contextOpen}
                        onClose={() => {
                            eventBus.dispatchEvent(new CustomEvent('agent-unfocus-request'));
                            dispatch({ type: 'close-context' });
                        }}
                        onGoControl={goControl}
                    />
                )}

                <ExtrasDrawer open={state.extrasOpen} onClose={() => dispatch({ type: 'toggle-extras' })} />
            </div>
        </div>
    );
}

