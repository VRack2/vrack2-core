/**
 * Lifecycle hook deprecation tests — new `on*` names + deprecated old names.
 *
 * Behavior under test (see src/service/Device.ts, src/boot/BootClass.ts,
 * src/Container.ts, src/Bootstrap.ts):
 *
 *  - The Container now calls the NEW canonical hooks (`onRegister`, `onStart`,
 *    `onStartAsync`, `onStop`, `onStopAsync`, `onDestroy`) and — for the
 *    deprecation window — ALSO the deprecated old ones (`preProcess`, `process`,
 *    `processPromise`, `stop`, `stopPromise`, `beforeTerminate`).
 *  - Every base method is an empty no-op, so a device overriding only ONE name
 *    (new OR old) keeps working — no `super` call is required to keep the other.
 *  - If a device overrides BOTH names, both run (new first) — migration-safe.
 *  - BootClass mirrors this for `onStart` / `onStartAsync` / `onDestroy`.
 */
import { describe, it, expect } from 'vitest'
import { Container, Device, BootClass } from 'vrack2-core'

/* Overrides ONLY the new names */
class NewOnly extends Device {
    order: string[] = []
    constructor(id: string, c: Container) { super(id, 'test.NewOnly', c) }
    onRegister() { this.order.push('onRegister') }
    onStart() { this.order.push('onStart') }
    async onStartAsync() { this.order.push('onStartAsync') }
    onStop() { this.order.push('onStop') }
    async onStopAsync() { this.order.push('onStopAsync') }
    onDestroy() { this.order.push('onDestroy') }
}

/* Overrides ONLY the deprecated old names (back-compat path) */
class OldOnly extends Device {
    order: string[] = []
    constructor(id: string, c: Container) { super(id, 'test.OldOnly', c) }
    preProcess() { this.order.push('preProcess') }
    process() { this.order.push('process') }
    async processPromise() { this.order.push('processPromise') }
    stop() { this.order.push('stop') }
    async stopPromise() { this.order.push('stopPromise') }
    beforeTerminate() { this.order.push('beforeTerminate') }
}

/* Overrides BOTH names — migration in progress; both must run, no `super` */
class Both extends Device {
    order: string[] = []
    constructor(id: string, c: Container) { super(id, 'test.Both', c) }
    onRegister() { this.order.push('onRegister') }
    onStart() { this.order.push('onStart') }
    async onStartAsync() { this.order.push('onStartAsync') }
    onStop() { this.order.push('onStop') }
    async onStopAsync() { this.order.push('onStopAsync') }
    onDestroy() { this.order.push('onDestroy') }
    preProcess() { this.order.push('preProcess') }
    process() { this.order.push('process') }
    async processPromise() { this.order.push('processPromise') }
    stop() { this.order.push('stop') }
    async stopPromise() { this.order.push('stopPromise') }
    beforeTerminate() { this.order.push('beforeTerminate') }
}

function makeContainer() {
    return new Container('lifecycle-hooks', {} as any)
}

describe('Device hooks — new on* names', () => {
    it('runs every new-name hook at its phase, in order', async () => {
        const c = makeContainer()
        const dev = new NewOnly('N', c)
        c.registerDevice(dev)
        await c.startDevice('N')
        await c.stopDevice('N')
        await c.removeDevice('N')
        expect(dev.order).toEqual(['onRegister', 'onStart', 'onStartAsync', 'onStop', 'onStopAsync', 'onDestroy'])
    })
})

describe('Device hooks — deprecated old names still work (back-compat)', () => {
    it('runs every old-name hook at its phase, in order', async () => {
        const c = makeContainer()
        const dev = new OldOnly('O', c)
        c.registerDevice(dev)
        await c.startDevice('O')
        await c.stopDevice('O')
        await c.removeDevice('O')
        expect(dev.order).toEqual(['preProcess', 'process', 'processPromise', 'stop', 'stopPromise', 'beforeTerminate'])
    })
})

describe('Device hooks — overriding both names (no `super` needed)', () => {
    it('runs both new and old hooks for each phase (new first)', async () => {
        const c = makeContainer()
        const dev = new Both('B', c)
        c.registerDevice(dev)
        await c.startDevice('B')
        await c.stopDevice('B')
        await c.removeDevice('B')
        expect(dev.order).toEqual([
            'onRegister', 'preProcess',
            'onStart', 'process',
            'onStartAsync', 'processPromise',
            'onStop', 'stop',
            'onStopAsync', 'stopPromise',
            'onDestroy', 'beforeTerminate',
        ])
    })
})

/* BootClass overriding ONLY the new names */
class BootNewOnly extends BootClass {
    order: string[] = []
    onStart() { this.order.push('onStart') }
    async onStartAsync() { this.order.push('onStartAsync') }
    async onDestroy() { this.order.push('onDestroy') }
}

/* BootClass overriding BOTH names */
class BootBoth extends BootClass {
    order: string[] = []
    onStart() { this.order.push('onStart') }
    async onStartAsync() { this.order.push('onStartAsync') }
    async onDestroy() { this.order.push('onDestroy') }
    process() { this.order.push('process') }
    async processPromise() { this.order.push('processPromise') }
    async terminate() { this.order.push('terminate') }
}

describe('BootClass hooks — new on* names', () => {
    it('overriding only the new name works; the old base is a harmless no-op', () => {
        const boot = new BootNewOnly('B', 'BootNewOnly', null, {}) as any
        // the core calls new + old for each phase; only the override records
        boot.onStart()
        boot.process() // base no-op: nothing recorded
        expect(boot.order).toEqual(['onStart'])
    })

    it('overriding both names runs both, independently (no `super` needed)', async () => {
        const boot = new BootBoth('B', 'BootBoth', null, {}) as any
        boot.onStart()
        boot.process()
        await boot.onStartAsync()
        await boot.processPromise()
        await boot.onDestroy()
        await boot.terminate()
        expect(boot.order).toEqual(['onStart', 'process', 'onStartAsync', 'processPromise', 'onDestroy', 'terminate'])
    })
})
