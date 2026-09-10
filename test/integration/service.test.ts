/**
 * Phase 3 integration tests.
 *
 * Boots a real MainProcess (Bootstrap -> boot classes -> Container -> devices/ports)
 * using the `testkit` fixture vendor and verifies boot classes, device
 * registration, connections, Counter/Lamp behavior, metrics, storage.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import path from 'path'
import os from 'os'
import fs from 'fs'

import {
    MainProcess,
    ErrorManager,
    DeviceManager,
    DeviceMetrics,
    IMainProcessOptions,
    IServiceStructure,
} from 'vrack2-core'
import * as testkit from 'testkit'

const FIXTURES = path.resolve(__dirname, '../fixtures')

/** fresh tmp dir per test */
let tmp = ''
beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vrack2-int-'))
    ;(testkit.GoodBoot as any).calls = []
})
afterEach(() => {
    if (tmp && fs.existsSync(tmp)) fs.rmSync(tmp, { recursive: true, force: true })
})

const EMPTY_SERVICE: IServiceStructure = { devices: [], connections: [] }

/** Build a MainProcess with the standard boot class set */
function makeMP(service: IServiceStructure, extraBoot: IMainProcessOptions['bootstrap'] = {}): MainProcess {
    return new MainProcess({
        id: 'itest',
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

/** Run the process and return the thrown error (or undefined) */
async function runOrError(mp: MainProcess): Promise<any> {
    try {
        await mp.run()
        return undefined
    } catch (e) {
        return e
    }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Check that err (and its nested errors) contain the given vShort code */
function hasCode(err: any, code: string): boolean {
    if (!err) return false
    if (err.vShort === code) return true
    if (err.vCode === code) return true
    if (Array.isArray(err.vAddErrors)) return err.vAddErrors.some((e: any) => hasCode(e, code))
    return false
}
/* ================================================================== */
/*  BOOTSTRAP / BOOT CLASSES                                          */
/* ================================================================== */

describe('Bootstrap & boot classes', () => {

    it('loads a custom boot class, passes options, calls process & processPromise', async () => {
        const mp = makeMP(EMPTY_SERVICE, {
            GoodBoot: { path: 'testkit.GoodBoot', options: { hello: 'world' } },
        })
        await mp.run()

        expect(testkit.GoodBoot.calls).toEqual(['process', 'processPromise'])
        const bc = mp.Bootstrap.getBootClass('GoodBoot', (testkit as any).GoodBoot)
        expect(bc.options).toEqual({ hello: 'world' })
        expect(bc.id).toBe('GoodBoot')
        expect(bc.type).toBe('GoodBoot')
    })

    it('rejects a boot class with a missing required option (VR_NOT_PASS)', async () => {
        const mp = makeMP(EMPTY_SERVICE, {
            OptionsBoot: { path: 'testkit.OptionsBoot', options: {} },
        })
        const err = await runOrError(mp)
        expect(err).toBeDefined()
        expect(ErrorManager.isCode(err, 'VR_NOT_PASS')).toBe(true)
        const problem = err.problems.find((p: any) => p.fieldKey === 'token')
        expect(problem).toBeDefined()
        expect(problem.type).toBe('VR_ERROR_REQUIRED')
    })

    it('accepts a boot class when the required option is provided', async () => {
        const mp = makeMP(EMPTY_SERVICE, {
            OptionsBoot: { path: 'testkit.OptionsBoot', options: { token: 'secret' } },
        })
        const err = await runOrError(mp)
        expect(err).toBeUndefined()
        const bc = mp.Bootstrap.getBootClass('OptionsBoot', (testkit as any).OptionsBoot)
        expect(bc.options.token).toBe('secret')
    })

    it('fills default option values for a boot class', async () => {
        const mp = makeMP(EMPTY_SERVICE, {
            DefaultBoot: { path: 'testkit.DefaultBoot', options: {} },
        })
        await mp.run()
        const bc = mp.Bootstrap.getBootClass('DefaultBoot', (testkit as any).DefaultBoot)
        expect(bc.options.port).toBe(8080)
    })

    it('rejects a class that is not a BootClass (BTSP_INSTANCE_OF_INCORRECT)', async () => {
        const mp = makeMP(EMPTY_SERVICE, {
            FakeBoot: { path: 'testkit.NotABoot', options: {} },
        })
        const err = await runOrError(mp)
        expect(err).toBeDefined()
        expect(ErrorManager.isCode(err, 'BTSP_INSTANCE_OF_INCORRECT')).toBe(true)
    })

    it('getBootClass(): returns the instance, throws on bad id / wrong class', async () => {
        const mp = makeMP(EMPTY_SERVICE)
        await mp.run()

        const dm = mp.Bootstrap.getBootClass('DeviceManager', DeviceManager)
        expect(dm).toBeInstanceOf(DeviceManager)

        let err: any
        try {
            mp.Bootstrap.getBootClass('Nope', DeviceManager)
        } catch (e) {
            err = e
        }
        expect(err).toBeDefined()
        expect(ErrorManager.isCode(err, 'BTSP_CLASS_ID_NOT_FOUND')).toBe(true)

        err = undefined
        try {
            mp.Bootstrap.getBootClass('DeviceManager', DeviceMetrics)
        } catch (e) {
            err = e
        }
        expect(err).toBeDefined()
        expect(ErrorManager.isCode(err, 'BTSP_INSTANCE_OF_INCORRECT')).toBe(true)
    })
})
/* ================================================================== */
/*  CONTAINER: DEVICE INITIALIZATION                                  */
/* ================================================================== */

describe('Container: device initialization', () => {

    it('registers devices from the vendor list (testkit)', async () => {
        const mp = makeMP({
            devices: [
                { id: 'Counter1', type: 'testkit.Counter', options: {} },
                { id: 'Lamp1', type: 'testkit.Lamp', options: {} },
            ],
            connections: [],
        })
        await mp.run()

        const dm = mp.Bootstrap.getBootClass('DeviceManager', DeviceManager)
        expect(dm.getVendorList()).toContain('testkit')
        expect(dm.getVendorDeviceList('testkit').sort()).toEqual(['Counter', 'Lamp', 'NoHandler', 'ReturnSrc', 'Tracker'])

        expect(mp.Container.devices).toHaveProperty('Counter1')
        expect(mp.Container.devices).toHaveProperty('Lamp1')

        const structure = await mp.Container.getStructure()
        expect(structure['Counter1'].inputs).toHaveProperty('data')
        expect(structure['Counter1'].outputs).toHaveProperty('result')
        expect(structure['Counter1'].metrics).toHaveProperty('count')
        expect(structure['Counter1'].actions).toHaveProperty('reset')
        expect(structure['Counter1'].actions).toHaveProperty('set.value')
    })

    it('rejects a duplicated device id (CTR_DEVICE_DUPLICATE)', async () => {
        const mp = makeMP({
            devices: [
                { id: 'Counter1', type: 'testkit.Counter', options: {} },
                { id: 'Counter1', type: 'testkit.Counter', options: {} },
            ],
            connections: [],
        })
        const err = await runOrError(mp)
        expect(err).toBeDefined()
        expect(ErrorManager.isCode(err, 'CTR_ERROR_INIT_DEVICE')).toBe(true)
        expect(hasCode(err, 'CTR_DEVICE_DUPLICATE')).toBe(true)
    })

    it('rejects an incorrect device id (CTR_INCORRECT_DEVICE_ID)', async () => {
        const mp = makeMP({
            devices: [{ id: 'bad id!', type: 'testkit.Counter', options: {} }],
            connections: [],
        })
        const err = await runOrError(mp)
        expect(err).toBeDefined()
        expect(ErrorManager.isCode(err, 'CTR_ERROR_INIT_DEVICE')).toBe(true)
        expect(hasCode(err, 'CTR_INCORRECT_DEVICE_ID')).toBe(true)
    })

    it('validates device options (VR_NOT_PASS inside CTR_ERROR_INIT_DEVICE)', async () => {
        const mp = makeMP({
            devices: [{ id: 'Counter1', type: 'testkit.Counter', options: { scale: 'abc' } }],
            connections: [],
        })
        const err = await runOrError(mp)
        expect(err).toBeDefined()
        expect(ErrorManager.isCode(err, 'CTR_ERROR_INIT_DEVICE')).toBe(true)
        expect(hasCode(err, 'VR_NOT_PASS')).toBe(true)
    })

    it('rejects an unknown device type (DM_DEVICE_NOT_FOUND)', async () => {
        const mp = makeMP({
            devices: [{ id: 'Ghost1', type: 'testkit.NoSuchDevice', options: {} }],
            connections: [],
        })
        const err = await runOrError(mp)
        expect(err).toBeDefined()
        expect(ErrorManager.isCode(err, 'CTR_ERROR_INIT_DEVICE')).toBe(true)
        expect(hasCode(err, 'DM_DEVICE_NOT_FOUND')).toBe(true)
    })

    it('rejects a device without an input handler (CTR_INPUT_HANDLER_NF)', async () => {
        const mp = makeMP({
            devices: [{ id: 'NoHandler1', type: 'testkit.NoHandler', options: {} }],
            connections: [],
        })
        const err = await runOrError(mp)
        expect(err).toBeDefined()
        expect(ErrorManager.isCode(err, 'CTR_ERROR_INIT_DEVICE')).toBe(true)
        expect(hasCode(err, 'CTR_INPUT_HANDLER_NF')).toBe(true)
    })
})

/* ================================================================== */
/*  CONTAINER: CONNECTIONS                                            */
/* ================================================================== */

describe('Container: connections', () => {

    it('passes data through a valid standard -> standard connection', async () => {
        const mp = makeMP({
            devices: [
                { id: 'Counter1', type: 'testkit.Counter', options: {} },
                { id: 'Lamp1', type: 'testkit.Lamp', options: {} },
            ],
            connections: ['Counter1.result -> Lamp1.on'],
        })
        await mp.run()

        const c: any = mp.Container.devices['Counter1']
        const l: any = mp.Container.devices['Lamp1']

        c.ports.input.data.push(7)
        expect(c.count).toBe(7)
        expect(l.state).toEqual({ on: true, brightness: 200 })

        const structure = await mp.Container.getStructure()
        expect(structure['Counter1'].outputs['result']).toEqual([{ device: 'Lamp1', port: 'on' }])
        expect(structure['Lamp1'].inputs['on']).toEqual([{ device: 'Counter1', port: 'result' }])
    })

    it('rejects incompatible port types (CTR_INCOMPATIBLE_PORTS)', async () => {
        const mp = makeMP({
            devices: [
                { id: 'ReturnSrc1', type: 'testkit.ReturnSrc', options: {} },
                { id: 'Lamp1', type: 'testkit.Lamp', options: {} },
            ],
            connections: ['ReturnSrc1.res -> Lamp1.on'],
        })
        const err = await runOrError(mp)
        expect(err).toBeDefined()
        expect(ErrorManager.isCode(err, 'CTR_ERROR_INIT_CONNECTION')).toBe(true)
        expect(hasCode(err, 'CTR_INCOMPATIBLE_PORTS')).toBe(true)
    })

    it('rejects a connection to an unknown device (CTR_CONNECTION_DEVICE_NF)', async () => {
        const mp = makeMP({
            devices: [{ id: 'Counter1', type: 'testkit.Counter', options: {} }],
            connections: ['Counter1.result -> Ghost.data'],
        })
        const err = await runOrError(mp)
        expect(err).toBeDefined()
        expect(ErrorManager.isCode(err, 'CTR_ERROR_INIT_CONNECTION')).toBe(true)
        expect(hasCode(err, 'CTR_CONNECTION_DEVICE_NF')).toBe(true)
    })

    it('rejects a connection to an unknown port (CTR_CONNECTION_PORT_NF)', async () => {
        const mp = makeMP({
            devices: [
                { id: 'Counter1', type: 'testkit.Counter', options: {} },
                { id: 'Lamp1', type: 'testkit.Lamp', options: {} },
            ],
            connections: ['Counter1.result -> Lamp1.ghost'],
        })
        const err = await runOrError(mp)
        expect(err).toBeDefined()
        expect(ErrorManager.isCode(err, 'CTR_ERROR_INIT_CONNECTION')).toBe(true)
        expect(hasCode(err, 'CTR_CONNECTION_PORT_NF')).toBe(true)
    })

    it('rejects a malformed connection string (CTR_CONNECTION_INCORRECT)', async () => {
        const mp = makeMP({
            devices: [
                { id: 'Counter1', type: 'testkit.Counter', options: {} },
                { id: 'Lamp1', type: 'testkit.Lamp', options: {} },
            ],
            connections: ['Counter1.result Lamp1.on'],
        })
        const err = await runOrError(mp)
        expect(err).toBeDefined()
        expect(ErrorManager.isCode(err, 'CTR_ERROR_INIT_CONNECTION')).toBe(true)
        expect(hasCode(err, 'CTR_CONNECTION_INCORRECT')).toBe(true)
    })
})

/* ================================================================== */
/*  COUNTER: INPUT / ACTION / OUTPUT / METRIC / STORAGE               */
/* ================================================================== */

describe('Counter: input, actions, output, metric, storage', () => {

    it('accumulates ticks on the data input and applies the scale option', async () => {
        const mp = makeMP({
            devices: [{ id: 'Counter1', type: 'testkit.Counter', options: { scale: 3 } }],
            connections: [],
        })
        await mp.run()

        const c: any = mp.Container.devices['Counter1']
        c.ports.input.data.push(2)   // 2 * 3
        expect(c.count).toBe(6)
        c.ports.input.data.push(1)   // + 1 * 3
        expect(c.count).toBe(9)
        c.ports.input.data.push('x') // non-number => +1 * 3
        expect(c.count).toBe(12)
        expect(c.shares.count).toBe(12)
    })

    it('resets to zero and sets the value via actions', async () => {
        const mp = makeMP({
            devices: [{ id: 'Counter1', type: 'testkit.Counter', options: {} }],
            connections: [],
        })
        await mp.run()

        const c: any = mp.Container.devices['Counter1']
        c.ports.input.data.push(5)
        expect(c.count).toBe(5)

        const resetResult = await mp.Container.deviceAction('Counter1', 'reset', {})
        expect(resetResult).toBe(0)
        expect(c.count).toBe(0)

        const setResult = await mp.Container.deviceAction('Counter1', 'set.value', { value: 42 })
        expect(setResult).toBe(42)
        expect(c.count).toBe(42)
        expect(c.shares.count).toBe(42)
    })

    it('validates action requirements (VR_NOT_PASS for set.value without value)', async () => {
        const mp = makeMP({
            devices: [{ id: 'Counter1', type: 'testkit.Counter', options: {} }],
            connections: [],
        })
        await mp.run()

        let err: any
        try {
            await mp.Container.deviceAction('Counter1', 'set.value', {})
        } catch (e) {
            err = e
        }
        expect(err).toBeDefined()
        expect(ErrorManager.isCode(err, 'VR_NOT_PASS')).toBe(true)
        expect(err.problems.find((p: any) => p.fieldKey === 'value')).toBeDefined()
    })

    it('throws CTR_DEVICE_ACTION_NF for an unknown action', async () => {
        const mp = makeMP({
            devices: [{ id: 'Counter1', type: 'testkit.Counter', options: {} }],
            connections: [],
        })
        await mp.run()

        let err: any
        try {
            await mp.Container.deviceAction('Counter1', 'nope', {})
        } catch (e) {
            err = e
        }
        expect(err).toBeDefined()
        expect(ErrorManager.isCode(err, 'CTR_DEVICE_ACTION_NF')).toBe(true)
    })

    it('drives the connected device through its output port', async () => {
        const mp = makeMP({
            devices: [
                { id: 'Counter1', type: 'testkit.Counter', options: {} },
                { id: 'Lamp1', type: 'testkit.Lamp', options: {} },
            ],
            connections: ['Counter1.result -> Lamp1.on'],
        })
        await mp.run()

        const c: any = mp.Container.devices['Counter1']
        const l: any = mp.Container.devices['Lamp1']

        c.ports.input.data.push(3)
        expect(l.state.on).toBe(true)

        await mp.Container.deviceAction('Counter1', 'reset', {})
        expect(l.state.on).toBe(false)
    })

    it('writes the count metric and reads it back from vrack-db', async () => {
        const mp = makeMP({
            devices: [{ id: 'Counter1', type: 'testkit.Counter', options: {} }],
            connections: [],
        })
        await mp.run()

        const dm = mp.Bootstrap.getBootClass('DeviceMetrics', DeviceMetrics)
        expect(dm.has('Counter1', 'count')).toBe(true)
        expect(dm.has('Counter1', 'missing')).toBe(false)

        const c: any = mp.Container.devices['Counter1']
        c.ports.input.data.push(5)

        const res = dm.read('Counter1', 'count', 'now-1m:now', 100, 'last')
        expect(res.relevant).toBe(true)
        expect(res.rows.length).toBeGreaterThanOrEqual(1)
        expect(res.rows.some((r: any) => r.value === 5)).toBe(true)
    })

    it('persists storage to disk and reloads it in a second process', async () => {
        const service = {
            devices: [{ id: 'Counter1', type: 'testkit.Counter', options: {} }],
            connections: [] as string[],
        }

        // first process: write 9 into the counter and save
        const mp1 = makeMP(service)
        await mp1.run()
        ;(mp1.Container.devices['Counter1'] as any).ports.input.data.push(9)
        await sleep(20) // allow the async device.save handler to flush

        const fp = path.join(tmp, 'storage', 'itest', 'Counter1.json')
        expect(fs.existsSync(fp)).toBe(true)
        expect(JSON.parse(fs.readFileSync(fp, 'utf-8'))).toEqual({ count: 9 })

        // second process: same storage dir, counter must start from 9
        const mp2 = makeMP(service)
        await mp2.run()
        expect((mp2.Container.devices['Counter1'] as any).count).toBe(9)
    })
})

/* ================================================================== */
/*  LAMP: INPUT / OUTPUT / METRIC                                     */
/* ================================================================== */

describe('Lamp: input, output, metric', () => {

    it('turns on with data > 0, off with 0, and honors maxBrightness option', async () => {
        const mp = makeMP({
            devices: [{ id: 'Lamp1', type: 'testkit.Lamp', options: { maxBrightness: 128 } }],
            connections: [],
        })
        await mp.run()

        const l: any = mp.Container.devices['Lamp1']

        l.ports.input.on.push(1)
        expect(l.state).toEqual({ on: true, brightness: 128 })
        expect(l.shares).toEqual({ on: true, brightness: 128 })

        l.ports.input.on.push(0)
        expect(l.state).toEqual({ on: false, brightness: 0 })

        l.ports.input.on.push(true)
        expect(l.state.on).toBe(true)

        l.ports.input.on.push(false)
        expect(l.state.on).toBe(false)
    })

    it('validates the maxBrightness option range (1..255)', async () => {
        const mp = makeMP({
            devices: [{ id: 'Lamp1', type: 'testkit.Lamp', options: { maxBrightness: 999 } }],
            connections: [],
        })
        const err = await runOrError(mp)
        expect(err).toBeDefined()
        expect(ErrorManager.isCode(err, 'CTR_ERROR_INIT_DEVICE')).toBe(true)
        expect(hasCode(err, 'VR_NOT_PASS')).toBe(true)
    })

    it('writes the brightness metric and reads it back from vrack-db', async () => {
        const mp = makeMP({
            devices: [{ id: 'Lamp1', type: 'testkit.Lamp', options: {} }],
            connections: [],
        })
        await mp.run()

        const dm = mp.Bootstrap.getBootClass('DeviceMetrics', DeviceMetrics)
        const l: any = mp.Container.devices['Lamp1']

        l.ports.input.on.push(1)
        expect(dm.has('Lamp1', 'brightness')).toBe(true)

        const res = dm.read('Lamp1', 'brightness', 'now-1m:now', 100, 'last')
        expect(res.relevant).toBe(true)
        expect(res.rows.some((r: any) => r.value === 200)).toBe(true)
    })
})

/* ================================================================== */
/*  STRUCTURE STORAGE                                                 */
/* ================================================================== */

describe('StructureStorage', () => {

    it('writes the container structure to disk on load', async () => {
        const mp = makeMP({
            devices: [
                { id: 'Counter1', type: 'testkit.Counter', options: {} },
                { id: 'Lamp1', type: 'testkit.Lamp', options: {} },
            ],
            connections: ['Counter1.result -> Lamp1.on'],
        })
        await mp.run()
        await sleep(20) // allow the async beforeLoaded handler to flush

        const fp = path.join(tmp, 'structure', 'itest.json')
        expect(fs.existsSync(fp)).toBe(true)

        const structure = JSON.parse(fs.readFileSync(fp, 'utf-8'))
        expect(Object.keys(structure).sort()).toEqual(['Counter1', 'Lamp1'])
        expect(structure['Counter1'].type).toBe('testkit.Counter')
        expect(structure['Counter1'].outputs['result']).toEqual([{ device: 'Lamp1', port: 'on' }])
        expect(structure['Lamp1'].inputs['on']).toEqual([{ device: 'Counter1', port: 'result' }])

        const ss = mp.Bootstrap.getBootClass('StructureStorage', (await import('vrack2-core')).StructureStorage)
        const loaded = await ss.getById('itest')
        expect(loaded['Counter1']).toBeDefined()

        let err: any
        try {
            await ss.getById('missing-id')
        } catch (e) {
            err = e
        }
        expect(err).toBeDefined()
        expect(ErrorManager.isCode(err, 'SS_STRUCT_NOT_FOUND')).toBe(true)
    })
})

