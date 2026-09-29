/**
 * Device lifecycle stop tests.
 *
 * Verifies the reversible stop semantics (see src/service/Device.ts,
 * src/Container.ts, src/service/DevicePort.ts):
 *
 *  - `Container.stopDevice(id)`: calls `onStop()`, then `await onStopAsync()`,
 *    then marks the device stopped (`running = false`, `isStarted() = false`)
 *  - `stopDevice()` is idempotent; unknown id -> CONT_DEVICE_NF
 *  - stopped device: input ports drop pushed data, actions are rejected
 *    with CONT_DEVICE_STOPPED
 *  - a device that is NOT started is NOT stopped: its ports stay active
 *    (a push made inside `onStart()` reaches the connected receiver —
 *    the service-side command registration flow)
 *  - restart: `startDevice()` after `stopDevice()` re-runs
 *    `onStart()` + `onStartAsync()` and re-enables ports & actions
 *  - `Container.stopAll()`: stops everything in reverse start order,
 *    best-effort, aggregates failures into CONT_DEVICE_STOP_ALL_EXCEPTION
 *  - `onStop()` failure -> CONT_DEVICE_STOP_EXCEPTION
 *  - `onStopAsync()` failure -> CONT_DEVICE_STOP_PROMISE_EXCEPTION
 *  - `onStopAsync()` is really awaited before the device is stopped
 *  - `removeDevice()` on a running device stops it first
 *    (`onStop()` -> `onStopAsync()` -> `onDestroy()`)
 */
import { describe, it, expect } from 'vitest'
import { Container, Device, Port, Action, ErrorManager } from 'vrack2-core'

/* Lifecycle-recording device (mirrors the testkit Tracker fixture) */
class TTracker extends Device {
    order: string[] = []
    count = 0
    destroyed = false

    constructor(id: string, c: Container) { super(id, 'test.TTracker', c) }

    onStart() {
        this.order.push('onStart')
        this.count = 0
    }

    async onStartAsync() { this.order.push('onStartAsync') }

    onStop() { this.order.push('onStop') }

    async onStopAsync() { this.order.push('onStopAsync') }

    onDestroy() {
        this.destroyed = true
        this.order.push('onDestroy')
    }

    inputs() { return { data: Port.standard() } }

    outputs() { return { out: Port.standard() } }

    actions() { return { ping: Action.global() } }

    inputData(data: any) {
        this.count += (typeof data === 'number' && isFinite(data) ? data : 1)
        return this.count
    }

    actionPing() { return 'pong' }
}

/* Device whose onStop() throws synchronously */
class StopFailSync extends Device {
    onStopCalled = false
    promiseCalled = false

    constructor(id: string, c: Container) { super(id, 'test.StopFailSync', c) }

    onStop() {
        this.onStopCalled = true
        throw new Error('stop-boom')
    }

    async onStopAsync() { this.promiseCalled = true }
}

/* Device whose onStopAsync() rejects */
class StopFailPromise extends Device {
    onStopCalled = false

    constructor(id: string, c: Container) { super(id, 'test.StopFailPromise', c) }

    onStop() { this.onStopCalled = true }

    async onStopAsync() { throw new Error('stop-promise-boom') }
}

/* Device with a slow onStopAsync: proves the Container awaits it */
class SlowStop extends Device {
    stopDone = false

    constructor(id: string, c: Container) { super(id, 'test.SlowStop', c) }

    async onStopAsync() {
        await new Promise((r) => setTimeout(r, 10))
        this.stopDone = true
    }
}

/* Device that pushes to its output port during onStart() — like the
   service-side command registration (e.g. Guard -> ServiceManager):
   its own startup is not finished yet, but it is not stopped,
   so the push must reach the connected receiver */
class RegSender extends Device {
    constructor(id: string, c: Container) { super(id, 'test.RegSender', c) }

    onStart() { this.ports.output.reg.push(42) }

    inputs() { return { data: Port.standard() } }

    outputs() { return { reg: Port.standard() } }

    inputData(data: any) { return data }
}

function makeContainer() {
    return new Container('stop-test', {} as any)
}

async function catchError(fn: () => Promise<any>) {
    try {
        await fn()
        return undefined
    } catch (e) {
        return e as any
    }
}

describe('Container.stopDevice()', () => {

    it('stops a running device: onStop() -> await onStopAsync(), state -> stopped', async () => {
        const c = makeContainer()
        const dev = new TTracker('T1', c)
        c.registerDevice(dev)
        await c.startDevice('T1')
        expect(dev.running).toBe(true)
        expect(c.isStarted('T1')).toBe(true)

        await c.stopDevice('T1')

        expect(dev.order).toEqual(['onStart', 'onStartAsync', 'onStop', 'onStopAsync'])
        expect(dev.running).toBe(false)
        expect(c.isStarted('T1')).toBe(false)
    })

    it('emits a stop event for the device', async () => {
        const c = makeContainer()
        const dev = new TTracker('T1', c)
        c.registerDevice(dev)
        await c.startDevice('T1')

        const events: string[] = []
        c.on('device.stop', (id: string) => events.push(id))

        await c.stopDevice('T1')

        expect(events).toEqual(['T1'])
    })

    it('is idempotent: a stopped device is not stopped again', async () => {
        const c = makeContainer()
        const dev = new TTracker('T1', c)
        c.registerDevice(dev)
        await c.startDevice('T1')

        await c.stopDevice('T1')
        await c.stopDevice('T1')

        expect(dev.order.filter((o: string) => o === 'onStop')).toHaveLength(1)
        expect(dev.order.filter((o: string) => o === 'onStopAsync')).toHaveLength(1)
        expect(c.isStarted('T1')).toBe(false)
    })

    it('is a no-op for a registered but not started device', async () => {
        const c = makeContainer()
        const dev = new TTracker('T1', c)
        c.registerDevice(dev)

        await c.stopDevice('T1')

        expect(dev.order).toEqual([])
        // never stopped: the no-op stop does not touch running (the old `works = true` semantics)
        expect(dev.running).toBe(true)
        expect(c.isStarted('T1')).toBe(false)
    })

    it('unknown id -> CONT_DEVICE_NF', async () => {
        const c = makeContainer()
        const err = await catchError(() => c.stopDevice('Nope'))
        expect(err).toBeDefined()
        expect(ErrorManager.isCode(err, 'CONT_DEVICE_NF')).toBe(true)
    })

    it('onStop() failure -> CONT_DEVICE_STOP_EXCEPTION, onStopAsync() is not called, device stays started', async () => {
        const c = makeContainer()
        const dev = new StopFailSync('F1', c)
        c.registerDevice(dev)
        await c.startDevice('F1')

        const err = await catchError(() => c.stopDevice('F1'))

        expect(err).toBeDefined()
        expect(ErrorManager.isCode(err, 'CONT_DEVICE_STOP_EXCEPTION')).toBe(true)
        expect(err.vAddErrors[0].message).toBe('stop-boom')
        expect(dev.promiseCalled).toBe(false)
        // stop did not complete: the device is still "running" and can be stopped again
        expect(c.isStarted('F1')).toBe(true)
    })

    it('onStopAsync() failure -> CONT_DEVICE_STOP_PROMISE_EXCEPTION, device stays started', async () => {
        const c = makeContainer()
        const dev = new StopFailPromise('F1', c)
        c.registerDevice(dev)
        await c.startDevice('F1')

        const err = await catchError(() => c.stopDevice('F1'))

        expect(err).toBeDefined()
        expect(ErrorManager.isCode(err, 'CONT_DEVICE_STOP_PROMISE_EXCEPTION')).toBe(true)
        expect(err.vAddErrors[0].message).toBe('stop-promise-boom')
        expect(dev.onStopCalled).toBe(true)
        expect(c.isStarted('F1')).toBe(true)
    })

    it('onStopAsync() is really awaited before the device is stopped', async () => {
        const c = makeContainer()
        const dev = new SlowStop('S1', c)
        c.registerDevice(dev)
        await c.startDevice('S1')

        await c.stopDevice('S1')

        expect(dev.stopDone).toBe(true)
        expect(c.isStarted('S1')).toBe(false)
    })
})

describe('stopped device behavior', () => {

    it('input ports drop pushed data while stopped, flow again after restart', async () => {
        const c = makeContainer()
        const dev = new TTracker('T1', c)
        c.registerDevice(dev)
        await c.startDevice('T1')

        dev.ports.input.data.push(5)
        expect(dev.count).toBe(5)

        await c.stopDevice('T1')
        dev.ports.input.data.push(7)
        expect(dev.count).toBe(5) // dropped: the device is stopped

        await c.startDevice('T1') // restart: onStart() resets the counter
        dev.ports.input.data.push(3)
        expect(dev.count).toBe(3) // flowing again
    })

    it('a not started device accepts port pushes (it is not stopped — startup traffic flows)', () => {
        const c = makeContainer()
        const dev = new TTracker('T1', c)
        c.registerDevice(dev)

        // registered but never started: the port accepts data (the old `works = true` semantics)
        dev.ports.input.data.push(5)
        expect(dev.count).toBe(5)
        expect(dev.running).toBe(true)
    })

    it('a push made during onStart() reaches the connected receiver (command registration flow)', async () => {
        const c = makeContainer()
        const sender = new RegSender('S1', c)
        const recv = new TTracker('R1', c)
        c.registerDevice(sender)
        c.registerDevice(recv)
        c.addConnection('S1.reg -> R1.data')

        await c.startDevice('S1') // sender is not stopped: its onStart() push must be delivered

        expect(recv.count).toBe(42) // the push from inside onStart() was delivered
    })

    it('actions are rejected with CONT_DEVICE_STOPPED while stopped, work again after restart', async () => {
        const c = makeContainer()
        const dev = new TTracker('T1', c)
        c.registerDevice(dev)
        await c.startDevice('T1')

        expect(await c.deviceAction('T1', 'ping', {})).toBe('pong')

        await c.stopDevice('T1')

        const err = await catchError(() => c.deviceAction('T1', 'ping', {}))
        expect(err).toBeDefined()
        expect(ErrorManager.isCode(err, 'CONT_DEVICE_STOPPED')).toBe(true)

        await c.startDevice('T1')
        expect(await c.deviceAction('T1', 'ping', {})).toBe('pong')
    })
})

describe('restart', () => {

    it('startDevice() after stopDevice() re-runs onStart() + onStartAsync()', async () => {
        const c = makeContainer()
        const dev = new TTracker('T1', c)
        c.registerDevice(dev)
        await c.startDevice('T1')
        await c.stopDevice('T1')
        await c.startDevice('T1')

        expect(dev.order).toEqual([
            'onStart', 'onStartAsync',
            'onStop', 'onStopAsync',
            'onStart', 'onStartAsync',
        ])
        expect(dev.running).toBe(true)
        expect(c.isStarted('T1')).toBe(true)
    })
})

describe('Container.stopAll()', () => {

    it('stops all running devices in reverse start order', async () => {
        const c = makeContainer()
        const a = new TTracker('A', c)
        const b = new TTracker('B', c)
        c.registerDevice(a)
        c.registerDevice(b)
        await c.startDevice('A')
        await c.startDevice('B')

        const events: string[] = []
        c.on('service.stop.begin', () => events.push('service.stop.begin'))
        c.on('device.stop', (id: string) => events.push('device.stop:' + id))
        c.on('service.stop.end', () => events.push('service.stop.end'))

        await c.stopAll()

        expect(events).toEqual(['service.stop.begin', 'device.stop:B', 'device.stop:A', 'service.stop.end'])
        expect(c.isStarted('A')).toBe(false)
        expect(c.isStarted('B')).toBe(false)
        expect(a.running).toBe(false)
        expect(b.running).toBe(false)
    })

    it('is a no-op when nothing is running', async () => {
        const c = makeContainer()
        const a = new TTracker('A', c)
        c.registerDevice(a)
        await c.startDevice('A')
        await c.stopDevice('A')

        const events: string[] = []
        c.on('device.stop', () => events.push('device.stop'))

        await c.stopAll() // must not throw

        expect(events).toEqual([])
        expect(a.order.filter((o: string) => o === 'onStop')).toHaveLength(1)
    })

    it('best-effort: keeps stopping the rest on a failure and throws an aggregated error', async () => {
        const c = makeContainer()
        const bad = new StopFailPromise('Bad', c)
        const ok = new TTracker('Ok', c)
        c.registerDevice(bad)
        c.registerDevice(ok)
        await c.startDevice('Bad')
        await c.startDevice('Ok')

        const err = await catchError(() => c.stopAll())

        // the healthy device was stopped despite the other failure
        expect(c.isStarted('Ok')).toBe(false)
        expect(ok.order).toContain('onStop')
        expect(ok.order).toContain('onStopAsync')
        // the failed device did not complete its stop
        expect(c.isStarted('Bad')).toBe(true)

        expect(err).toBeDefined()
        expect(ErrorManager.isCode(err, 'CONT_DEVICE_STOP_ALL_EXCEPTION')).toBe(true)
        expect(err.vAddErrors).toHaveLength(1)
        expect(err.vAddErrors[0].vShort).toBe('CONT_DEVICE_STOP_PROMISE_EXCEPTION')
    })
})

describe('removeDevice() with stop', () => {

    it('a running device is stopped first: onStop() -> onStopAsync() -> onDestroy()', async () => {
        const c = makeContainer()
        const dev = new TTracker('T1', c)
        c.registerDevice(dev)
        await c.startDevice('T1')

        await c.removeDevice('T1')

        expect(dev.order).toEqual(['onStart', 'onStartAsync', 'onStop', 'onStopAsync', 'onDestroy'])
        expect(dev.running).toBe(false)
        expect(c.hasDevice('T1')).toBe(false)
    })

    it('a not started device goes straight to onDestroy (no stop hooks)', async () => {
        const c = makeContainer()
        const dev = new TTracker('T1', c)
        c.registerDevice(dev)

        await c.removeDevice('T1')

        expect(dev.destroyed).toBe(true)
        expect(dev.order).toEqual(['onDestroy'])
    })
})