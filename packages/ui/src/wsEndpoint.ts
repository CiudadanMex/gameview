/**
 * Ciudadan GameView — UI/UX Bloque 1 (FASE 10).
 *
 * Colyseus WebSocket endpoint resolution.
 *
 * Priority order (documented + unit tested):
 *  1. `?ws=` query param — explicit operator/debug override, kept in
 *     sessionStorage (NOT localStorage: a broken saved URL must never
 *     stick forever).
 *  2. Build-time `VITE_WS_URL` (embeds, Discord Activity) — injected by
 *     the Vite `define`.
 *  3. Same-origin derivation:
 *     - https page → `wss://<host>` (NO explicit port). Reverse proxies
 *       (Cloudflare Tunnel/Access) terminate WSS on the standard port
 *       and forward to the internal service; `wss://host:3000` is NOT
 *       proxied and fails. THIS is the fix for
 *       "Colyseus Sync: Failed (wss://gameview.ciudadan.org:3000)".
 *     - http page → `ws://<host>:<devPort>` (dev servers such as Vite
 *       serve the UI on another port; the API/WS server is on 3000).
 *     - No window (SSR/tests) → `ws://localhost:3000` fallback.
 */

export interface WsLocationLike {
    protocol: string;
    hostname: string;
    port: string;
}

export interface WsEndpointInput {
    /** Explicit override (?ws= param, already read by the caller). */
    queryOverride?: string | null;
    /** Previously saved session override (sessionStorage). */
    savedOverride?: string | null;
    /** Build-time injected URL (VITE_WS_URL / __AGENT_OFFICE_WS_URL__). */
    buildUrl?: string;
    /** Build-time injected port (VITE_WS_PORT / __AGENT_OFFICE_WS_PORT__). */
    buildPort?: string;
    /** Current page location; null in non-browser environments. */
    location?: WsLocationLike | null;
}

export const WS_OVERRIDE_STORAGE_KEY = 'agent-office:ws-override';

/** Legacy key from previous builds — removed on boot (stale URLs). */
export const WS_OVERRIDE_LEGACY_KEY = 'agent-office:ws-url';

export function resolveWsEndpoint(input: WsEndpointInput): string {
    const override = (input.queryOverride || input.savedOverride || '').trim();
    if (override) return override;

    const configured = String(input.buildUrl || '').trim();
    if (configured) return configured;

    const loc = input.location;
    if (!loc) return 'ws://localhost:3000';

    if (loc.protocol === 'https:') {
        // Public HTTPS origin (Cloudflare Tunnel + Access, any reverse
        // proxy): WSS goes to the standard port of the public host.
        return `wss://${loc.hostname}`;
    }

    // http origin (local dev / direct access): explicit dev port.
    const port = String(input.buildPort || '').trim() || '3000';
    return `ws://${loc.hostname}:${port}`;
}

/** Reads the ?ws= override (if any) from a search string. */
export function readWsQueryOverride(search: string): string | null {
    try {
        const value = new URLSearchParams(search).get('ws');
        return value && value.trim() ? value.trim() : null;
    } catch {
        return null;
    }
}
