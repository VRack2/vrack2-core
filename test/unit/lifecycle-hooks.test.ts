/**
 * Lifecycle hook tests — the canonical `on*` names.
 *
 * Behavior under test (see src/service/Device.ts, src/boot/BootClass.ts,
 * src/Container.ts, src/Bootstrap.ts):
 *
 *  - The Container calls the canonical hooks (`onRegister`, `onStart`,
 *    `onStartAsync`, `onStop`, `onStopAsync`, `onDestroy`) at each lifecycle
 *    phase, in order.
 *  - Every base hook is an empty no-op, so a device overriding a subset keeps
 *    working without a `super` call.
 *  - BootClass mirrors this for `onStart` / `onStartAsync` / `onDestroy`.
 */
import { describe, it, expect } from 'vitest'
import { Container, Device, BootClass } from 'vrack2-core'

/* Overrides every canonical hook and records the call order */
class HookTracker extends Device {
    order: string[] = []
    constructor(id: string, c: Container) { super(id, 'test.HookTracker', c) }
    onRegister() { this.order.push('onRegister') }
    onStart() { this.order.push('onStart') }
    async onStartAsync() { this.order.push('onStartAsync') }
    onStop() { this.order.push('onStop') }
    async onStopAsync() { this.order.push('onStopAsync') }
    onDestroy() { this.order.push('onDestroy') }
}

/* Overrides only a subset — no `super` needed, the rest stay no-ops */
class SubsetTracker extends Device {
    order: string[] = []
    constructor(id: string, c: Container) { super(id, 'test.SubsetTracker', c) }
    onStart() { this.order.push('onStart') }
    onDestroy() { this.order.push('onDestroy') }
}

function makeContainer() {
    return new Container('lifecycle-hooks', {} as any)
}

describe('Device hooks — canonical on* names', () => {
    it('runs every hook at its phase, in order', async () => {
        const c = makeContainer()
        const dev = new HookTracker('N', c)
        c.registerDevice(dev)
        await c.startDevice('N')
        await c.stopDevice('N')
        await c.removeDevice('N')
        expect(dev.order).toEqual(['onRegister', 'onStart', 'onStartAsync', 'onStop', 'onStopAsync', 'onDestroy'])
    })

    it('a device overriding a subset still works (no `super` needed)', async () => {
        const c = makeContainer()
        const dev = new SubsetTracker('S', c)
        c.registerDevice(dev)
        await c.startDevice('S')
        await c.stopDevice('S')
        await c.removeDevice('S')
        expect(dev.order).toEqual(['onStart', 'onDestroy'])
    })
})

/* BootClass overriding every canonical hook and recording the call order */
class BootTracker extends BootClass {
    order: string[] = []
    onStart() { this.order.push('onStart') }
    async onStartAsync() { this.order.push('onStartAsync') }
    async onDestroy() { this.order.push('onDestroy') }
}

describe('BootClass hooks — canonical on* names', () => {
    it('runs every hook at its phase, in order', async () => {
        const boot = new BootTracker('B', 'BootTracker', null, {}) as any
        boot.onStart()
        await boot.onStartAsync()
        await boot.onDestroy()
        expect(boot.order).toEqual(['onStart', 'onStartAsync', 'onDestroy'])
    })
})
