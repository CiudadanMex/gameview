/**
 * Ciudadan GameView — UI/UX Bloque 1 (FASE 2/8).
 *
 * Pure state machine for the app shell (unit tested, no React here):
 *  - Section navigation of the Work Center (agents/tasks/sprints/control).
 *  - Sidebar / contextual panel / extras drawer visibility.
 *  - "Solo mundo" focus mode (collapses everything).
 *  - Agent selection drives the contextual panel.
 *
 * Layout invariants enforced here (never in render code):
 *  - Focus mode closes sidebar, context and extras.
 *  - Exiting focus mode restores the sidebar (the previous section).
 *  - Selecting an agent exits focus mode and opens the context panel.
 *  - Deselecting an agent closes the context panel.
 */

export type ShellSection = 'agents' | 'tasks' | 'sprints' | 'control';

export interface ShellState {
    section: ShellSection;
    sidebarOpen: boolean;
    /** Contextual (right) panel: open ONLY when something is selected. */
    contextOpen: boolean;
    selectedAgentId: string | null;
    /** Secondary drawer for inherited/extra panels. */
    extrasOpen: boolean;
    /** "Solo mundo": the world takes the full viewport. */
    focusMode: boolean;
}

export type ShellAction =
    | { type: 'select-section'; section: ShellSection }
    | { type: 'toggle-sidebar' }
    | { type: 'select-agent'; agentId: string | null }
    | { type: 'close-context' }
    | { type: 'toggle-extras' }
    | { type: 'open-extras' }
    | { type: 'toggle-focus' }
    | { type: 'keyboard'; key: string };

export const initialShellState: ShellState = {
    section: 'agents',
    sidebarOpen: true,
    contextOpen: false,
    selectedAgentId: null,
    extrasOpen: false,
    focusMode: false
};

export function shellReducer(state: ShellState, action: ShellAction): ShellState {
    switch (action.type) {
        case 'select-section':
            // Opening a section exits focus mode and reopens the sidebar.
            return {
                ...state,
                section: action.section,
                sidebarOpen: true,
                focusMode: false
            };

        case 'toggle-sidebar':
            if (state.focusMode) return { ...state, focusMode: false, sidebarOpen: true };
            return { ...state, sidebarOpen: !state.sidebarOpen };

        case 'select-agent': {
            if (action.agentId === null) {
                return { ...state, selectedAgentId: null, contextOpen: false };
            }
            // Same id: keep the selection. The world emits the focus
            // payload again after a list-driven focus request — treating
            // it as a toggle would cancel the panel right after opening.
            if (action.agentId === state.selectedAgentId) {
                return state;
            }
            return {
                ...state,
                selectedAgentId: action.agentId,
                contextOpen: true,
                focusMode: false
            };
        }

        case 'close-context':
            return { ...state, contextOpen: false, selectedAgentId: null };

        case 'toggle-extras':
            return { ...state, extrasOpen: !state.extrasOpen, focusMode: false };

        case 'open-extras':
            return { ...state, extrasOpen: true, focusMode: false };

        case 'toggle-focus': {
            if (!state.focusMode) {
                // Enter focus: remember nothing — deterministic exit below.
                return { ...state, focusMode: true, sidebarOpen: false, contextOpen: false, extrasOpen: false };
            }
            // Exit focus: restore the work center.
            return { ...state, focusMode: false, sidebarOpen: true };
        }

        case 'keyboard':
            if (action.key === 'Escape') {
                if (state.extrasOpen) return { ...state, extrasOpen: false };
                if (state.contextOpen) return { ...state, contextOpen: false, selectedAgentId: null };
                if (state.focusMode) return { ...state, focusMode: false, sidebarOpen: true };
            }
            return state;

        default:
            return state;
    }
}
