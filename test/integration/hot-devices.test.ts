/**
 * Hot device / connection management tests.
 *
 * Verifies the hot API on the ServiceLoader (mp.Loader) and the runtime
 * Container:
 *   - Loader.checkDevice() / Loader.checkConnection()   (dry-run, no side effects)
 *   - Loader.addDevice() + Container.startDevice()      (hot add + idempotent start)
 *   - Loader.addConnection()                            (hot connection)
 *   - Loader.removeDevice()                             (cleanup + beforeTerminate + event)
 *   - Container.hasDevice() / getDevice() / deviceList() / isStarted()
 *
 * The Loader emits `serviceLoaded` after each hot mutation, which is what
 * persists the structure to disk.
 *
 * Uses the `testkit` fixture vendor (Lamp, Counter, ReturnSrc, Tracker).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import path from 'path'
import os from 'os'
import fs from 'fs'

import {
    MainProcess,
    ErrorManager,
    DeviceMetrics,
    IMainProcessOptions,
    IServiceStructure,
} from 'vrack2-core'

const FIXTURES = path.resolve(__dirname, '../fixtures')

let tmp = ''
beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vrack2-hot-'))
})
afterEach(() => {
    if (tmp && fs.existsSync(tmp)) fs.rmSync(tmp, { recursive: true, force: true })
})

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

function makeMP(service: IServiceStructure, extraBoot: IMainProcessOptions['bootstrap'] = {}): MainProcess {
    return new MainProcess({
        id: 'hot',
        service,
        bootstrap: {
            DeviceManager: { path: 'vrack2-core.DeviceManager', options: { systemDir: FIXTURES, dir: 'devices' } },
            DeviceStorage: { path: 'vrack2-core.DeviceFileStorage', options: { storageDir: path.join(tmp, 'storage') } },
            StructureStorage: { path: 'vrack2-core.StructureStorage', options: { structureDir: path.join(tmp, 'structure') } },
            DeviceMetrics: { path: 'vrack2-core.DeviceMetrics', options: {} },
            ...extraBoot,
        },
    })
}

const structFile = () => path.join(tmp, 'structure', 'hot.json')
const readStruct = () => JSON.parse(fs.readFileSync(structFile(), 'utf-8'))

/* ================================================================== */
/*  DRY-RUN CHECKS (no side effects)                                   */
/* ================================================================== */

describe('checkDevice()', () => {

    it('valid config -> valid:true and no device is registered', async () => {
        const mp = makeMP({ devices: [{ id: 'Counter1', type: 'testkit.Counter', options: {} }], connections: [] })
        await mp.run()

        const res = await mp.Loader.checkDevice({ id: 'NewLamp', type: 'testkit.Lamp', options: {} })
        expect(res.valid).toBe(true)
        expect(res.error).toBeUndefined()
        expect(mp.Container.hasDevice('NewLamp')).toBe(false)
        expect(mp.Container.deviceList()).toEqual(['Counter1'])
    })

    it('invalid option -> valid:false with code & problems, no side effects', async () => {
        const mp = makeMP({ devices: [{ id: 'Counter1', type: 'testkit.Counter', options: {} }], connections: [] })
        await mp.run()

        const res = await mp.Loader.checkDevice({ id: 'BadLamp', type: 'testkit.Lamp', options: { maxBrightness: 999 } })
        expect(res.valid).toBe(false)
        expect(res.error!.code).toBe('VR_NOT_PASS')
        expect(Array.isArray(res.problems)).toBe(true)
        expect(res.problems!.length).toBeGreaterThan(0)
        expect(mp.Container.hasDevice('BadLamp')).toBe(false)
    })

    it('duplicate id -> valid:false CTR_DEVICE_DUPLICATE', async () => {
        const mp = makeMP({ devices: [{ id: 'Counter1', type: 'testkit.Counter', options: {} }], connections: [] })
        await mp.run()

        const res = await mp.Loader.checkDevice({ id: 'Counter1', type: 'testkit.Lamp', options: {} })
        expect(res.valid).toBe(false)
        expect(res.error!.code).toBe('CTR_DEVICE_DUPLICATE')
    })

describe('checkConnection()', () => {

    it('valid connection -> valid:true and NO DeviceConnect created', async () => {
        const mp = makeMP({
            devices: [
                { id: 'Counter1', type: 'testkit.Counter', options: {} },
                { id: 'Lamp1', type: 'testkit.Lamp', options: {} },
            ],
            connections: [],
        })
        await mp.run()

        expect((mp.Container.devices['Counter1'] as any).ports.output.result.connections.length).toBe(0)
        expect((mp.Container.devices['Lamp1'] as any).ports.input.on.connections.length).toBe(0)

        const res = mp.Loader.checkConnection('Counter1.result -> Lamp1.on')
        expect(res.valid).toBe(true)

        // Still no connection was created
        expect((mp.Container.devices['Counter1'] as any).ports.output.result.connections.length).toBe(0)
        expect((mp.Container.devices['Lamp1'] as any).ports.input.on.connections.length).toBe(0)
    })

    it('unknown device -> valid:false CTR_CONNECTION_DEVICE_NF, no connection', async () => {
        const mp = makeMP({
            devices: [
                { id: 'Counter1', type: 'testkit.Counter', options: {} },
                { id: 'Lamp1', type: 'testkit.Lamp', options: {} },
            ],
            connections: [],
        })
        await mp.run()

        const res = mp.Loader.checkConnection('Counter1.result -> Missing.on')
        expect(res.valid).toBe(false)
        expect(res.error!.code).toBe('CTR_CONNECTION_DEVICE_NF')
        expect((mp.Container.devices['Lamp1'] as any).ports.input.on.connections.length).toBe(0)
    })

    it('incompatible ports -> valid:false CTR_INCOMPATIBLE_PORTS', async () => {
        const mp = makeMP({
            devices: [
                { id: 'ReturnSrc1', type: 'testkit.ReturnSrc', options: {} },
                { id: 'Lamp1', type: 'testkit.Lamp', options: {} },
            ],
            connections: [],
        })
        await mp.run()

        const res = mp.Loader.checkConnection('ReturnSrc1.res -> Lamp1.on')
        expect(res.valid).toBe(false)
        expect(res.error!.code).toBe('CTR_INCOMPATIBLE_PORTS')
    })
})

/* ================================================================== */
/*  HOT ADD + START                                                    */
/* ================================================================== */

describe('addDevice() / startDevice()', () => {

    it('addDevice after runProcess registers (not started) a working device', async () => {
        const mp = makeMP({ devices: [{ id: 'Counter1', type: 'testkit.Counter', options: {} }], connections: [] })
        await mp.run()

        const dev: any = await mp.Loader.addDevice({ id: 'Lamp2', type: 'testkit.Lamp', options: { maxBrightness: 100 } })
        expect(dev.id).toBe('Lamp2')
        expect(mp.Container.hasDevice('Lamp2')).toBe(true)
        expect(mp.Container.getDevice('Lamp2')).toBe(dev)
        expect(mp.Container.deviceList().sort()).toEqual(['Counter1', 'Lamp2'])

        // Registered but NOT started yet
        expect(mp.Container.isStarted('Lamp2')).toBe(false)
        expect(dev.state).toBeUndefined()

        // Now start it
        await mp.Container.startDevice('Lamp2')
        expect(mp.Container.isStarted('Lamp2')).toBe(true)
        expect(dev.state).toEqual({ on: false, brightness: 0 })

        // Fully functional
        dev.ports.input.on.push(1)
        expect(dev.state).toEqual({ on: true, brightness: 100 })
    })

    it('addDevice rejects a duplicate id', async () => {
        const mp = makeMP({ devices: [{ id: 'Lamp1', type: 'testkit.Lamp', options: {} }], connections: [] })
        await mp.run()

        let err: any
        try {
            await mp.Loader.addDevice({ id: 'Lamp1', type: 'testkit.Lamp', options: {} })
        } catch (e) { err = e }
        expect(err).toBeDefined()
        expect(ErrorManager.isCode(err, 'CTR_DEVICE_DUPLICATE')).toBe(true)
    })

    it('startDevice is idempotent (process runs only once)', async () => {
        const mp = makeMP({ devices: [{ id: 'Tracker1', type: 'testkit.Tracker', options: {} }], connections: [] })
        await mp.run()

        const t: any = await mp.Loader.addDevice({ id: 'Tracker2', type: 'testkit.Tracker', options: {} })

        await mp.Container.startDevice('Tracker2')
        expect(t.processCount).toBe(1)
        expect(t.processPromiseCount).toBe(1)

        // Mutate state; a re-run of process() would reset the count
        t.count = 42
        await mp.Container.startDevice('Tracker2')

        expect(t.processCount).toBe(1)         // no re-run
        expect(t.processPromiseCount).toBe(1)  // no re-run
        expect(t.count).toBe(42)               // not reset -> no re-run
        expect(mp.Container.isStarted('Tracker2')).toBe(true)
    })

    it('startDevice on unknown device throws CTR_DEVICE_NF', async () => {
        const mp = makeMP({ devices: [{ id: 'Counter1', type: 'testkit.Counter', options: {} }], connections: [] })
        await mp.run()

        let err: any
        try { await mp.Container.startDevice('Nope') } catch (e) { err = e }
        expect(err).toBeDefined()
        expect(ErrorManager.isCode(err, 'CTR_DEVICE_NF')).toBe(true)
    })
})

/* ================================================================== */
/*  HOT CONNECTION                                                     */
/* ================================================================== */

describe('addConnection()', () => {

    it('connects initial + hot devices end-to-end', async () => {
        const mp = makeMP({
            devices: [{ id: 'Counter1', type: 'testkit.Counter', options: {} }],
            connections: [],
        })
        await mp.run()

        const lamp: any = await mp.Loader.addDevice({ id: 'Lamp2', type: 'testkit.Lamp', options: { maxBrightness: 200 } })
        await mp.Container.startDevice('Lamp2')

        mp.Loader.addConnection('Counter1.result -> Lamp2.on')
        expect((mp.Container.devices['Counter1'] as any).ports.output.result.connections.length).toBe(1)
        expect(lamp.ports.input.on.connections.length).toBe(1)

        // In-memory structure reflects the connection
        const struct = await mp.Container.getStructure()
        expect(struct['Counter1'].outputs['result']).toEqual([{ device: 'Lamp2', port: 'on' }])
        expect(struct['Lamp2'].inputs['on']).toEqual([{ device: 'Counter1', port: 'result' }])

        // Data flows through the connection
        ;(mp.Container.devices['Counter1'] as any).ports.input.data.push(5)
        expect(lamp.state.on).toBe(true)
        expect(lamp.state.brightness).toBe(200)
    })

    it('addConnection to a missing device throws CTR_CONNECTION_DEVICE_NF', async () => {
        const mp = makeMP({ devices: [{ id: 'Counter1', type: 'testkit.Counter', options: {} }], connections: [] })
        await mp.run()

        let err: any
        try { mp.Loader.addConnection('Counter1.result -> Ghost.on') } catch (e) { err = e }
        expect(err).toBeDefined()
        expect(ErrorManager.isCode(err, 'CTR_CONNECTION_DEVICE_NF')).toBe(true)
    })
})

/* ================================================================== */
/*  REMOVE DEVICE                                                      */
/* ================================================================== */

describe('removeDevice()', () => {

    it('removes device, connections, structure, registries & emits event', async () => {
        const mp = makeMP({
            devices: [
                { id: 'Counter1', type: 'testkit.Counter', options: {} },
                { id: 'Lamp1', type: 'testkit.Lamp', options: {} },
            ],
            connections: ['Counter1.result -> Lamp1.on'],
        })
        await mp.run()

        const lamp: any = mp.Container.devices['Lamp1']
        expect(lamp.ports.input.on.connections.length).toBe(1)

        const events: string[] = []
        mp.Container.on('device.remove', (id: string) => events.push(id))

        // Tracker to record beforeTerminate
        const tracker: any = await mp.Loader.addDevice({ id: 'Tracker1', type: 'testkit.Tracker', options: {} })
        await mp.Container.startDevice('Tracker1')
        expect(tracker.terminated).toBeUndefined()
        mp.Loader.removeDevice('Tracker1')
        expect(tracker.terminated).toBe(true)

        mp.Loader.removeDevice('Lamp1')

        expect(events).toEqual(['Tracker1', 'Lamp1'])
        expect(mp.Container.hasDevice('Lamp1')).toBe(false)

        // Connections cleaned on both sides
        expect((mp.Container.devices['Counter1'] as any).ports.output.result.connections.length).toBe(0)

        // Structure cleaned (device + references)
        const struct = await mp.Container.getStructure()
        expect(struct['Lamp1']).toBeUndefined()
        expect(struct['Counter1'].outputs['result']).toBeUndefined()

        // actions / metrics registries cleaned
        expect((mp.Container as any).deviceActions['Lamp1']).toBeUndefined()
        expect((mp.Container as any).deviceMetrics['Lamp1']).toBeUndefined()
    })

    it('removeDevice on unknown id throws CTR_DEVICE_NF', async () => {
        const mp = makeMP({ devices: [{ id: 'Counter1', type: 'testkit.Counter', options: {} }], connections: [] })
        await mp.run()
        let err: any
        try { mp.Loader.removeDevice('Nope') } catch (e) { err = e }
        expect(err).toBeDefined()
        expect(ErrorManager.isCode(err, 'CTR_DEVICE_NF')).toBe(true)
    })
})

/* ================================================================== */
/*  FULL HOT INTEGRATION FLOW                                          */
/* ================================================================== */

describe('hot integration flow', () => {

    it('add -> start -> connect -> push -> action -> metrics/storage -> remove', async () => {
        // 1. Start the service with a Counter
        const mp = makeMP({
            devices: [{ id: 'Counter1', type: 'testkit.Counter', options: { scale: 2 } }],
            connections: [],
        })
        await mp.run()
        await sleep(20) // flush initial structure persist
        expect(readStruct()['Counter1']).toBeDefined()

        // 2. Hot-add a Lamp
        const lamp: any = await mp.Loader.addDevice({ id: 'LampX', type: 'testkit.Lamp', options: { maxBrightness: 150 } })
        await sleep(20)
        // device.add persisted the structure -> LampX present on disk
        expect(readStruct()['LampX']).toBeDefined()

        // 3. Hot-add a Tracker (for actions)
        await mp.Loader.addDevice({ id: 'TrackerX', type: 'testkit.Tracker', options: {} })

        // 4. Start the hot devices
        await mp.Container.startDevice('LampX')
        await mp.Container.startDevice('TrackerX')
        expect(mp.Container.isStarted('LampX')).toBe(true)
        expect(mp.Container.isStarted('TrackerX')).toBe(true)

        // 5. Connect Counter -> Lamp
        mp.Loader.addConnection('Counter1.result -> LampX.on')

        // 6. Push through the port (end to end)
        ;(mp.Container.devices['Counter1'] as any).ports.input.data.push(1) // count = 1 * 2 = 2
        expect(lamp.state.on).toBe(true)
        expect(lamp.state.brightness).toBe(150)

        // 7. Call a device action on a hot device
        const pong = await mp.Container.deviceAction('TrackerX', 'ping', {})
        expect(pong).toBe('pong')

        // 8. Metric of the hot device is registered & written
        const dm = mp.Bootstrap.getBootClass('DeviceMetrics', DeviceMetrics)
        expect(dm.has('LampX', 'brightness')).toBe(true)
        const res = dm.read('LampX', 'brightness', 'now-1m:now', 100, 'last')
        expect(res.rows.some((r: any) => r.value === 150)).toBe(true)

        // 9. Storage persists on save
        const storageFile = path.join(tmp, 'storage', 'hot', 'Counter1.json')
        expect(fs.existsSync(storageFile)).toBe(true)
        expect(JSON.parse(fs.readFileSync(storageFile, 'utf-8')).count).toBe(2)

        // 10. In-memory structure has the hot device + connection
        const struct = await mp.Container.getStructure()
        expect(struct['LampX']).toBeDefined()
        expect(struct['Counter1'].outputs['result']).toEqual([{ device: 'LampX', port: 'on' }])

        // 11. Remove the hot device -> persisted structure updated
        mp.Loader.removeDevice('LampX')
        await sleep(20)
        const afterRemove = readStruct()
        expect(afterRemove['LampX']).toBeUndefined()
        expect(afterRemove['Counter1'].outputs['result']).toBeUndefined()
        expect(mp.Container.hasDevice('LampX')).toBe(false)
        expect(mp.Container.hasDevice('TrackerX')).toBe(true)
    })
})
})