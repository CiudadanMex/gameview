import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import * as path from 'path';

// Ciudadan AgentOffice — UI dev server configuration.
// Reads UI_*/PORT/HOST variables from the repo root .env file and the
// process environment (process.env always wins; nothing is overridden).
// Binds to 127.0.0.1 by default — no public exposure.
export default defineConfig(({ mode }) => {
    const fileEnv = loadEnv(mode, path.resolve(__dirname, '../..'), ['UI_', 'PORT', 'HOST', 'AGENT_OFFICE_']);
    const env: Record<string, string> = { ...fileEnv, ...(process.env as Record<string, string>) };

    const uiHost = env.UI_HOST || '127.0.0.1';
    const uiPort = Number(env.UI_PORT || 5173);
    const serverHost = env.HOST || '127.0.0.1';
    const serverPort = Number(env.PORT || 3000);

    return {
        plugins: [
            react()
        ],
        server: {
            host: uiHost,
            port: uiPort,
            proxy: {
                '/api': `http://${serverHost}:${serverPort}`,
            }
        },
        build: {
            outDir: 'dist'
        }
    };
});
