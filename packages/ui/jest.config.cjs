/** Jest config for the UI workspace (pure-TS unit tests: WS endpoint
 *  resolution + shell state machine). Reuses the root jest/ts-jest. */
module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    roots: ['<rootDir>/src'],
    testMatch: ['**/__tests__/**/*.test.ts'],
    moduleFileExtensions: ['ts', 'js', 'json'],
    transform: {
        '^.+\\.tsx?$': ['ts-jest', {
            tsconfig: {
                // Tests import pure modules only; JSX is not needed here.
                jsx: 'react-jsx',
                esModuleInterop: true,
                target: 'ES2022',
                module: 'commonjs',
                strict: true,
                skipLibCheck: true
            }
        }]
    }
};
