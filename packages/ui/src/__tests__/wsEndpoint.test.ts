/** Unit tests for the UI/UX Bloque 1 WebSocket endpoint resolution
 *  (the Cloudflare fix) — pure logic, no browser needed. */
import {
    resolveWsEndpoint, readWsQueryOverride
} from '../wsEndpoint';

describe('UI/UX B1 · FASE 10: WebSocket endpoint behind Cloudflare', () => {
    it('https pages connect to the SAME ORIGIN via wss WITHOUT a port (the fix)', () => {
        const endpoint = resolveWsEndpoint({
            location: { protocol: 'https:', hostname: 'gameview.ciudadan.org', port: '' }
        });
        expect(endpoint).toBe('wss://gameview.ciudadan.org');
        expect(endpoint).not.toContain(':3000');
    });

    it('http pages (dev/direct) use the explicit dev port', () => {
        expect(resolveWsEndpoint({
            location: { protocol: 'http:', hostname: 'localhost', port: '5173' }
        })).toBe('ws://localhost:3000');
        expect(resolveWsEndpoint({
            buildPort: '3100',
            location: { protocol: 'http:', hostname: 'localhost', port: '5173' }
        })).toBe('ws://localhost:3100');
    });

    it('build-time URL (embeds/Discord Activity) wins over the location', () => {
        expect(resolveWsEndpoint({
            buildUrl: 'wss://esfericulos.example.com/ws',
            location: { protocol: 'https:', hostname: 'gameview.ciudadan.org', port: '' }
        })).toBe('wss://esfericulos.example.com/ws');
    });

    it('?ws= override beats everything (operator/debug tool)', () => {
        expect(resolveWsEndpoint({
            queryOverride: 'wss://debug.internal:9000',
            buildUrl: 'wss://elsewhere',
            location: { protocol: 'https:', hostname: 'gameview.ciudadan.org', port: '' }
        })).toBe('wss://debug.internal:9000');
    });

    it('a saved session override is honored when no query param exists', () => {
        expect(resolveWsEndpoint({
            savedOverride: 'wss://saved.example.com',
            location: { protocol: 'https:', hostname: 'gameview.ciudadan.org', port: '' }
        })).toBe('wss://saved.example.com');
    });

    it('non-browser environments fall back to localhost', () => {
        expect(resolveWsEndpoint({ location: null })).toBe('ws://localhost:3000');
    });

    it('readWsQueryOverride parses ?ws= and ignores empty values', () => {
        expect(readWsQueryOverride('?ws=wss%3A%2F%2Fcustom.host')).toBe('wss://custom.host');
        expect(readWsQueryOverride('')).toBeNull();
        expect(readWsQueryOverride('?other=1')).toBeNull();
    });
});
