/** Unit tests for the app-shell state machine (UI/UX Bloque 1). */
import {
    shellReducer, initialShellState, ShellState
} from '../shell/shellState';

const run = (actions: Array<Parameters<typeof shellReducer>[1]>) =>
    actions.reduce<ShellState>(shellReducer, initialShellState);

describe('UI/UX B1 · shell state machine', () => {
    it('initial state: agents section, sidebar open, nothing selected, extras closed', () => {
        expect(initialShellState).toEqual({
            section: 'agents', sidebarOpen: true, contextOpen: false,
            selectedAgentId: null, extrasOpen: false, focusMode: false
        });
    });

    it('selecting a section reopens the sidebar and exits focus mode', () => {
        const s = run([
            { type: 'toggle-focus' },
            { type: 'select-section', section: 'control' }
        ]);
        expect(s.section).toBe('control');
        expect(s.sidebarOpen).toBe(true);
        expect(s.focusMode).toBe(false);
    });

    it('"Solo mundo" collapses sidebar, context and extras together', () => {
        const s = run([
            { type: 'select-agent', agentId: 'a1' },
            { type: 'toggle-extras' },
            { type: 'toggle-focus' }
        ]);
        expect(s.focusMode).toBe(true);
        expect(s.sidebarOpen).toBe(false);
        expect(s.contextOpen).toBe(false);
        expect(s.extrasOpen).toBe(false);
    });

    it('exiting focus mode restores the sidebar (work center)', () => {
        const s = run([{ type: 'toggle-focus' }, { type: 'toggle-focus' }]);
        expect(s.focusMode).toBe(false);
        expect(s.sidebarOpen).toBe(true);
    });

    it('selecting an agent opens the contextual panel and exits focus mode', () => {
        const s = run([{ type: 'toggle-focus' }, { type: 'select-agent', agentId: 'a1' }]);
        expect(s.selectedAgentId).toBe('a1');
        expect(s.contextOpen).toBe(true);
        expect(s.focusMode).toBe(false);
    });

    it('clicking the same agent again keeps the selection (no self-cancel)', () => {
        const s = run([
            { type: 'select-agent', agentId: 'a1' },
            { type: 'select-agent', agentId: 'a1' }
        ]);
        expect(s.selectedAgentId).toBe('a1');
        expect(s.contextOpen).toBe(true);
    });

    it('an explicit null selection closes the contextual panel', () => {
        const s = run([
            { type: 'select-agent', agentId: 'a1' },
            { type: 'select-agent', agentId: null }
        ]);
        expect(s.selectedAgentId).toBeNull();
        expect(s.contextOpen).toBe(false);
    });

    it('Escape closes extras first, then the context panel (normal mode)', () => {
        const withAll = run([
            { type: 'select-agent', agentId: 'a1' },
            { type: 'open-extras' }
        ]);
        const afterExtras = shellReducer(withAll, { type: 'keyboard', key: 'Escape' });
        expect(afterExtras.extrasOpen).toBe(false);
        expect(afterExtras.contextOpen).toBe(true); // context survives extras closing
        const afterContext = shellReducer(afterExtras, { type: 'keyboard', key: 'Escape' });
        expect(afterContext.contextOpen).toBe(false);
        expect(afterContext.selectedAgentId).toBeNull();
    });

    it('Escape in focus mode exits "Solo mundo" and restores the sidebar', () => {
        const focused = run([
            { type: 'select-agent', agentId: 'a1' },
            { type: 'open-extras' },
            { type: 'toggle-focus' }
        ]);
        const after = shellReducer(focused, { type: 'keyboard', key: 'Escape' });
        expect(after.focusMode).toBe(false);
        expect(after.sidebarOpen).toBe(true);
        expect(after.extrasOpen).toBe(false);
    });

    it('closing the context panel clears the selection', () => {
        const s = run([{ type: 'select-agent', agentId: 'a2' }, { type: 'close-context' }]);
        expect(s.selectedAgentId).toBeNull();
        expect(s.contextOpen).toBe(false);
    });

    it('toggling the sidebar inside focus mode exits focus instead of hiding it', () => {
        const s = run([{ type: 'toggle-focus' }, { type: 'toggle-sidebar' }]);
        expect(s.focusMode).toBe(false);
        expect(s.sidebarOpen).toBe(true);
    });
});
