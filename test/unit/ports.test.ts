/**
 * Unit tests for the port classes and the Port factory.
 */
import { describe, it, expect } from 'vitest'
import {
    Port,
    BasicPort,
    StandardPort,
    ReturnPort,
    Rule,
} from 'vrack2-core'

describe('BasicPort', () => {
    it('has default settings', () => {
        const p = new BasicPort()
        const exp = p.export()
        expect(exp.type).toBe('unknown')
        expect(exp.description).toBe('')
        expect(exp.required).toBe(false)
        expect(exp.dynamic).toBe(false)
        expect(exp.count).toBe(0)
    })

    it('supports fluent configuration', () => {
        const p = new BasicPort()
        const req = Rule.number().description('Port data')
        const same = p.description('A port').dynamic(3).requirement(req)
        expect(same).toBe(p)

        const exp = p.export()
        expect(exp.description).toBe('A port')
        expect(exp.dynamic).toBe(true)
        expect(exp.count).toBe(3)
        expect(exp.requirement).toEqual(expect.objectContaining({ type: 'number' }))
    })

    it('noCapture() marks the port and export() carries the flag', () => {
        const p = new BasicPort()
        expect(p.export().noCapture).toBe(false) // default: capturable (event emitted)

        const same = p.noCapture()
        expect(same).toBe(p) // fluent
        expect(p.export().noCapture).toBe(true)
    })

    it('noCapture() composes with the other modifiers', () => {
        const p = Port.standard().description('out').requirement(Rule.number()).noCapture()
        const exp = p.export()
        expect(exp.type).toBe('standard')
        expect(exp.description).toBe('out')
        expect(exp.noCapture).toBe(true)
    })
})

describe('StandardPort', () => {
    it('is a BasicPort subclass with type "standard"', () => {
        const s = new StandardPort()
        expect(s).toBeInstanceOf(BasicPort)
        expect(s.export().type).toBe('standard')
    })
})

describe('ReturnPort', () => {
    it('has type "return"', () => {
        expect(new ReturnPort().export().type).toBe('return')
    })

    it('export() includes the return rule', () => {
        const r = new ReturnPort().return(Rule.number().description('Result value'))
        const exp = r.export()
        expect(exp.type).toBe('return')
        expect(exp.requirement).toBeUndefined()
        expect(exp.return).toEqual(expect.objectContaining({ type: 'number' }))
    })
})

describe('Port factory', () => {
    it('standard() creates a StandardPort', () => {
        const p = Port.standard()
        expect(p).toBeInstanceOf(StandardPort)
        expect(p.export().type).toBe('standard')
    })

    it('return() creates a ReturnPort', () => {
        const p = Port.return()
        expect(p).toBeInstanceOf(ReturnPort)
        expect(p.export().type).toBe('return')
    })

    it('factory results are independent instances', () => {
        const a = Port.standard()
        const b = Port.standard()
        expect(a).not.toBe(b)
        a.description('only a')
        expect(a.export().description).toBe('only a')
        expect(b.export().description).toBe('')
    })
})