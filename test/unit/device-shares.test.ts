/**
 * Unit tests for Device `shares` + explicit `render()`.
 *
 * Behavior under test (see src/service/Device.ts):
 *  - `shares` is a plain object: a subclass field `shares = {...}` is the
 *    initial state (no Container machinery), writes/reassignment work as-is
 *  - mutating `shares` emits nothing — the device calls `render()` itself
 *  - `render()` emits `device.render` with the *live* `shares` reference:
 *    subscribers treat it as read-only; the object is structured-cloneable
 *  - `render()` works with no changes (BC) and after `removeDevice()`
 */
import { describe, it, expect } from 'vitest'
import { Container, Device } from 'vrack2-core'
// Plain-JS fixture: `shares` class field (see SharesField.js header)
import sharesFieldFixture from '../fixtures/devices/testkit/SharesField.js'

const { SharesFieldDefault, SharesFieldRefine, SharesFieldReplace } = sharesFieldFixture as any

type ProbeShares = { on: boolean; count: number }

/** Canonical pattern: the subclass declares its own typed `shares` field */
class FieldDevice extends Device {
    shares: ProbeShares = { on: false, count: 0 }
    constructor(id: string, c: Container) { super(id, 'test.Field', c) }
}

/** Legacy style: shares written in onRegister() (no field) */
class PreProcDevice extends Device {
    constructor(id: string, c: Container) { super(id, 'test.PreProc', c) }
    onRegister() { this.shares = { on: false, count: 0 } }
}

/** Untyped device — free-form shares (Record<string, any>) */
class AnyDevice extends Device {
    constructor(id: string, c: Container) { super(id, 'test.Any', c) }
}

function makeContainer() {
    const c = new Container('ut', {} as any)
    const events: any[] = []
    c.on('device.render', (e: any) => events.push(e))
    return { c, events }
}

describe('Device shares (plain object)', () => {
    it('uses the subclass field as the initial state; writes emit nothing', () => {
        const { c, events } = makeContainer()
        const dev = new FieldDevice('P1', c)
        c.registerDevice(dev)
        expect(events).toHaveLength(0)
        expect(dev.shares).toEqual({ on: false, count: 0 })

        dev.shares.count = 5
        expect(events).toHaveLength(0) // mutations render nothing
    })

    it('supports onRegister() writes (no field)', () => {
        const { c, events } = makeContainer()
        const dev = new PreProcDevice('P2', c)
        c.registerDevice(dev)
        expect(events).toHaveLength(0)
        expect(dev.shares).toEqual({ on: false, count: 0 })
    })

    it('is a plain object: structuredClone works on it directly', () => {
        const { c } = makeContainer()
        const dev = new AnyDevice('P3', c)
        c.registerDevice(dev)
        dev.shares = { nested: { deep: 1 }, list: [1, 2] }
        expect(structuredClone(dev.shares)).toEqual({ nested: { deep: 1 }, list: [1, 2] })
    })
})

describe('Device.render()', () => {
    it('emits the current shares as a live reference', () => {
        const { c, events } = makeContainer()
        const dev = new FieldDevice('P4', c)
        c.registerDevice(dev)
        dev.shares.count = 5

        dev.render()
        expect(events).toHaveLength(1)
        expect(events[0].device).toBe('P4')
        expect(events[0].trace).toBe(dev.shares) // live reference, not a copy
        expect(events[0].trace.count).toBe(5)
    })

    it('emits even without changes (BC)', () => {
        const { c, events } = makeContainer()
        const dev = new FieldDevice('P5', c)
        c.registerDevice(dev)

        dev.render()
        expect(events).toHaveLength(1)
        expect(events[0].trace).toEqual({ on: false, count: 0 })
    })

    it('reflects reassignment and nested writes', () => {
        const { c, events } = makeContainer()
        const dev = new AnyDevice('P6', c)
        c.registerDevice(dev)

        dev.shares = { on: true, deep: { x: 1 } }
        dev.shares.deep.x = 2
        dev.render()
        expect(events).toHaveLength(1)
        expect(events[0].trace).toEqual({ on: true, deep: { x: 2 } })
    })

    it('keeps working after removeDevice()', async () => {
        const { c, events } = makeContainer()
        const dev = new FieldDevice('P7', c)
        c.registerDevice(dev)

        await c.removeDevice('P7')
        dev.render()
        expect(events).toHaveLength(1)
        expect(events[0].trace).toEqual({ on: false, count: 0 })
    })
})

describe('legacy `shares` class field (BC)', () => {
    it('uses the field value as default shares', () => {
        const { c, events } = makeContainer()
        const dev = new SharesFieldDefault('F1', c)
        c.registerDevice(dev)
        expect(events).toHaveLength(0)
        expect(dev.shares).toEqual({ data: 1 })

        dev.shares.data = 42
        dev.render()
        expect(events).toHaveLength(1)
        expect(events[0].trace).toEqual({ data: 42 })
    })

    it('keeps onRegister() refinement of the field default', () => {
        const { c, events } = makeContainer()
        const dev = new SharesFieldRefine('F2', c)
        c.registerDevice(dev)
        expect(events).toHaveLength(0)
        expect(dev.shares).toEqual({ data: 99 })
    })

    it('keeps onRegister() reassignment of the field default', () => {
        const { c, events } = makeContainer()
        const dev = new SharesFieldReplace('F3', c)
        c.registerDevice(dev)
        expect(events).toHaveLength(0)
        expect(dev.shares).toEqual({ data: 2, extra: true })
    })
})
