/**
 * Device status tests.
 *
 * The Container keeps one systematized status record per registered device
 * (src/service/IDeviceStatus.ts) and emits a full snapshot on the
 * 'device.status' channel every time it changes:
 *  - registerDevice()                    -> initial state 'registered'
 *  - startDevice() / runProcess() success-> state 'started'
 *  - stopDevice() success                -> state 'stopped'
 *  - device.alert / device.error /
 *    device.terminate messages           -> lastAlert/lastError + counters
 *  - removeDevice()                      -> record deleted, no more events
 */
import { describe, it, expect } from 'vitest'
import { Container, Device, Port } from 'vrack2-core'

class SStatus extends Device {
    constructor(id: string, c: Container) { super(id, 'test.SStatus', c) }

    inputs() { return { data: Port.standard() } }

    outputs() { return { out: Port.standard() } }

    inputData(data: any) { return data }
}

function makeContainer() {
    return new Container('status-test', {} as any)
}

interface IStatusEvent { device: string; data: string; trace: any }

describe('initial status (registerDevice)', () => {

    it('creates a "registered" record and emits an initial snapshot', () => {
        const c = makeContainer()
        const events: IStatusEvent[] = []
        c.on('device.status', (e: IStatusEvent) => events.push(e))

        c.registerDevice(new SStatus('S1', c))

        expect(events).toHaveLength(1)
        expect(events[0].device).toBe('S1')
        expect(events[0].data).toBe('status')

        const st = c.getDeviceStatus('S1')!
        expect(st.id).toBe('S1')
        expect(st.type).toBe('test.SStatus')
        expect(st.state).toBe('registered')
        expect(typeof st.since).toBe('number')
        expect(st.lastAlert).toBeNull()
        expect(st.lastError).toBeNull()
        expect(st.alertCount).toBe(0)
        expect(st.errorCount).toBe(0)

        // the event snapshot matches the record
        expect(events[0].trace.state).toBe('registered')
    })

    it('getDeviceStatus returns undefined for an unknown device', () => {
        const c = makeContainer()
        expect(c.getDeviceStatus('NOPE')).toBeUndefined()
        expect(c.deviceStatusList()).toEqual([])
    })

    it('deviceStatusList returns copies (external mutation is safe)', () => {
        const c = makeContainer()
        c.registerDevice(new SStatus('S1', c))

        const list = c.deviceStatusList()
        list[0].state = 'stopped' as any

        expect(c.getDeviceStatus('S1')!.state).toBe('registered')
    })
})

describe('lifecycle transitions', () => {

    it('start -> stop -> start keeps one record and emits per change', async () => {
        const c = makeContainer()

        const states: string[] = []
        c.on('device.status', (e: IStatusEvent) => states.push(e.trace.state))

        c.registerDevice(new SStatus('S1', c))

        await c.startDevice('S1')
        expect(c.getDeviceStatus('S1')!.state).toBe('started')

        await c.stopDevice('S1')
        expect(c.getDeviceStatus('S1')!.state).toBe('stopped')

        await c.startDevice('S1')
        expect(c.getDeviceStatus('S1')!.state).toBe('started')

        expect(states).toEqual(['registered', 'started', 'stopped', 'started'])
    })

    it('runProcess() marks all devices started (initial snapshots included)', async () => {
        const c = makeContainer()
        c.registerDevice(new SStatus('A', c))
        c.registerDevice(new SStatus('B', c))

        const last: Record<string, string> = {}
        c.on('device.status', (e: IStatusEvent) => { last[e.device] = e.trace.state })

        await c.runProcess()

        expect(c.getDeviceStatus('A')!.state).toBe('started')
        expect(c.getDeviceStatus('B')!.state).toBe('started')
        expect(last.A).toBe('started')
        expect(last.B).toBe('started')
    })

    it('stopAll() marks all devices stopped', async () => {
        const c = makeContainer()
        c.registerDevice(new SStatus('A', c))
        c.registerDevice(new SStatus('B', c))
        await c.startDevice('A')
        await c.startDevice('B')

        await c.stopAll()

        expect(c.getDeviceStatus('A')!.state).toBe('stopped')
        expect(c.getDeviceStatus('B')!.state).toBe('stopped')
    })
})

describe('alert & error tracking', () => {

    it('device.alert updates lastAlert and alertCount; snapshot is a copy', async () => {
        const c = makeContainer()
        const dev = new SStatus('S1', c)
        c.registerDevice(dev)
        await c.startDevice('S1')

        const events: IStatusEvent[] = []
        c.on('device.status', (e: IStatusEvent) => events.push(e))

        dev.alert('low battery', { level: 20 })

        const st = c.getDeviceStatus('S1')!
        expect(st.lastAlert).toMatchObject({ data: 'low battery', trace: { level: 20 } })
        expect(typeof st.lastAlert!.at).toBe('number')
        expect(st.alertCount).toBe(1)
        expect(st.errorCount).toBe(0)

        // the event snapshot is a copy — mutation must not corrupt the record
        events[events.length - 1].trace.lastAlert.data = 'MUTATED'
        expect(c.getDeviceStatus('S1')!.lastAlert!.data).toBe('low battery')
    })

    it('device.error objectifies Error traces and updates lastError', async () => {
        const c = makeContainer()
        const dev = new SStatus('S1', c)
        c.registerDevice(dev)
        await c.startDevice('S1')

        dev.error('boom', new Error('inner-fail'))

        const st = c.getDeviceStatus('S1')!
        expect(st.lastError).toBeDefined()
        expect(st.lastError!.data).toBe('boom')
        // Error -> plain object (not an instance of Error)
        expect(st.lastError!.trace).not.toBeInstanceOf(Error)
        expect(st.errorCount).toBe(1)
    })

    it('device.terminate is recorded as an error', async () => {
        const c = makeContainer()
        const dev = new SStatus('S1', c)
        c.registerDevice(dev)
        await c.startDevice('S1')

        dev.error('first', {})
        dev.terminate(new Error('crit'), 'action.crit')

        const st = c.getDeviceStatus('S1')!
        expect(st.lastError!.data).toBe('action.crit')
        // terminate passes a raw Error — it must be normalized to a plain object
        expect(st.lastError!.trace).not.toBeInstanceOf(Error)
        expect(st.errorCount).toBe(2)
    })
})

describe('removal', () => {

    it('removeDevice() deletes the record; later events do not resurrect it', async () => {
        const c = makeContainer()
        const dev = new SStatus('S1', c)
        c.registerDevice(dev)
        await c.startDevice('S1')

        await c.removeDevice('S1')
        expect(c.getDeviceStatus('S1')).toBeUndefined()

        let statusEventsAfterRemoval = 0
        c.on('device.status', () => { statusEventsAfterRemoval++ })

        dev.alert('ghost', {}) // a message from a removed device

        expect(statusEventsAfterRemoval).toBe(0)
        expect(c.getDeviceStatus('S1')).toBeUndefined()
    })
})

