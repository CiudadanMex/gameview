import React, { createContext, useContext } from 'react';

/**
 * Ciudadan GameView — UI/UX Bloque 1 (FASE 6).
 *
 * Embed context: when active, FloatingPanel-based components render as
 * static embedded sections (no drag, no absolute positioning) inside
 * containers like the Extras drawer. Inherited panels keep working
 * untouched — they simply adapt to their host.
 */
const PanelEmbedContext = createContext(false);

export function PanelEmbedProvider({ children }: { children: React.ReactNode }) {
    return <PanelEmbedContext.Provider value={true}>{children}</PanelEmbedContext.Provider>;
}

export function usePanelEmbedded(): boolean {
    return useContext(PanelEmbedContext);
}
