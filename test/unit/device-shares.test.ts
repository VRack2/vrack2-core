/**
 * Unit tests for Device `shares` auto-render + the subclass-field initial state.
 *
 * Behavior under test (see src/service/Device.ts, src/Container.ts):
 *  - `shares` is reactive (backed by ReactiveRef): a property write,
 *    a new property, `delete` and a full reassignment trigger `render()`
 *  - the initial state comes from the subclass field `shares = {...}`:
 *    right after preProcess() it is imported into the reactive ref (refinements
 *    made in preProcess() are preserved) and the shadow is dropped
 *  - legacy styles keep working: writes in preProcess() without any field,
 *    plain JS devices with a class field (ES2022 shadowing normalized on attach)
 *  - the Container attaches the watcher AFTER `preProcess()`, so initialization
 *    writes do not render; `removeDevice()` detaches it (no renders, no leaks)
 *  - explicit `render()` always emits (BC) and is re-entrancy safe
 */
import { describe, it, expect } from 'vitest'
import { Container, Device } from 'vrack2-core'
// Legacy-style JS fixture: class field `shares = {...}` (see SharesField.js header)
import sharesFieldFixture from '../fixtures/devices/testkit/SharesField.js'

const { SharesFieldDefault, SharesFieldRefine, SharesFieldReplace } = sharesFieldFixture as any

type ProbeShares = { on: boolean; count: number }

/** Canonical pattern: the subclass declares its own typed `shares` field */
class FieldDevice extends Device {
    shares: ProbeShares = { on: false, count: 0 }
    constructor(id: string, c: Container) { super(id, 'test.Field', c) }
}

/** Legacy style still supported: shares written in preProcess() (no field) */
class PreProcDevice extends Device {
    constructor(id: string, c: Container) { super(id, 'test.PreProc', c) }
    preProcess() { this.shares = { on: false, count: 0 } }
}

/** Field + refinement in preProcess() — the field value is imported at attach */
class FieldRefineDevice extends Device {
    shares: ProbeShares = { on: true, count: 10 }
    constructor(id: string, c: Container) { super(id, 'test.FieldRefine', c) }
    preProcess() { this.shares.count = 20 }
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

describe('Device shares auto-render (subclass field)', () => {
    it('uses the field value as default; no render before attach; post-attach write renders', () => {
        const { c, events } = makeContainer()
        const dev = new FieldDevice('P1', c)
        c.registerDevice(dev)
        expect(events).toHaveLength(0)
        expect(dev.shares).toEqual({ on: false, count: 0 })

        dev.shares.count = 5
        expect(events).toHaveLength(1)
        expect(events[0].device).toBe('P1')
        expect(events[0].trace.count).toBe(5)
    })

    it('keeps preProcess() refinement of the field default', () => {
        const { c, events } = makeContainer()
        const dev = new FieldRefineDevice('P2', c)
        c.registerDevice(dev)
        expect(events).toHaveLength(0)
        expect(dev.shares).toEqual({ on: true, count: 20 })

        dev.shares.on = false
        expect(events).toHaveLength(1)
        expect(events[0].trace).toEqual({ on: false, count: 20 })
    })

    it('legacy style: preProcess() writes do not render; post-attach writes do', () => {
        const { c, events } = makeContainer()
        const dev = new PreProcDevice('P3', c)
        c.registerDevice(dev)
        expect(events).toHaveLength(0)
        expect(dev.shares).toEqual({ on: false, count: 0 })

        dev.shares.count = 5
        expect(events).toHaveLength(1)
        expect(events[0].trace.count).toBe(5)
    })
    it('triggers render on reassignment, new property, delete and nested write', () => {
        const { c, events } = makeContainer()
        const dev = new AnyDevice('P4', c)
        c.registerDevice(dev)
        expect(events).toHaveLength(0)

        // полная замена (full replacement)
        dev.shares = { on: true, count: 1 }
        expect(events).toHaveLength(1)
        expect(events[0].trace).toEqual({ on: true, count: 1 })

        // новое свойство (new property)
        dev.shares.extra = 'x'
        expect(events).toHaveLength(2)
        expect(events[1].trace.extra).toBe('x')

        // delete
        delete dev.shares.extra
        expect(events).toHaveLength(3)
        expect('extra' in dev.shares).toBe(false)

        // вложенная запись (nested write)
        dev.shares.deep = { x: 1 }
        const before = events.length // +1 за присваивание deep
        dev.shares.deep.x = 2
        expect(events).toHaveLength(before + 1)
        expect(events[before].trace.deep.x).toBe(2)
    })

    it('explicit render() still emits, and mutation + render() gives two events (queued downstream)', () => {
        const { c, events } = makeContainer()
        const dev = new FieldDevice('P5', c)
        c.registerDevice(dev)
        expect(events).toHaveLength(0)

        dev.render()
        expect(events).toHaveLength(1) // явный render без изменений тоже шлет

        const before = events.length
        dev.shares.count = 7
        expect(events).toHaveLength(before + 1) // авто-render
        dev.render()
        expect(events).toHaveLength(before + 2) // + явный render (BC: устройство просто ставится в очередь)
    })

    it('mutations after removeDevice() do not render; explicit render() keeps working', async () => {
        const { c, events } = makeContainer()
        const dev = new FieldDevice('P6', c)
        c.registerDevice(dev)
        dev.shares.count = 1
        expect(events).toHaveLength(1)

        await c.removeDevice('P6')
        const after = events.length
        dev.shares.count = 99
        expect(events).toHaveLength(after) // watcher отключен

        dev.render()
        expect(events).toHaveLength(after + 1) // явный render все еще работает
    })

    it('suppresses a render nested inside a subscriber (re-entrancy guard)', () => {
        const { c, events } = makeContainer()
        const dev = new AnyDevice('P7', c)
        c.registerDevice(dev)
        // подписчик, мутирующий trace прямо во время emit
        c.on('device.render', (e: any) => { e.trace.loop = (e.trace.loop ?? 0) + 1 })

        dev.shares.trigger = 1
        expect(events).toHaveLength(1)
        expect(events[0].trace.loop).toBe(1) // вложенный render подавлен, цикла нет
    })
})

describe('device.render trace is worker-safe', () => {
    it('trace is a plain snapshot (not a proxy) and can be structured-cloned', () => {
        const { c, events } = makeContainer()
        const dev = new AnyDevice('P8', c)
        c.registerDevice(dev)

        dev.shares.nested = { deep: { value: 1 } }
        expect(events).toHaveLength(1)

        const e = events[0]
        // не живая ссылка на shares и не прокси
        expect(e.trace).not.toBe(dev.shares)
        expect(e.trace.nested).not.toBe(dev.shares.nested)
        // structured clone (так копирует postMessage / worker_threads) не должен падать
        const cloned = structuredClone(e)
        expect(cloned.trace).toEqual({ nested: { deep: { value: 1 } } })
    })

    it('trace is a snapshot at the moment of render', () => {
        const { c, events } = makeContainer()
        const dev = new AnyDevice('P9', c)
        c.registerDevice(dev)

        dev.shares.n = 1
        const first = events[0]
        dev.shares.n = 2
        expect(events).toHaveLength(2)
        // первый снимок не меняется от последующих записей
        expect(first.trace.n).toBe(1)
        expect(events[1].trace.n).toBe(2)
    })
})

describe('legacy `shares` class field (BC)', () => {
    it('uses the field value as default shares and stays reactive', () => {
        const { c, events } = makeContainer()
        const dev = new SharesFieldDefault('F1', c)
        c.registerDevice(dev)
        expect(events).toHaveLength(0)
        expect(dev.shares).toEqual({ data: 1 })

        dev.shares.data = 42
        expect(events).toHaveLength(1)
        expect(events[0].trace).toEqual({ data: 42 })
    })

    it('keeps preProcess() refinement of the field default', () => {
        const { c, events } = makeContainer()
        const dev = new SharesFieldRefine('F2', c)
        c.registerDevice(dev)
        expect(events).toHaveLength(0)
        expect(dev.shares).toEqual({ data: 99 })

        dev.shares.data = 5
        expect(events).toHaveLength(1)
        expect(events[0].trace).toEqual({ data: 5 })
    })

    it('keeps preProcess() reassignment of the field default', () => {
        const { c, events } = makeContainer()
        const dev = new SharesFieldReplace('F3', c)
        c.registerDevice(dev)
        expect(events).toHaveLength(0)
        expect(dev.shares).toEqual({ data: 2, extra: true })

        dev.shares.extra = false
        expect(events).toHaveLength(1)
        expect(events[0].trace).toEqual({ data: 2, extra: false })
    })
})

describe('Device.sharesSnapshot()', () => {
    it('returns a deep plain copy: structuredClone succeeds where the proxy fails', () => {
        const { c } = makeContainer()
        const dev = new PreProcDevice('SNAP1', c)
        c.registerDevice(dev)
        dev.shares.on = true
        dev.shares.count = 42

        // the shares getter is a ReactiveRef proxy — structured clone rejects it
        expect(() => structuredClone(dev.shares as object)).toThrow()

        const snap = dev.sharesSnapshot()
        expect(Object.getPrototypeOf(snap)).toBe(Object.prototype)
        // structured clone (postMessage, worker replies) works
        expect(structuredClone(snap)).toEqual(snap)
    })

    it('is decoupled from the reactive value (mutations go both ways)', () => {
        const { c } = makeContainer()
        const dev = new PreProcDevice('SNAP2', c)
        c.registerDevice(dev)

        const snap = dev.sharesSnapshot()
        expect(snap).toEqual({ on: false, count: 0 })
        // mutating the snapshot does not affect the device
        ;(snap as any).on = true
        expect(dev.shares.on).toBe(false)
        // and later device mutations are not reflected in the old snapshot
        dev.shares.count = 1
        expect(snap.count).toBe(0)
    })

    it('unwraps nested proxies, preserves non-plain values, keeps cycles', () => {
        const { c, events } = makeContainer()
        const dev = new AnyDevice('SNAP3', c)
        c.registerDevice(dev)
        const node = { label: 'n1' }
        dev.shares = { nested: { a: 1 }, d: new Date(0), cyc: null }
        ;(dev.shares as any).cyc = dev.shares
        ;(dev.shares as any).list = [node]

        const snap = dev.sharesSnapshot()
        // structured clone succeeds (the proxy itself would throw DataCloneError)
        const cloned = structuredClone(snap)
        expect(cloned.nested).toEqual({ a: 1 })
        expect(cloned.d.getTime()).toBe(0)
        expect(cloned.list[0]).toEqual({ label: 'n1' })
        expect(cloned.cyc).toBe(cloned) // cycle preserved inside the clone
        expect(snap.nested).toEqual({ a: 1 })
        expect(snap.nested).not.toBe((dev.shares as any).nested) // deep copy
        expect(snap.d).toBeInstanceOf(Date)
        expect(snap.d.getTime()).toBe(0)
        expect(snap.list[0]).toEqual({ label: 'n1' })
        expect(snap.list[0]).not.toBe(node)
        expect(snap.cyc).toBe(snap) // cycle preserved in the snapshot
        // the snapshot is a plain object: writing into it does not re-render the device
        const n = events.length
        snap.nested.a = 99
        expect(events).toHaveLength(n)
    })
})
