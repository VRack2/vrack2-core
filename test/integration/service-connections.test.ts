/**
 * Integration tests: Container port connections — a valid standard -> standard
 * connection (with structure reflection), and the coded errors for bad
 * connections (incompatible types, unknown device, unknown port, malformed string).
 */
import { describe, it, expect } from 'vitest'
import { ErrorManager } from 'vrack2-core'
import { makeMP, runOrError, hasCode, useTmpDir } from './service-helpers'

useTmpDir()

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

    it('rejects incompatible port types (CONT_INCOMPATIBLE_PORTS)', async () => {
        const mp = makeMP({
            devices: [
                { id: 'ReturnSrc1', type: 'testkit.ReturnSrc', options: {} },
                { id: 'Lamp1', type: 'testkit.Lamp', options: {} },
            ],
            connections: ['ReturnSrc1.res -> Lamp1.on'],
        })
        const err = await runOrError(mp)
        expect(err).toBeDefined()
        expect(ErrorManager.isCode(err, 'SLDR_ERROR_INIT_CONNECTION')).toBe(true)
        expect(hasCode(err, 'CONT_INCOMPATIBLE_PORTS')).toBe(true)
    })

    it('rejects a connection to an unknown device (CONT_CONNECTION_DEVICE_NF)', async () => {
        const mp = makeMP({
            devices: [{ id: 'Counter1', type: 'testkit.Counter', options: {} }],
            connections: ['Counter1.result -> Ghost.data'],
        })
        const err = await runOrError(mp)
        expect(err).toBeDefined()
        expect(ErrorManager.isCode(err, 'SLDR_ERROR_INIT_CONNECTION')).toBe(true)
        expect(hasCode(err, 'CONT_CONNECTION_DEVICE_NF')).toBe(true)
    })

    it('rejects a connection to an unknown port (CONT_CONNECTION_PORT_NF)', async () => {
        const mp = makeMP({
            devices: [
                { id: 'Counter1', type: 'testkit.Counter', options: {} },
                { id: 'Lamp1', type: 'testkit.Lamp', options: {} },
            ],
            connections: ['Counter1.result -> Lamp1.ghost'],
        })
        const err = await runOrError(mp)
        expect(err).toBeDefined()
        expect(ErrorManager.isCode(err, 'SLDR_ERROR_INIT_CONNECTION')).toBe(true)
        expect(hasCode(err, 'CONT_CONNECTION_PORT_NF')).toBe(true)
    })

    it('rejects a malformed connection string (CONT_CONNECTION_INCORRECT)', async () => {
        const mp = makeMP({
            devices: [
                { id: 'Counter1', type: 'testkit.Counter', options: {} },
                { id: 'Lamp1', type: 'testkit.Lamp', options: {} },
            ],
            connections: ['Counter1.result Lamp1.on'],
        })
        const err = await runOrError(mp)
        expect(err).toBeDefined()
        expect(ErrorManager.isCode(err, 'SLDR_ERROR_INIT_CONNECTION')).toBe(true)
        expect(hasCode(err, 'CONT_CONNECTION_INCORRECT')).toBe(true)
    })
})
