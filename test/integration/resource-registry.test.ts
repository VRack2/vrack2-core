/**
 * Integration tests for the Container resource registry (publish / resolve).
 *
 * Verifies that devices can share live object references through the
 * container's resource registry without passing them through ports.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import path from 'path'
import os from 'os'
import fs from 'fs'

import {
    MainProcess,
    IServiceStructure,
} from 'vrack2-core'

const FIXTURES = path.resolve(__dirname, '../fixtures')

let tmp = ''
let lastMP: MainProcess | undefined

beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vrack2-res-'))
    lastMP = undefined
})
afterEach(async () => {
    if (lastMP) {
        try { await lastMP.stop() } catch { /* startup already failed */ }
        try { await lastMP.Bootstrap.destroyAll() } catch { /* startup already failed */ }
    }
    lastMP = undefined
    if (tmp && fs.existsSync(tmp)) fs.rmSync(tmp, { recursive: true, force: true })
})

function makeMP(service: IServiceStructure): MainProcess {
    const mp = new MainProcess({
        id: 'resit',
        service,
        bootstrap: {
            DeviceManager: { path: 'vrack2-core.DeviceManager', options: { systemDir: FIXTURES, dir: 'devices' } },
            DeviceStorage: { path: 'vrack2-core.DeviceFileStorage', options: { storageDir: path.join(tmp, 'storage') } },
            StructureStorage: { path: 'vrack2-core.StructureStorage', options: { structureDir: path.join(tmp, 'structure') } },
        },
    })
    lastMP = mp
    return mp
}

/* ================================================================== */
/*  RESOURCE REGISTRY: PUBLISH / RESOLVE                              */
/* ================================================================== */

describe('Container resource registry', () => {

    it('provider publishes, consumer resolves the same live reference', async () => {
        const service: IServiceStructure = {
            devices: [
                { id: 'Provider1', type: 'testkit.ResourceProvider', options: {} },
                { id: 'Consumer1', type: 'testkit.ResourceConsumer', options: {} },
            ],
            connections: [],
        }
        const mp = makeMP(service)
        await mp.run()

        // Consumer's onStartAsync resolved the resource → shares prove it
        const consumer = mp.Container.devices['Consumer1'] as any
        expect(consumer.shares.value).toBe(42)
        expect(consumer.shares.items).toEqual(['a', 'b'])

        // The resource is the same object (live reference)
        const provider = mp.Container.devices['Provider1'] as any
        const resolved = mp.Container.resolve('Provider.data')
        expect(resolved).toBe(provider.published)
    })

    it('mutation via provider action is visible through the resolved reference', async () => {
        const service: IServiceStructure = {
            devices: [
                { id: 'Provider1', type: 'testkit.ResourceProvider', options: {} },
                { id: 'Consumer1', type: 'testkit.ResourceConsumer', options: {} },
            ],
            connections: [],
        }
        const mp = makeMP(service)
        await mp.run()

        // Update via provider action
        await mp.Container.deviceAction('Provider1', 'update', { v: 99 })

        // Consumer reads through its resolved reference — sees the mutation
        const val = await mp.Container.deviceAction('Consumer1', 'read', {})
        expect(val).toBe(99)
    })

    it('publish with duplicate key throws CONT_RESOURCE_EXISTS', async () => {
        const service: IServiceStructure = {
            devices: [
                { id: 'Provider1', type: 'testkit.ResourceProvider', options: {} },
            ],
            connections: [],
        }
        const mp = makeMP(service)
        await mp.run()

        let caught: any
        try {
            mp.Container.publish('Provider.data', { duplicate: true })
        } catch (e) { caught = e }
        expect(caught?.vShort).toBe('CONT_RESOURCE_EXISTS')
    })

    it('resolve with unknown key throws CONT_RESOURCE_NOT_FOUND', async () => {
        const service: IServiceStructure = {
            devices: [
                { id: 'Provider1', type: 'testkit.ResourceProvider', options: {} },
            ],
            connections: [],
        }
        const mp = makeMP(service)
        await mp.run()

        let caught: any
        try {
            mp.Container.resolve('Nonexistent.thing')
        } catch (e) { caught = e }
        expect(caught?.vShort).toBe('CONT_RESOURCE_NOT_FOUND')
    })

    it('hasResource returns true/false correctly', async () => {
        const service: IServiceStructure = {
            devices: [
                { id: 'Provider1', type: 'testkit.ResourceProvider', options: {} },
            ],
            connections: [],
        }
        const mp = makeMP(service)
        await mp.run()

        expect(mp.Container.hasResource('Provider.data')).toBe(true)
        expect(mp.Container.hasResource('nope.nope')).toBe(false)
    })

    it('resourceList returns all published keys', async () => {
        const service: IServiceStructure = {
            devices: [
                { id: 'Provider1', type: 'testkit.ResourceProvider', options: {} },
            ],
            connections: [],
        }
        const mp = makeMP(service)
        await mp.run()

        mp.Container.publish('Extra.thing', 123)
        const keys = mp.Container.resourceList()
        expect(keys).toContain('Provider.data')
        expect(keys).toContain('Extra.thing')
    })
})

/* ================================================================== */
/*  DECLARED RESOURCE MAPS (publish / resolve in service.json)        */
/* ================================================================== */

describe('Declared resource maps', () => {

    it('several providers of one key; consumers bind the exact provider', async () => {
        const service: IServiceStructure = {
            devices: [
                { id: 'Provider1', type: 'testkit.ResourceProvider', options: {},
                  publish: { 'Provider.data': 'Provider1Data' } },
                { id: 'Provider2', type: 'testkit.ResourceProvider', options: {},
                  publish: { 'Provider.data': 'Provider2Data' } },
                { id: 'Consumer1', type: 'testkit.ResourceConsumer', options: {},
                  resolve: { 'Provider.data': 'Provider1Data' } },
                { id: 'Consumer2', type: 'testkit.ResourceConsumer', options: {},
                  resolve: { 'Provider.data': 'Provider2Data' } },
            ],
            connections: [],
        }
        const mp = makeMP(service)
        await mp.run()

        const p1 = mp.Container.devices['Provider1'] as any
        const p2 = mp.Container.devices['Provider2'] as any
        const c1 = mp.Container.devices['Consumer1'] as any
        const c2 = mp.Container.devices['Consumer2'] as any

        // Each consumer got the live reference of its bound provider
        expect(c1.resolved).toBe(p1.published)
        expect(c2.resolved).toBe(p2.published)
        expect(c1.resolved).not.toBe(c2.resolved)

        // Registry stores under aliases, not the interface key
        expect(mp.Container.hasResource('Provider1Data')).toBe(true)
        expect(mp.Container.hasResource('Provider2Data')).toBe(true)
        expect(mp.Container.hasResource('Provider.data')).toBe(false)
    })

    it('declared maps appear in the service structure', async () => {
        const service: IServiceStructure = {
            devices: [
                { id: 'Provider1', type: 'testkit.ResourceProvider', options: {},
                  publish: { 'Provider.data': 'Provider1Data' } },
                { id: 'Consumer1', type: 'testkit.ResourceConsumer', options: {},
                  resolve: { 'Provider.data': 'Provider1Data' } },
            ],
            connections: [],
        }
        const mp = makeMP(service)
        await mp.run()

        const st = await mp.Container.getStructure() as any
        expect(st['Provider1'].publish).toEqual({ 'Provider.data': 'Provider1Data' })
        expect(st['Consumer1'].resolve).toEqual({ 'Provider.data': 'Provider1Data' })
    })

    it('required name not published by another device → SLDR_RESOURCE_MISSING', async () => {
        const service: IServiceStructure = {
            devices: [
                { id: 'Provider1', type: 'testkit.ResourceProvider', options: {},
                  publish: { 'Provider.data': 'Provider1Data' } },
                { id: 'Consumer1', type: 'testkit.ResourceConsumer', options: {},
                  resolve: { 'Provider.data': 'NobodyData' } },
            ],
            connections: [],
        }
        const mp = makeMP(service)
        let caught: any
        try { await mp.run() } catch (e) { caught = e }
        expect(caught?.vShort).toBe('SLDR_RESOURCE_MISSING')
    })

    it('required name provided under another key → SLDR_RESOURCE_MISMATCH', async () => {
        const service: IServiceStructure = {
            devices: [
                { id: 'Provider1', type: 'testkit.ResourceProvider', options: {},
                  publish: { 'Provider.meta': 'Provider1Data' } },
                { id: 'Consumer1', type: 'testkit.ResourceConsumer', options: {},
                  resolve: { 'Provider.data': 'Provider1Data' } },
            ],
            connections: [],
        }
        const mp = makeMP(service)
        let caught: any
        try { await mp.run() } catch (e) { caught = e }
        expect(caught?.vShort).toBe('SLDR_RESOURCE_MISMATCH')
    })

    it('two devices publishing the same name → SLDR_RESOURCE_DUPLICATE', async () => {
        const service: IServiceStructure = {
            devices: [
                { id: 'Provider1', type: 'testkit.ResourceProvider', options: {},
                  publish: { 'Provider.data': 'SharedData' } },
                { id: 'Provider2', type: 'testkit.ResourceProvider', options: {},
                  publish: { 'Provider.meta': 'SharedData' } },
            ],
            connections: [],
        }
        const mp = makeMP(service)
        let caught: any
        try { await mp.run() } catch (e) { caught = e }
        expect(caught?.vShort).toBe('SLDR_RESOURCE_DUPLICATE')
    })

    it('malformed publish map → SLDR_BAD_RESOURCE_MAP', async () => {
        const service: IServiceStructure = {
            devices: [
                { id: 'Provider1', type: 'testkit.ResourceProvider', options: {},
                  publish: ['Provider.data'] as any },
            ],
            connections: [],
        }
        const mp = makeMP(service)
        let caught: any
        try { await mp.run() } catch (e) { caught = e }
        expect(caught?.vShort).toBe('SLDR_BAD_RESOURCE_MAP')
    })

    it('publishing an undeclared key throws CONT_RESOURCE_NOT_DECLARED', async () => {
        const service: IServiceStructure = {
            devices: [
                { id: 'Provider1', type: 'testkit.ResourceProvider', options: {},
                  publish: { 'Provider.data': 'Provider1Data' } },
            ],
            connections: [],
        }
        const mp = makeMP(service)
        await mp.run()

        let caught: any
        try {
            ;(mp.Container.devices['Provider1'] as any).publish('Other.thing', {})
        } catch (e) { caught = e }
        expect(caught?.vShort).toBe('CONT_RESOURCE_NOT_DECLARED')
    })

    it('resolving an undeclared key throws CONT_RESOURCE_NOT_REQUIRED', async () => {
        const service: IServiceStructure = {
            devices: [
                { id: 'Provider1', type: 'testkit.ResourceProvider', options: {},
                  publish: { 'Provider.data': 'Provider1Data' } },
                { id: 'Consumer1', type: 'testkit.ResourceConsumer', options: {},
                  resolve: { 'Provider.data': 'Provider1Data' } },
            ],
            connections: [],
        }
        const mp = makeMP(service)
        await mp.run()

        let caught: any
        try {
            ;(mp.Container.devices['Consumer1'] as any).resolve('Other.thing')
        } catch (e) { caught = e }
        expect(caught?.vShort).toBe('CONT_RESOURCE_NOT_REQUIRED')
    })
})
