/**
 * Integration tests: layered boot-list configuration — how the boot list is
 * composed from three layers (service file -> conf file -> constructor argument),
 * including custom paths, options-only merges, removal (null), and precedence.
 */
import { describe, it, expect } from 'vitest'
import path from 'path'
import fs from 'fs'
import {
    MainProcess,
    IMainProcessOptions,
    IServiceStructure,
    StructureStorage,
} from 'vrack2-core'
import * as testkit from 'testkit'
import { FIXTURES, useTmpDir } from './service-helpers'

const tmpDir = useTmpDir()

describe('Layered boot-list config', () => {

    /**
     * Build a MainProcess whose **constructor** bootstrap layer contains only
     * DeviceManager (so the remaining core defaults — DeviceStorage /
     * StructureStorage — are visible to the service-file and conf-file layers
     * under test).
     */
    function makeMPBare(
        service: IServiceStructure,
        constructorBoot: IMainProcessOptions['bootstrap'] = {
            DeviceManager: { path: 'vrack2-core.DeviceManager', options: { systemDir: FIXTURES, dir: 'devices' } },
        },
        confFile?: string,
    ): MainProcess {
        return new MainProcess({ id: 'itest', service, confFile, bootstrap: constructorBoot })
    }

    it('service file bootstrap: custom path replaces a core default', async () => {
        const service: IServiceStructure = {
            devices: [], connections: [],
            bootstrap: {
                DeviceStorage: { path: 'testkit.GoodBoot', options: {} },
            },
        }
        const mp = makeMPBare(service)
        await mp.run()
        expect(mp.Bootstrap.getBootClass('DeviceStorage', (testkit as any).GoodBoot)).toBeDefined()
    })

    it('service file bootstrap: options-only override (no path) shallow-merges over the core default', async () => {
        const tmp = tmpDir()
        const service: IServiceStructure = {
            devices: [], connections: [],
            bootstrap: {
                StructureStorage: { options: { structureDir: path.join(tmp, 'custom-structure') } },
            },
        }
        const mp = makeMPBare(service)
        await mp.run()
        // path stays the core default
        expect(mp.options.bootstrap.StructureStorage!.path).toBe('vrack2-core.StructureStorage')
        // options are merged: structureDir overridden
        expect(mp.options.bootstrap.StructureStorage!.options.structureDir).toBe(path.join(tmp, 'custom-structure'))
    })

    it('service file bootstrap: null removes a core default', async () => {
        const service: IServiceStructure = {
            devices: [], connections: [],
            bootstrap: {
                StructureStorage: null,
            },
        }
        const mp = makeMPBare(service)
        await mp.run()
        expect(mp.options.bootstrap.StructureStorage).toBeUndefined()
        expect(() => mp.Bootstrap.getBootClass('StructureStorage', StructureStorage)).toThrow()
    })

    it('service file bootstrap: options-only override for an unknown id throws BTSP_BAD_BOOTLIST', () => {
        const service: IServiceStructure = {
            devices: [], connections: [],
            bootstrap: {
                Orphan: { options: { x: 1 } },
            },
        }
        expect(() => makeMPBare(service)).toThrow()
    })

    it('constructor argument wins over the service file', async () => {
        const service: IServiceStructure = {
            devices: [], connections: [],
            bootstrap: {
                DeviceStorage: { path: 'testkit.GoodBoot', options: {} },
            },
        }
        const mp = makeMPBare(service, {
            DeviceManager: { path: 'vrack2-core.DeviceManager', options: { systemDir: FIXTURES, dir: 'devices' } },
            DeviceStorage: { path: 'testkit.DefaultBoot', options: { port: 9999 } },
        })
        await mp.run()
        expect(mp.options.bootstrap.DeviceStorage!.path).toBe('testkit.DefaultBoot')
        expect(mp.Bootstrap.getBootClass('DeviceStorage', (testkit as any).DefaultBoot).options.port).toBe(9999)
    })

    it('conf file bootstrap overrides the service file', async () => {
        const tmp = tmpDir()
        const confPath = path.join(tmp, 'conf.json')
        fs.writeFileSync(confPath, JSON.stringify({
            bootstrap: {
                StructureStorage: { options: { structureDir: path.join(tmp, 'conf-structure') } },
            },
        }))
        const service: IServiceStructure = {
            devices: [], connections: [],
            bootstrap: {
                StructureStorage: { options: { structureDir: path.join(tmp, 'svc-structure') } },
            },
        }
        const mp = makeMPBare(service, undefined, confPath)
        await mp.run()
        expect(mp.options.bootstrap.StructureStorage!.options.structureDir).toBe(path.join(tmp, 'conf-structure'))
    })

    it('conf file bootstrap with a custom path overrides the service file path', async () => {
        const tmp = tmpDir()
        const confPath = path.join(tmp, 'conf.json')
        fs.writeFileSync(confPath, JSON.stringify({
            bootstrap: {
                DeviceStorage: { path: 'testkit.GoodBoot', options: { hello: 'conf' } },
            },
        }))
        const service: IServiceStructure = {
            devices: [], connections: [],
            bootstrap: {
                DeviceStorage: { path: 'testkit.DefaultBoot', options: {} },
            },
        }
        const mp = makeMPBare(service, undefined, confPath)
        await mp.run()
        expect(mp.Bootstrap.getBootClass('DeviceStorage', (testkit as any).GoodBoot).options.hello).toBe('conf')
    })
})
