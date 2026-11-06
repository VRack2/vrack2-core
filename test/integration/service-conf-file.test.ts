/**
 * Integration tests: the conf file as a service-structure extender — it can
 * add devices that are absent from the service file (full devices, wired like
 * any other) and override options of devices that already exist.
 */
import { describe, it, expect } from 'vitest'
import path from 'path'
import fs from 'fs'
import { ErrorManager } from 'vrack2-core'
import { makeMP, runOrError, hasCode, useTmpDir } from './service-helpers'

const tmpDir = useTmpDir()

describe('Conf file extends service structure (add devices)', () => {

    it('adds a device declared only in the conf file and wires its connection', async () => {
        const tmp = tmpDir()
        const confPath = path.join(tmp, 'conf.json')
        fs.writeFileSync(confPath, JSON.stringify({
            devices: [
                {
                    id: 'Lamp1',
                    type: 'testkit.Lamp',
                    options: { maxBrightness: 64 },
                    connections: ['Counter1.result -> Lamp1.on'],
                },
            ],
        }))
        const mp = makeMP(
            { devices: [{ id: 'Counter1', type: 'testkit.Counter', options: {} }], connections: [] },
            {},
            confPath,
        )
        await mp.run()

        // The conf-only device is a real, registered device with its options applied
        expect(mp.Container.hasDevice('Lamp1')).toBe(true)
        const lamp: any = mp.Container.devices['Lamp1']
        expect(lamp.type).toBe('testkit.Lamp')
        expect(lamp.options.maxBrightness).toBe(64)

        // Its connection to a service-file device is wired and data flows end to end
        expect((mp.Container.devices['Counter1'] as any).ports.output.result.connections.length).toBe(1)
        ;(mp.Container.devices['Counter1'] as any).ports.input.data.push(3)
        expect(lamp.state.on).toBe(true)
        expect(lamp.state.brightness).toBe(64)
    })

    it('still overrides options (without duplicating) when the id already exists', async () => {
        const tmp = tmpDir()
        const confPath = path.join(tmp, 'conf.json')
        fs.writeFileSync(confPath, JSON.stringify({
            devices: [{ id: 'Lamp1', options: { maxBrightness: 100 } }],
        }))
        const mp = makeMP(
            {
                devices: [
                    { id: 'Counter1', type: 'testkit.Counter', options: {} },
                    { id: 'Lamp1', type: 'testkit.Lamp', options: { maxBrightness: 200 } },
                ],
                connections: [],
            },
            {},
            confPath,
        )
        await mp.run()

        const lamp: any = mp.Container.devices['Lamp1']
        expect(lamp.options.maxBrightness).toBe(100) // merged override, not a new device
        expect(Object.keys(mp.Container.devices).sort()).toEqual(['Counter1', 'Lamp1'])
    })

    it('rejects a new conf-file device without a type (SLDR_CONF_DEVICE_INVALID)', async () => {
        const tmp = tmpDir()
        const confPath = path.join(tmp, 'conf.json')
        fs.writeFileSync(confPath, JSON.stringify({
            devices: [{ id: 'Ghost', options: { maxBrightness: 50 } }],
        }))
        const mp = makeMP(
            { devices: [{ id: 'Counter1', type: 'testkit.Counter', options: {} }], connections: [] },
            {},
            confPath,
        )
        const err = await runOrError(mp)
        expect(err).toBeDefined()
        expect(ErrorManager.isCode(err, 'SLDR_CONF_EXTENDS_PROBLEM')).toBe(true)
        expect(hasCode(err, 'SLDR_CONF_DEVICE_INVALID')).toBe(true)
    })
})
