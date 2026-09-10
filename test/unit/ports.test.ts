/**
 * Unit tests for the port classes and the Port factory.
 */
import { describe, it, expect } from 'vitest'
import {
    Port,
    BasicPort,
    StandardPort,
    StandartPort,
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
})

describe('StandardPort / StandartPort (deprecated)', () => {
    it('both are BasicPort subclasses with type "standard"', () => {
        const s = new StandardPort()
        const deprecated = new StandartPort()
        expect(s).toBeInstanceOf(BasicPort)
        expect(deprecated).toBeInstanceOf(BasicPort)
        expect(s.export().type).toBe('standard')
        expect(deprecated.export().type).toBe('standard')
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
        expect(p).not.toBeInstanceOf(StandartPort)
        expect(p.export().type).toBe('standard')
    })

    it('standart() (deprecated) creates a StandartPort', () => {
        const p = Port.standart()
        expect(p).toBeInstanceOf(StandartPort)
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