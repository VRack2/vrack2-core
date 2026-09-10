import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
    resolve: {
        alias: {
            // Tests import the framework by its package name.
            // Map it to the live TypeScript source (not lib/) so tests
            // always run against the current code without a build step.
            'vrack2-core': path.resolve(__dirname, 'src/index.ts'),
            // Boot-class fixtures for integration tests (imported as 'testkit.*')
            'testkit': path.resolve(__dirname, 'test/fixtures/boot/index.js'),
        },
    },
    test: {
        environment: 'node',
        include: ['test/**/*.test.ts'],
    },
})
