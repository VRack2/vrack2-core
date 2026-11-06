/**
 * Integration tests: Bootstrap / boot classes — loading custom boot classes,
 * option validation, `getBootClass()`, idempotent `run()`, and the
 * `Bootstrap.destroyAll()` teardown (onDestroy ordering / error handling).
 */
import { describe, it, expect } from 'vitest'
import {
    ErrorManager,
    Device,
    DeviceManager,
    JournalDbMetrics,
} from 'vrack2-core'
import * as testkit from 'testkit'
import { makeMP, runOrError, EMPTY_SERVICE, useTmpDir } from './service-helpers'

useTmpDir()

/* ================================================================== */
/*  BOOTSTRAP / BOOT CLASSES                                          */
/* ================================================================== */

describe('Bootstrap & boot classes', () => {

    it('loads a custom boot class, passes options, calls onStart & onStartAsync', async () => {
        const mp = makeMP(EMPTY_SERVICE, {
            GoodBoot: { path: 'testkit.GoodBoot', options: { hello: 'world' } },
        })
        await mp.run()

        expect(testkit.GoodBoot.calls).toEqual(['onStart', 'onStartAsync'])
        const bc = mp.Bootstrap.getBootClass('GoodBoot', (testkit as any).GoodBoot)
        expect(bc.options.hello).toBe('world')
    })

    it('rejects a boot class with a missing required option (VR_NOT_PASS)', async () => {
        const mp = makeMP(EMPTY_SERVICE, {
            OptionsBoot: { path: 'testkit.OptionsBoot', options: {} },
        })
        const err = await runOrError(mp)
        expect(err).toBeDefined()
        expect(ErrorManager.isCode(err, 'VR_NOT_PASS')).toBe(true)
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

    it('loads a boot class from a local file path (relative) — a Device as boot class', async () => {
        // The `path` field may be a **local file** (not just a package path),
        // and the resolved class may be a **Device** (not only a BootClass).
        const mp = makeMP(EMPTY_SERVICE, {
            MyLamp: { path: 'test/fixtures/devices/testkit/Lamp.js', options: {} },
        })
        await mp.run()

        const Lamp = (await import('../fixtures/devices/testkit/Lamp.js')).default
        const bc = mp.Bootstrap.getBootClass('MyLamp', Lamp)
        expect(bc).toBeInstanceOf(Device)
        expect(bc.type).toBe('Lamp')
        expect(bc.options.maxBrightness).toBe(200)   // Lamp's default option
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
            mp.Bootstrap.getBootClass('DeviceManager', JournalDbMetrics)
        } catch (e) {
            err = e
        }
        expect(err).toBeDefined()
        expect(ErrorManager.isCode(err, 'BTSP_INSTANCE_OF_INCORRECT')).toBe(true)
    })

    it('run() is idempotent: a second run does not re-instantiate boot classes / re-subscribe their handlers', async () => {
        const mp = makeMP(EMPTY_SERVICE)
        await mp.run()

        // DeviceMetrics subscribes to these in its onStart()
        const metricListeners = mp.Container.listenerCount('device.metric')
        const registerListeners = mp.Container.listenerCount('device.metric.register')
        expect(metricListeners).toBeGreaterThan(0)
        expect(registerListeners).toBeGreaterThan(0)

        await mp.run() // must be a no-op: no duplicate boot classes / listeners

        expect(mp.Container.listenerCount('device.metric')).toBe(metricListeners)
        expect(mp.Container.listenerCount('device.metric.register')).toBe(registerListeners)
    })
})


/* ================================================================== */
/*  BOOTSTRAP.DESTROYALL()                                            */
/* ================================================================== */

describe('Bootstrap.destroyAll()', () => {

    it('calls onDestroy() on every loaded boot class exactly once', async () => {
        const mp = makeMP(EMPTY_SERVICE, {
            TermA: { path: 'testkit.TermBoot', options: {} },
            TermB: { path: 'testkit.TermBoot', options: {} },
        })
        await mp.run()

        await mp.Bootstrap.destroyAll()

        // every loaded boot class (standard + custom) was destroyed,
        // in the REVERSE order of their load (TermB loaded last -> destroyed first)
        expect((testkit.TermBoot as any).destroyed).toEqual(['TermB', 'TermA'])
    })

    it('is idempotent: the second call does not re-run onDestroy()', async () => {
        const mp = makeMP(EMPTY_SERVICE, {
            TermA: { path: 'testkit.TermBoot', options: {} },
        })
        await mp.run()

        await mp.Bootstrap.destroyAll()
        await mp.Bootstrap.destroyAll() // must be a no-op

        expect((testkit.TermBoot as any).destroyed).toEqual(['TermA'])
    })

    it('one failing boot class does not block the others and is reported as system.error', async () => {
        const mp = makeMP(EMPTY_SERVICE, {
            BadTerm: { path: 'testkit.FailTermBoot', options: {} },
            GoodTerm: { path: 'testkit.TermBoot', options: {} },
        })
        await mp.run()

        const errors: any[] = []
        mp.Container.on('system.error', (e: any) => errors.push(e))

        // must not throw
        await mp.Bootstrap.destroyAll()

        // the healthy boot class was destroyed despite the failure
        expect((testkit.TermBoot as any).destroyed).toEqual(['GoodTerm'])
        // the failure surfaced as a coded system.error
        expect(errors.some((e) => ErrorManager.isCode(e, 'BTSP_TERMINATE_FAILED'))).toBe(true)
    })
})
