import * as fs from 'fs';

/**
 * Ciudadan AgentOffice — server configuration.
 *
 * All settings are environment-driven and documented in `.env.example`.
 * Values already present in the environment are NEVER overridden by the
 * optional `.env` file (see `loadDotEnv`).
 */

export type OrchestrationMode = 'internal' | 'external';

export interface ServerConfig {
    /** 'external' (default): office is a visual shell driven by the external
     *  interface; no LLM, no tools, no autonomous behavior.
     *  'internal': original upstream behavior (Ollama think loop, tools...). */
    mode: OrchestrationMode;
    /** Network interface the server binds to. Local-only by default. */
    host: string;
    /** Colyseus + REST port. */
    port: number;
    /** Ollama endpoint — only used in 'internal' mode. */
    ollamaUrl: string;
    /** SQLite database file for tasks/layouts/memories. */
    databasePath: string;
    /** Hard cap of agent seats. Never exceeds 7 (no dynamic office growth). */
    maxSeats: number;
    /** Whether the external REST API accepts updates (external mode only). */
    externalApiEnabled: boolean;
    /** Clearly-identified demo/test data generator. Disabled by default. */
    externalDemoMode: boolean;
}

/**
 * Minimal .env loader. Reads KEY=VALUE lines and applies them to
 * process.env ONLY for keys that are not already defined. Optional file:
 * any read error is silently ignored. No dependencies.
 */
export function loadDotEnv(filePath: string = '.env'): void {
    try {
        if (!fs.existsSync(filePath)) return;
        const lines = fs.readFileSync(filePath, 'utf-8').split(/\r?\n/);
        for (const raw of lines) {
            const line = raw.trim();
            if (!line || line.startsWith('#')) continue;
            const eq = line.indexOf('=');
            if (eq <= 0) continue;
            const key = line.slice(0, eq).trim();
            let value = line.slice(eq + 1).trim();
            if (
                (value.startsWith('"') && value.endsWith('"')) ||
                (value.startsWith("'") && value.endsWith("'"))
            ) {
                value = value.slice(1, -1);
            }
            if (!(key in process.env)) {
                process.env[key] = value;
            }
        }
    } catch {
        // .env is optional — ignore IO errors.
    }
}

function toBool(value: string | undefined, defaultValue: boolean): boolean {
    if (value === undefined || value === '') return defaultValue;
    return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

function clampInt(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, Math.round(value)));
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
    const rawMode = (env.AGENT_OFFICE_MODE || 'external').trim().toLowerCase();
    if (rawMode !== 'internal' && rawMode !== 'external') {
        throw new Error(
            `[Config] Invalid AGENT_OFFICE_MODE "${rawMode}". Use "external" or "internal".`
        );
    }

    const port = clampInt(Number(env.PORT || 3000) || 3000, 1, 65535);
    const maxSeats = clampInt(Number(env.MAX_SEATS || 7) || 7, 1, 7);

    return {
        mode: rawMode,
        host: (env.HOST || '127.0.0.1').trim(),
        port,
        ollamaUrl: (env.OLLAMA_URL || 'http://127.0.0.1:11434').trim(),
        databasePath: (env.DATABASE_PATH || './data/office-memory.db').trim(),
        maxSeats,
        externalApiEnabled: toBool(env.EXTERNAL_API_ENABLED, true),
        externalDemoMode: toBool(env.EXTERNAL_DEMO_MODE, false)
    };
}

/** Human-readable summary used in startup logs. */
export function describeConfig(config: ServerConfig): string {
    return [
        `mode=${config.mode}`,
        `listen=${config.host}:${config.port}`,
        `ollama=${config.mode === 'internal' ? config.ollamaUrl : '(disabled)'}`,
        `db=${config.databasePath}`,
        `seats=${config.maxSeats}`,
        `externalApi=${config.externalApiEnabled ? 'enabled' : 'disabled'}`,
        `demoData=${config.externalDemoMode ? 'ON (test data)' : 'off'}`
    ].join(' ');
}
