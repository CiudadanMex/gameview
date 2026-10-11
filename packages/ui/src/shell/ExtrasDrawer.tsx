import React, { useEffect, useState } from 'react';
import { PanelEmbedProvider } from './PanelEmbed';
import { EpisodeRecapPanel } from '../components/EpisodeRecapPanel';
import { AgentPulseBoard } from '../components/AgentPulseBoard';
import { HighlightsFeed } from '../components/HighlightsFeed';
import { ViralControlPanel } from '../components/ViralControlPanel';
import { LayoutEditor } from '../components/LayoutEditor';
import { SystemLog } from '../components/SystemLog';
import { ChatPanel } from '../components/ChatPanel';
import { RelationshipGraph } from '../components/RelationshipGraph';

/**
 * Ciudadan GameView — UI/UX Bloque 1 (FASE 6): the Extras drawer.
 * Inherited/secondary panels live HERE — hidden by default, embedded
 * (no overlapping windows). Showrunner chaos/scenario controls are
 * explicitly gated in external (real agents) mode: the server already
 * rejects them; the UI shows why.
 */

export function ExtrasDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
    const [mode, setMode] = useState<string>('');

    useEffect(() => {
        if (!open || mode) return;
        fetch('/api/offices').then(r => r.json()).then(d => setMode(String(d?.mode || ''))).catch(() => setMode(''));
    }, [open, mode]);

    if (!open) return null;

    return (
        <>
            <div className="gv-extras-backdrop" onClick={onClose} />
            <div className="gv-extras-drawer" role="dialog" aria-label="Extras">
                <div className="gv-extras-head">
                    <strong style={{ fontSize: 12 }}>⚙ Extras</strong>
                    <button className="gv-btn gv-btn-icon" onClick={onClose} title="Cerrar (Esc)">✕</button>
                </div>
                <div className="gv-extras-body">
                    <div className="gv-hint">
                        Paneles secundarios heredados del proyecto original. Permanecen ocultos
                        para no tapar la oficina; ábrelos solo cuando los necesites.
                        {mode === 'external' && ' En modo de agentes reales, los controles de showrunner (escenarios/caos ficticios) están deshabilitados: no generan actividad simulada.'}
                    </div>

                    <PanelEmbedProvider>
                        <SystemLog />
                        <ChatPanel />
                        <EpisodeRecapPanel />
                        <AgentPulseBoard />
                        <HighlightsFeed />
                        <RelationshipGraph />
                        <ViralControlPanel />
                        <LayoutEditor />
                    </PanelEmbedProvider>
                </div>
            </div>
        </>
    );
}
