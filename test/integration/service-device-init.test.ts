/**
 * Integration tests: Container device initialization — registration from the
 * vendor list, device structure (ports/metrics/actions), and the coded errors
 * for bad device definitions (duplicate id, bad id, bad options, unknown type,
 * missing input handler).
 */
import { describe, it, expect } from 'vitest'
import { ErrorManager, DeviceManager } from 'vrack2-core'
import { makeMP, runOrError, hasCode, useTmpDir } from './service-helpers'

useTmpDir()

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
        expect(dm.getVendorDeviceList('testkit').sort()).toEqual(['Counter', 'DbReader', 'Lamp', 'NoCaptureSrc', 'NoHandler', 'ResourceConsumer', 'ResourceProvider', 'ReturnSrc', 'StopFail', 'Talker', 'Tracker'])

        expect(mp.Container.devices).toHaveProperty('Counter1')
        expect(mp.Container.devices).toHaveProperty('Lamp1')

        const structure = await mp.Container.getStructure()
        expect(structure['Counter1'].inputs).toHaveProperty('data')
        expect(structure['Counter1'].outputs).toHaveProperty('result')
        expect(structure['Counter1'].metrics).toHaveProperty('count')
        expect(structure['Counter1'].metrics.count).toEqual({ kind: 'one', description: 'Current counter value' })
        expect(structure['Counter1'].metrics).toHaveProperty('dyn.*')
        expect(structure['Counter1'].metrics['dyn.*'].kind).toBe('group')
        expect(Object.keys(structure['Counter1'].metrics['dyn.*'].list)).toEqual(['extra'])
        expect(structure['Counter1'].actions).toHaveProperty('reset')
        expect(structure['Counter1'].actions).toHaveProperty('set.value')
    })

    it('rejects a duplicated device id (CONT_DEVICE_DUPLICATE)', async () => {
        const mp = makeMP({
            devices: [
                { id: 'Counter1', type: 'testkit.Counter', options: {} },
                { id: 'Counter1', type: 'testkit.Counter', options: {} },
            ],
            connections: [],
        })
        const err = await runOrError(mp)
        expect(err).toBeDefined()
        expect(ErrorManager.isCode(err, 'SLDR_ERROR_INIT_DEVICE')).toBe(true)
        expect(hasCode(err, 'CONT_DEVICE_DUPLICATE')).toBe(true)
    })

    it('rejects an incorrect device id (SLDR_INCORRECT_DEVICE_ID)', async () => {
        const mp = makeMP({
            devices: [{ id: 'bad id!', type: 'testkit.Counter', options: {} }],
            connections: [],
        })
        const err = await runOrError(mp)
        expect(err).toBeDefined()
        expect(ErrorManager.isCode(err, 'SLDR_ERROR_INIT_DEVICE')).toBe(true)
        expect(hasCode(err, 'SLDR_INCORRECT_DEVICE_ID')).toBe(true)
    })

    it('validates device options (VR_NOT_PASS inside SLDR_ERROR_INIT_DEVICE)', async () => {
        const mp = makeMP({
            devices: [{ id: 'Counter1', type: 'testkit.Counter', options: { scale: 'abc' } }],
            connections: [],
        })
        const err = await runOrError(mp)
        expect(err).toBeDefined()
        expect(ErrorManager.isCode(err, 'SLDR_ERROR_INIT_DEVICE')).toBe(true)
        expect(hasCode(err, 'VR_NOT_PASS')).toBe(true)
    })

    it('rejects an unknown device type (DM_DEVICE_NOT_FOUND)', async () => {
        const mp = makeMP({
            devices: [{ id: 'Ghost1', type: 'testkit.NoSuchDevice', options: {} }],
            connections: [],
        })
        const err = await runOrError(mp)
        expect(err).toBeDefined()
        expect(ErrorManager.isCode(err, 'SLDR_ERROR_INIT_DEVICE')).toBe(true)
        expect(hasCode(err, 'DM_DEVICE_NOT_FOUND')).toBe(true)
    })

    it('rejects a device without an input handler (CONT_INPUT_HANDLER_NF)', async () => {
        const mp = makeMP({
            devices: [{ id: 'NoHandler1', type: 'testkit.NoHandler', options: {} }],
            connections: [],
        })
        const err = await runOrError(mp)
        expect(err).toBeDefined()
        expect(ErrorManager.isCode(err, 'SLDR_ERROR_INIT_DEVICE')).toBe(true)
        expect(hasCode(err, 'CONT_INPUT_HANDLER_NF')).toBe(true)
    })
})
