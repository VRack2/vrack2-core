/**
 * Integration tests: the `testkit.Lamp` device — input -> state (on/brightness)
 * with the `maxBrightness` option, option range validation, the `brightness`
 * metric read back from vrack-db, and the shared single-metrics-table behavior
 * (group members, undeclared names, malformed group patterns, points limit).
 */
import { describe, it, expect } from 'vitest'
import path from 'path'
import { ErrorManager, JournalDbMetrics } from 'vrack2-core'
import { makeMP, runOrError, hasCode, useTmpDir } from './service-helpers'

const tmpDir = useTmpDir()

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
        expect(ErrorManager.isCode(err, 'SLDR_ERROR_INIT_DEVICE')).toBe(true)
        expect(hasCode(err, 'VR_NOT_PASS')).toBe(true)
    })

    it('writes the brightness metric and reads it back from vrack-db', async () => {
        const mp = makeMP({
            devices: [{ id: 'Lamp1', type: 'testkit.Lamp', options: {} }],
            connections: [],
        })
        await mp.run()

        const dm = mp.Bootstrap.getBootClass('DeviceMetrics', JournalDbMetrics)
        const l: any = mp.Container.devices['Lamp1']

        const now = Math.floor(Date.now() / 15_000) * 15_000
        l.ports.input.on.push(1)
        expect(dm.has('Lamp1', 'brightness')).toBe(true)

        // grid-aligned window covering the write (ts >= now)
        const res = dm.read('Lamp1', 'brightness', `${now - 45_000}:${now + 15_000}`, '15s')
        expect(res.relevant).toBe(true)
        expect(res.rows.length).toBe(5)
        expect(res.rows.some((r: any) => r.value === 200)).toBe(true)
        expect(res.rows.filter((r: any) => r.value !== null).length).toBe(1)
    })

    it('single metrics table: group members and undeclared names are stored and read back', async () => {
        const mp = makeMP({
            devices: [{ id: 'Counter1', type: 'testkit.Counter', options: {} }],
            connections: [],
        })
        await mp.run()

        const dm = mp.Bootstrap.getBootClass('DeviceMetrics', JournalDbMetrics)
        const c: any = mp.Container.devices['Counter1']

        // known group members are declared (has() true) before any write
        expect(dm.has('Counter1', 'dyn.extra')).toBe(true)
        expect(dm.has('Counter1', 'dyn.other')).toBe(false)

        const now = Math.floor(Date.now() / 15_000) * 15_000
        await c.metric('dyn.extra', 7)
        await c.metric('dyn.other', 11) // undeclared: written silently, no description

        expect(dm.has('Counter1', 'dyn.other')).toBe(true)

        const res = dm.read('Counter1', 'dyn.other', `${now - 45_000}:${now + 15_000}`, '15s')
        expect(res.relevant).toBe(true)
        expect(res.rows.filter((r: any) => r.value !== null)).toEqual([{ time: expect.any(Number), value: 11 }])

        // reads of one metric never leak rows of the others from the shared table
        expect(dm.read('Counter1', 'count', `${now - 45_000}:${now + 15_000}`, '15s').rows.every((r: any) => r.value === null)).toBe(true)
        expect(dm.read('Counter1', 'dyn.extra', `${now - 45_000}:${now + 15_000}`, '15s').rows.filter((r: any) => r.value !== null)).toEqual([{ time: expect.any(Number), value: 7 }])

        const agg = dm.aggregate('Counter1', 'dyn.extra', `${now - 45_000}:${now + 15_000}`)
        expect(agg.value_avg).toBe(7)
    })

    it('malformed group patterns are rejected at registration (BDM_GROUP_PATTERN, fail-closed)', async () => {
        const mp = makeMP({
            devices: [{ id: 'Counter1', type: 'testkit.Counter', options: {} }],
            connections: [],
        })
        await mp.run()

        for (const key of ['a.*.b.*', '.*.*']) {
            let err: any
            try {
                mp.Container.emit('device.metric.register', { device: 'Counter1', data: key, trace: { kind: 'group' } })
            } catch (e) { err = e }
            expect(ErrorManager.isCode(err, 'BDM_GROUP_PATTERN')).toBe(true)
        }

        // member names must not contain `*`
        let err: any
        try {
            mp.Container.emit('device.metric.register', { device: 'Counter1', data: 'ok.*', trace: { kind: 'group', list: { 'x*': { kind: 'one' } } } })
        } catch (e) { err = e }
        expect(ErrorManager.isCode(err, 'BDM_GROUP_PATTERN')).toBe(true)

        // kind 'one' under a wildcard key is a malformed group declaration too
        err = undefined
        try {
            mp.Container.emit('device.metric.register', { device: 'Counter1', data: 'ok.*', trace: { kind: 'one' } })
        } catch (e) { err = e }
        expect(ErrorManager.isCode(err, 'BDM_GROUP_PATTERN')).toBe(true)
    })

    it('read()/percentile() over maxReadPoints throw JDM_POINTS_LIMIT instead of materializing the window', async () => {
        const tmp = tmpDir()
        const mp = makeMP(
            { devices: [{ id: 'Counter1', type: 'testkit.Counter', options: {} }], connections: [] },
            { DeviceMetrics: { path: 'vrack2-core.JournalDbMetrics', options: { path: path.join(tmp, 'journals'), maxReadPoints: 50 } } },
        )
        await mp.run()

        const dm = mp.Bootstrap.getBootClass('DeviceMetrics', JournalDbMetrics)

        let err: any
        try { dm.read('Counter1', 'count', 'now-1h:now', '1s') } catch (e) { err = e }
        expect(ErrorManager.isCode(err, 'JDM_POINTS_LIMIT')).toBe(true)
        expect(err.getUnknownProperty('points')).toBe(3601)

        // percentile caps the scanned rows (60 writes > limit 50)
        const c: any = mp.Container.devices['Counter1']
        for (let i = 0; i < 60; i++) c.ports.input.data.push(i)
        err = undefined
        try { dm.percentile('Counter1', 'count', 'now-1m:now', 0.5) } catch (e) { err = e }
        expect(ErrorManager.isCode(err, 'JDM_POINTS_LIMIT')).toBe(true)
    })
})

