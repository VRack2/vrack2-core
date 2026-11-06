/**
 * Integration tests: StructureStorage boot class — writes the container
 * structure to disk on load and reads it back; missing structure is a coded error.
 */
import { describe, it, expect } from 'vitest'
import path from 'path'
import fs from 'fs'
import { ErrorManager } from 'vrack2-core'
import { makeMP, sleep, useTmpDir } from './service-helpers'

const tmpDir = useTmpDir()

describe('StructureStorage', () => {

    it('writes the container structure to disk on load', async () => {
        const tmp = tmpDir()
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
