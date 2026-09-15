/**
 * Unit tests for the error system: ErrorManager (singleton) + CoreError.
 *
 * Field mapping (CoreError):
 *  - name   -> error group (e.g. 'Validator')
 *  - message-> error description
 *  - vShort -> the single canonical short identifier (the ID of the error)
 *  - vShort -> readable short code (e.g. 'VR_NOT_PASS')
 */
import { describe, it, expect } from 'vitest'
import { ErrorManager, CoreError } from 'vrack2-core'

// Test error codes. Must be unique for the whole process!
ErrorManager.register('UnitTest', 'UT_TEST_A', 'Test error A', {
    // rules do not validate additional data, they only document it
})

describe('ErrorManager', () => {
    it('make() creates a CoreError with group, description and codes', () => {
        const err = ErrorManager.make('UT_TEST_A')
        expect(err).toBeInstanceOf(CoreError)
        expect(err.name).toBe('UnitTest')
        expect(err.message).toBe('Test error A')
        expect((err as any).vCode).toBeUndefined()
        expect(err.vShort).toBe('UT_TEST_A')
        expect(err.vError).toBe(true)
    })

    it('make() attaches additional data and lists its keys in vAdd', () => {
        const err: any = ErrorManager.make('UT_TEST_A', { foo: 42, bar: 'x' })
        expect(err.vAdd).toEqual(['foo', 'bar'])
        expect(err.foo).toBe(42)
        expect(err.bar).toBe('x')
    })

    it('isError() / isCode() work with instances and plain objects', () => {
        const err = ErrorManager.make('UT_TEST_A')
        expect(ErrorManager.isError(err)).toBe(true)
        expect(ErrorManager.isCode(err, 'UT_TEST_A')).toBe(true)
        expect(ErrorManager.isCode(err, 'UT_TEST_A')).toBe(true)
        expect(ErrorManager.isCode(err, 'SOME_OTHER_CODE')).toBe(false)

        // serialized (network) error object
        expect(ErrorManager.isError({ vError: true, vShort: 'y' })).toBe(true)
        expect(ErrorManager.isCode({ vError: true, vShort: 'y' }, 'y')).toBe(true)

        expect(ErrorManager.isError({ foo: 1 })).toBe(false)
        expect(ErrorManager.isError('just a string')).toBe(false)
        expect(ErrorManager.isCode({ foo: 1 }, 'UT_TEST_A')).toBe(false)
    })

    it('make() with an unknown code throws EM_CODE_NOT_FOUND', () => {
        let err: any
        try {
            ErrorManager.make('UT_NO_SUCH_CODE')
        } catch (e) {
            err = e
        }
        expect(err).toBeDefined()
        expect(ErrorManager.isCode(err, 'EM_CODE_NOT_FOUND')).toBe(true)
    })

    it('register() is idempotent for the same code+short pair', () => {
        expect(() =>
            ErrorManager.register('UnitTest', 'UT_TEST_A', 'Test error A'),
        ).not.toThrow()
    })

    it('register() with a conflicting code/short throws EM_CODE_EXISTS', () => {
        let err: any
        // same short, different description
        try {
            ErrorManager.register('Other', 'UT_TEST_A', 'conflict')
        } catch (e) {
            err = e
        }
        expect(err).toBeDefined()
        expect(ErrorManager.isCode(err, 'EM_CODE_EXISTS')).toBe(true)
    })

    it('add() appends nested errors to vAddErrors', () => {
        const err = ErrorManager.make('UT_TEST_A')
        const inner = ErrorManager.make('EM_CODE_NOT_FOUND')
        err.add(inner)
        expect(err.vAddErrors).toHaveLength(1)
        // nested errors are stored as plain (serializable) copies
        expect(err.vAddErrors[0]).not.toBe(inner)
        expect(err.vAddErrors[0].vShort).toBe('EM_CODE_NOT_FOUND')
        expect(err.vAddErrors[0].message).toBe('No such error found')
    })

    it('setTrace() replaces the stack with the passed error stack', () => {
        const marker = new Error('marker')
        const err = ErrorManager.make('UT_TEST_A').setTrace(marker)
        expect(err.stack).toBe(marker.stack)
    })

    it('convert() wraps plain errors and returns CoreError as-is', () => {
        const plain = new Error('plain problem')
        const converted = ErrorManager.convert(plain)
        expect(ErrorManager.isCode(converted, 'EM_ERROR_CONVERT')).toBe(true)
        expect(converted.message).toBe('plain problem')

        const core = ErrorManager.make('UT_TEST_A')
        expect(ErrorManager.convert(core)).toBe(core)
    })

    it('export()/import() round-trip preserves the main error fields', () => {
        const err: any = ErrorManager.make('UT_TEST_A', { foo: 1 })
        const raw = JSON.parse(JSON.stringify(err.export()))

        // simulate receiving the error over the network
        const revived = new CoreError('x', 'x', 'x').import(raw)
        expect(ErrorManager.isError(revived)).toBe(true)
        expect(revived.name).toBe('UnitTest')
        expect(revived.message).toBe('Test error A')
        expect((revived as any).vCode).toBeUndefined()
        expect(revived.vShort).toBe('UT_TEST_A')
        expect(revived.foo).toBe(1)
    })
})