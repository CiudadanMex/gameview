import { loadConfig, loadDotEnv, describeConfig } from '../config';

describe('loadConfig', () => {
    it('defaults to external mode, localhost binding and 7 seats', () => {
        const config = loadConfig({});
        expect(config.mode).toBe('external');
        expect(config.host).toBe('127.0.0.1');
        expect(config.port).toBe(3000);
        expect(config.ollamaUrl).toBe('http://127.0.0.1:11434');
        expect(config.databasePath).toBe('./data/office-memory.db');
        expect(config.maxSeats).toBe(7);
        expect(config.externalApiEnabled).toBe(true);
        expect(config.externalDemoMode).toBe(false);
    });

    it('parses internal mode from AGENT_OFFICE_MODE', () => {
        expect(loadConfig({ AGENT_OFFICE_MODE: 'internal' }).mode).toBe('internal');
        expect(loadConfig({ AGENT_OFFICE_MODE: 'EXTERNAL' }).mode).toBe('external');
        expect(loadConfig({ AGENT_OFFICE_MODE: 'external' }).mode).toBe('external');
    });

    it('rejects invalid modes', () => {
        expect(() => loadConfig({ AGENT_OFFICE_MODE: 'chaos' })).toThrow(/AGENT_OFFICE_MODE/);
    });

    it('hard-caps MAX_SEATS at 7 (no dynamic office expansion)', () => {
        expect(loadConfig({ MAX_SEATS: '20' }).maxSeats).toBe(7);
        expect(loadConfig({ MAX_SEATS: '3' }).maxSeats).toBe(3);
        expect(loadConfig({ MAX_SEATS: 'nonsense' }).maxSeats).toBe(7);
    });

    it('parses ports, hosts and booleans', () => {
        const config = loadConfig({
            PORT: '4200',
            HOST: '0.0.0.0',
            OLLAMA_URL: 'http://otro:11434',
            DATABASE_PATH: '/tmp/office.db',
            EXTERNAL_API_ENABLED: 'false',
            EXTERNAL_DEMO_MODE: 'true'
        });
        expect(config.port).toBe(4200);
        expect(config.host).toBe('0.0.0.0');
        expect(config.ollamaUrl).toBe('http://otro:11434');
        expect(config.databasePath).toBe('/tmp/office.db');
        expect(config.externalApiEnabled).toBe(false);
        expect(config.externalDemoMode).toBe(true);
    });
});

describe('loadDotEnv', () => {
    it('never overrides variables already present in the environment', () => {
        process.env.CIUDADAN_TEST_VAR = 'original';
        process.env.CIUDADAN_TEST_NEW = '';
        delete process.env.CIUDADAN_TEST_NEW;

        const fs = require('fs');
        const os = require('os');
        const path = require('path');
        const tmp = path.join(os.tmpdir(), `agentoffice-test-${Date.now()}.env`);
        fs.writeFileSync(tmp, [
            'CIUDADAN_TEST_VAR="from-file"',
            'CIUDADAN_TEST_NEW=hello',
            '# a comment',
            'BROKEN_LINE_WITHOUT_EQUALS'
        ].join('\n'));

        loadDotEnv(tmp);
        expect(process.env.CIUDADAN_TEST_VAR).toBe('original');
        expect(process.env.CIUDADAN_TEST_NEW).toBe('hello');

        fs.unlinkSync(tmp);
        delete process.env.CIUDADAN_TEST_VAR;
        delete process.env.CIUDADAN_TEST_NEW;
    });
});

describe('describeConfig', () => {
    it('summarizes the configuration for startup logs', () => {
        const summary = describeConfig(loadConfig({}));
        expect(summary).toContain('mode=external');
        expect(summary).toContain('listen=127.0.0.1:3000');
        expect(summary).toContain('seats=7');
    });
});
