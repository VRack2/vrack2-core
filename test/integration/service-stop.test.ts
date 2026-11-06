/**
 * Integration tests: MainProcess.stop() — stops all running devices
 * (onStop/onStopAsync, not onDestroy), is idempotent, tears boot classes down
 * in reverse order (best-effort), and propagates device stop failures while
 * still stopping the healthy devices.
 */
import { describe, it, expect } from 'vitest'
import { ErrorManager } from 'vrack2-core'
import * as testkit from 'testkit'
import { makeMP, hasCode, EMPTY_SERVICE, useTmpDir } from './service-helpers'

useTmpDir()

describe('MainProcess.stop()', () => {

    it('stops all running devices: onStop() + onStopAsync(), but no onDestroy()', async () => {
        const mp = makeMP({
            devices: [
                { id: 'T1', type: 'testkit.Tracker', options: {} },
                { id: 'T2', type: 'testkit.Tracker', options: {} },
            ],
            connections: [],
        })
        await mp.run()

        const t1: any = mp.Container.devices['T1']
        const t2: any = mp.Container.devices['T2']

        await mp.stop()

        // stop hooks ran exactly once, after start
        expect(t1.order).toEqual(['onRegister', 'onStart', 'onStartAsync', 'onStop', 'onStopAsync'])
        expect(t2.order).toEqual(['onRegister', 'onStart', 'onStartAsync', 'onStop', 'onStopAsync'])
        // termination is not a removal: onDestroy() must not be called
        expect(t1.destroyed).toBeUndefined()
        expect(t2.destroyed).toBeUndefined()
        // devices stay registered in the container, just not running
        expect(mp.Container.hasDevice('T1')).toBe(true)
        expect(mp.Container.hasDevice('T2')).toBe(true)
        expect(mp.Container.isStarted('T1')).toBe(false)
        expect(mp.Container.isStarted('T2')).toBe(false)
    })

    it('is idempotent: the second call does not re-run stop hooks', async () => {
        const mp = makeMP({
            devices: [{ id: 'T1', type: 'testkit.Tracker', options: {} }],
            connections: [],
        })
        await mp.run()

        await mp.stop()
        await mp.stop() // must be a no-op

        const t1: any = mp.Container.devices['T1']
        expect(t1.onStopCount).toBe(1)
        expect(t1.onStopAsyncCount).toBe(1)
        expect(t1.order.filter((o: string) => o === 'onStop')).toHaveLength(1)
    })

    it('destroys boot classes after stopping devices (reverse load order)', async () => {
        const mp = makeMP(EMPTY_SERVICE, {
            TermA: { path: 'testkit.TermBoot', options: {} },
            TermB: { path: 'testkit.TermBoot', options: {} },
        })
        await mp.run()

        await mp.stop()

        // devices stopped, THEN boot classes destroyed, in reverse load order
        expect((testkit.TermBoot as any).destroyed).toEqual(['TermB', 'TermA'])
        // stop() is the whole teardown: a manual destroyAll() is a no-op
        await mp.Bootstrap.destroyAll()
        expect((testkit.TermBoot as any).destroyed).toEqual(['TermB', 'TermA'])
    })

    it('destroys boot classes even when a device fails to stop (best-effort teardown)', async () => {
        const mp = makeMP({
            devices: [{ id: 'Bad', type: 'testkit.StopFail', options: {} }],
            connections: [],
        }, {
            TermB: { path: 'testkit.TermBoot', options: {} },
        })
        await mp.run()

        let err: any
        try {
            await mp.stop()
        } catch (e) {
            err = e
        }

        expect(ErrorManager.isCode(err, 'CONT_DEVICE_STOP_ALL_EXCEPTION')).toBe(true)
        // despite the device stop failure, the boot class was still destroyed
        expect((testkit.TermBoot as any).destroyed).toEqual(['TermB'])
    })

    it('propagates stop failures: CONT_DEVICE_STOP_ALL_EXCEPTION, other devices still stopped', async () => {
        const mp = makeMP({
            devices: [
                { id: 'Bad', type: 'testkit.StopFail', options: {} },
                { id: 'Good', type: 'testkit.Tracker', options: {} },
            ],
            connections: [],
        })
        await mp.run()

        let err: any
        try {
            await mp.stop()
        } catch (e) {
            err = e
        }

        expect(err).toBeDefined()
        expect(ErrorManager.isCode(err, 'CONT_DEVICE_STOP_ALL_EXCEPTION')).toBe(true)
        expect(hasCode(err, 'CONT_DEVICE_STOP_EXCEPTION')).toBe(true)
        // best-effort: the healthy device was stopped despite the failure
        const good: any = mp.Container.devices['Good']
        expect(good.onStopCount).toBe(1)
        expect(mp.Container.isStarted('Good')).toBe(false)
        // the failing device also stays registered (it was not removed)
        expect(mp.Container.hasDevice('Bad')).toBe(true)
    })
})
