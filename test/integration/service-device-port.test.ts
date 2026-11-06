/**
 * Integration tests: the `device.port` event (output capture) — emitted for
 * default output ports, suppressed by `noCapture()`, never for input ports, and
 * non-intrusive (observing does not block the data flow).
 */
import { describe, it, expect } from 'vitest'
import { makeMP, useTmpDir } from './service-helpers'

useTmpDir()

describe('device.port event (output capture)', () => {

    it('emits device.port for a default output port and suppresses it with noCapture()', async () => {
        const mp = makeMP({
            devices: [{ id: 'Src1', type: 'testkit.NoCaptureSrc', options: {} }],
            connections: [],
        })
        await mp.run()

        const dev: any = mp.Container.devices['Src1']
        const events: any[] = []
        mp.Container.on('device.port', (e: any) => events.push(e))

        // 'open' is a default output -> emits; 'hidden' has noCapture() -> silent.
        dev.ports.output.open.push(42)
        dev.ports.output.hidden.push(43)

        expect(events).toEqual([
            { device: 'Src1', data: 'open', trace: 42 },
        ])
    })

    it('does not emit for input ports, and the flow is non-intrusive (data still reaches the connected device)', async () => {
        const mp = makeMP({
            devices: [
                { id: 'Counter1', type: 'testkit.Counter', options: { scale: 1 } },
                { id: 'Lamp1', type: 'testkit.Lamp', options: {} },
            ],
            connections: ['Counter1.result -> Lamp1.on'],
        })
        await mp.run()

        const c: any = mp.Container.devices['Counter1']
        const l: any = mp.Container.devices['Lamp1']
        const events: any[] = []
        mp.Container.on('device.port', (e: any) => events.push(e))

        // Tick into Counter's INPUT port; it computes and pushes its OUTPUT 'result'.
        c.ports.input.data.push(5)

        // Counter's output emitted the event; input ports (data/on) never do.
        const resultEvents = events.filter((e) => e.device === 'Counter1' && e.data === 'result')
        expect(resultEvents).toEqual([{ device: 'Counter1', data: 'result', trace: 5 }])
        expect(events.every((e) => e.data !== 'data' && e.data !== 'on')).toBe(true)

        // Non-intrusive: observing did not block the flow — Lamp actually processed the value.
        expect(l.state.on).toBe(true)
        expect(l.state.brightness).toBe(200) // maxBrightness default
    })
})
