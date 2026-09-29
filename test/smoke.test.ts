/**
 * Smoke test: verifies that the framework is importable by its package name
 * (via the vitest alias) and that a few core pieces work in-process.
 */
import { describe, it, expect } from 'vitest'
import * as core from 'vrack2-core'
import ErrorManager from '../src/errors/ErrorManager'
import Rule from '../src/validator/Rule'
import Validator from '../src/validator/Validator'
import CoreError from '../src/errors/CoreError'
import Port from '../src/ports/Port'
import StandardPort from '../src/ports/StandardPort'
import ReturnPort from '../src/ports/ReturnPort'
import BasicPort from '../src/ports/BasicPort'

describe('vrack2-core smoke', () => {
    it('exports the public API surface', () => {
        expect(core.Container).toBeTypeOf('function')
        expect(core.MainProcess).toBeTypeOf('function')
        expect(core.Bootstrap).toBeTypeOf('function')
        // ErrorManager is exported as a singleton instance (not a class)
        expect(core.ErrorManager).toBeDefined()
        expect(core.ErrorManager.register).toBeTypeOf('function')
        expect(core.ErrorManager.make).toBeTypeOf('function')
        expect(core.Validator).toBeTypeOf('function')
        expect(core.Rule).toBeTypeOf('function')
        expect(core.Device).toBeTypeOf('function')
        expect(core.BootClass).toBeTypeOf('function')
        expect(core.DeviceManager).toBeTypeOf('function')
        expect(core.BootDatabase).toBeTypeOf('function')
        expect(core.BootDatabaseSqlite).toBeTypeOf('function')
        expect(core.BootDatabaseMemory).toBeTypeOf('function')
        expect(core.StorageTypes).toBeDefined()
        expect(core.mergeBootList).toBeTypeOf('function')
    })

    it('exports exactly the documented public API surface (strict set)', () => {
        // Single source of truth for this list: docs/11-API.md.
        // Add a new public export there (with purpose/since) before exporting it.
        const expected = [
            'Action', 'BasicAction', 'BasicMetric', 'BasicPort', 'BasicType',
            'BootClass', 'BootDatabase', 'BootDatabaseMemory', 'BootDatabaseSqlite',
            'Bootstrap', 'Container', 'CoreError', 'Device', 'DeviceConnect',
            'DeviceFileStorage', 'DeviceManager', 'DeviceMetrics', 'DevicePort',
            'ErrorManager', 'ImportManager', 'MainProcess',
            'Metric', 'Port', 'ReactiveRef', 'ReturnPort', 'Rule', 'ServiceLoader',
            'StandardPort', 'StorageTypes', 'StructureStorage', 'SubruleNames',
            'UniversalWorker', 'Utility', 'Validator', 'mergeBootList',
        ]
        // Type-only re-exports (interfaces) are compile-time: in the ESM/vite
        // runtime they surface as `undefined`-valued keys, in the CommonJS build
        // (tsc) they are erased entirely. Assert only the VALUE exports — the
        // real runtime public API — which is identical in both.
        const defined = Object.keys(core).filter((k) => {
            try { return (core as Record<string, unknown>)[k] !== undefined } catch { return false }
        })
        expect(defined.sort()).toEqual([...expected].sort())
    })

    it('ErrorManager registers and makes errors with codes', () => {
        ErrorManager.register('smoke-test', 'SMOKE_TEST_ERR', 'Smoke test error', {})

        const err = ErrorManager.make('SMOKE_TEST_ERR')
        expect(err).toBeInstanceOf(CoreError)
        expect(ErrorManager.isError(err)).toBe(true)
        expect(ErrorManager.isCode(err, 'SMOKE_TEST_ERR')).toBe(true)
        expect(ErrorManager.isCode(err, 'SOME_OTHER_CODE')).toBe(false)
        expect(err.vError).toBe(true)
        expect(err.name).toBe('smoke-test')
        expect(err.message).toBe('Smoke test error')
        expect((err as any).vCode).toBeUndefined()
        expect(err.vShort).toBe('SMOKE_TEST_ERR')
    })

    it('Validator validates rules', () => {
        const rules = {
            name: Rule.string().required().description('Name'),
            count: Rule.number().min(0).description('Count'),
        }
        // valid
        expect(Validator.validate(rules, { name: 'test', count: 5 })).toBe(true)
        // invalid: wrong type on both rules
        expect(() => Validator.validate(rules, { name: 42, count: 'x' })).toThrow()
    })

    it('StandardPort emits type "standard"', () => {
        const s = new StandardPort()
        expect(s).toBeInstanceOf(BasicPort)
        expect(s.export().type).toBe('standard')
    })

    it('ReturnPort emits type "return"', () => {
        const r = new ReturnPort()
        expect(r.export().type).toBe('return')
    })

    it('Port factory helpers produce the right ports', () => {
        expect(Port.standard()).toBeInstanceOf(StandardPort)
        expect(Port.return()).toBeInstanceOf(ReturnPort)
    })

    it('Device is a constructible class with expected methods', () => {
        expect(typeof core.Device).toBe('function')
        expect(typeof core.Device.prototype.onStart).toBe('function')
        expect(typeof core.Device.prototype.actions).toBe('function')
        expect(typeof core.Device.prototype.inputs).toBe('function')
        expect(typeof core.Device.prototype.outputs).toBe('function')
        expect(typeof core.Device.prototype.metrics).toBe('function')
        expect(typeof core.Device.prototype.render).toBe('function')
    })
})
