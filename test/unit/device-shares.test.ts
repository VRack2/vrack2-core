/**
 * Unit tests for Device `shares` auto-render.
 *
 * Behavior under test (see src/service/Device.ts, src/Container.ts):
 *  - `shares` is reactive (backed by ReactiveRef): a property write,
 *    a new property, `delete` and a full reassignment trigger `render()`
 *  - the Container attaches the watcher AFTER `preProcess()`, so
 *    initialization writes inside `preProcess()` do not render
 *  - `removeDevice()` detaches the watcher (no renders, no leaks)
 *  - explicit `render()` always emits (BC) and is re-entrancy safe
 */
import { describe, it, expect } from 'vitest'
import { Container, Device } from 'vrack2-core'

class ProbeDevice extends Device {
    constructor(id: string, c: Container) { super(id, 'test.Probe', c) }
    preProcess() {
        this.shares = { on: false, count: 0 }
    }
}

class FieldDevice extends Device {
    // явная инициализация в теле конструктора (присваивание идет через setter) —
    // безопасный паттерн во всех транспилерах; поле-декларацию `shares = {...}`
    // в подклассе Container нормализует сам (см. блок ниже)
    constructor(id: string, c: Container) {
        super(id, 'test.Field', c)
        this.shares = { on: false }
    }
}

function makeContainer() {
    const c = new Container('ut', {} as any)
    const events: any[] = []
    c.on('device.render', (e: any) => events.push(e))
    return { c, events }
}

describe('Device shares auto-render', () => {
    it('preProcess() writes do not render; post-attach writes do', () => {
        const { c, events } = makeContainer()
        const dev = new ProbeDevice('P1', c)
        c.registerDevice(dev)
        expect(events).toHaveLength(0)
        expect(dev.shares).toEqual({ on: false, count: 0 })

        dev.shares.count = 5
        expect(events).toHaveLength(1)
        expect(events[0].device).toBe('P1')
        expect(events[0].trace.count).toBe(5)
    })

    it('triggers render on reassignment, new property, delete and nested write', () => {
        const { c, events } = makeContainer()
        const dev = new ProbeDevice('P1', c)
        c.registerDevice(dev)
        expect(events).toHaveLength(0)

        // полная замена
        dev.shares = { on: true, count: 1 }
        expect(events).toHaveLength(1)
        expect(events[0].trace).toEqual({ on: true, count: 1 })

        // новое свойство
        dev.shares.extra = 'x'
        expect(events).toHaveLength(2)
        expect(events[1].trace.extra).toBe('x')

        // delete
        delete dev.shares.extra
        expect(events).toHaveLength(3)
        expect('extra' in dev.shares).toBe(false)

        // вложенная запись
        dev.shares.deep = { x: 1 }
        const before = events.length // +1 за присваивание deep
        dev.shares.deep.x = 2
        expect(events).toHaveLength(before + 1)
        expect(events[before].trace.deep.x).toBe(2)
    })

    it('explicit render() still emits, and mutation + render() gives two events (queued downstream)', () => {
        const { c, events } = makeContainer()
        const dev = new ProbeDevice('P1', c)
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

    it('mutations after removeDevice() do not render; explicit render() keeps working', () => {
        const { c, events } = makeContainer()
        const dev = new ProbeDevice('P1', c)
        c.registerDevice(dev)
        dev.shares.count = 1
        expect(events).toHaveLength(1)

        c.removeDevice('P1')
        const after = events.length
        dev.shares.count = 99
        expect(events).toHaveLength(after) // watcher отключен

        dev.render()
        expect(events).toHaveLength(after + 1) // явный render все еще работает
    })

    it('suppresses a render nested inside a subscriber (re-entrancy guard)', () => {
        const { c, events } = makeContainer()
        const dev = new ProbeDevice('P2', c)
        c.registerDevice(dev)
        // подписчик, мутирующий trace прямо во время emit
        c.on('device.render', (e: any) => { e.trace.loop = (e.trace.loop ?? 0) + 1 })

        dev.shares.trigger = 1
        expect(events).toHaveLength(1)
        expect(events[0].trace.loop).toBe(1) // вложенный render подавлен, цикла нет
    })

    it('keeps a subclass shares init (constructor-body assignment) reactive', () => {
        const { c, events } = makeContainer()
        const dev = new FieldDevice('F1', c)
        c.registerDevice(dev)
        expect(dev.shares).toEqual({ on: false })

        dev.shares.on = true
        expect(events).toHaveLength(1)
        expect(events[0].trace.on).toBe(true)
    })

    it('does not expose __isReactive in Object.keys of device shares', () => {
        const { c } = makeContainer()
        const dev = new ProbeDevice('P1', c)
        c.registerDevice(dev)
        expect(Object.keys(dev.shares)).toEqual(['on', 'count'])
    })
})

describe('subclass `shares = {...}` field declaration', () => {
    it('uses the field value as default shares and stays reactive', () => {
        const { c, events } = makeContainer()
        class FieldInit extends Device {
            constructor(id: string, cc: Container) { super(id, 'test.FieldInit', cc) }
            shares = { data: 1 }
        }
        const dev = new FieldInit('F1', c)
        c.registerDevice(dev)
        expect(events).toHaveLength(0)
        expect(dev.shares).toEqual({ data: 1 })

        dev.shares.data = 42
        expect(events).toHaveLength(1)
        expect(events[0].trace).toEqual({ data: 42 })
    })

    it('keeps preProcess() refinement of the field default', () => {
        const { c, events } = makeContainer()
        class FieldRefine extends Device {
            constructor(id: string, cc: Container) { super(id, 'test.FieldRefine', cc) }
            shares = { data: 1 }
            preProcess() {
                this.shares.data = 99
            }
        }
        const dev = new FieldRefine('F2', c)
        c.registerDevice(dev)
        expect(events).toHaveLength(0)
        expect(dev.shares).toEqual({ data: 99 })

        dev.shares.data = 5
        expect(events).toHaveLength(1)
        expect(events[0].trace).toEqual({ data: 5 })
    })

    it('keeps preProcess() reassignment of the field default', () => {
        const { c, events } = makeContainer()
        class FieldReplace extends Device {
            constructor(id: string, cc: Container) { super(id, 'test.FieldReplace', cc) }
            shares = { data: 1 }
            preProcess() {
                this.shares = { data: 2, extra: true }
            }
        }
        const dev = new FieldReplace('F3', c)
        c.registerDevice(dev)
        expect(events).toHaveLength(0)
        expect(dev.shares).toEqual({ data: 2, extra: true })

        dev.shares.extra = false
        expect(events).toHaveLength(1)
        expect(events[0].trace).toEqual({ data: 2, extra: false })
    })

    it('normalizes a bare `shares` annotation (no crash, base default {})', () => {
        const { c, events } = makeContainer()
        class FieldBare extends Device {
            constructor(id: string, cc: Container) { super(id, 'test.FieldBare', cc) }
            shares: { data: number }
        }
        const dev = new FieldBare('F4', c)
        c.registerDevice(dev)
        expect(dev.shares).toEqual({})

        dev.shares.data = 5
        expect(events).toHaveLength(1)
        expect(events[0].trace).toEqual({ data: 5 })
    })
})