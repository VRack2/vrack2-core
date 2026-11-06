/**
 * Integration tests: the `testkit.Counter` device end to end — input
 * accumulation with the `scale` option, actions (reset/set.value) with
 * requirement validation and the onBeforeAction veto, output-port wiring to a
 * connected device, the `count` metric (writes/reads/rollup/aggregates against
 * vrack-db via JournalDbMetrics, points-limit, malformed input), and storage
 * persistence across two processes.
 */
import { describe, it, expect } from 'vitest'
import path from 'path'
import fs from 'fs'
import { ErrorManager, JournalDbMetrics } from 'vrack2-core'
import { makeMP, hasCode, sleep, useTmpDir } from './service-helpers'

const tmpDir = useTmpDir()

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

    it('throws CONT_DEVICE_ACTION_NF for an unknown action', async () => {
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
        expect(ErrorManager.isCode(err, 'CONT_DEVICE_ACTION_NF')).toBe(true)
    })

    it('lets onBeforeAction() veto an action and emits device.action.before', async () => {
        const mp = makeMP({
            devices: [{ id: 'Counter1', type: 'testkit.Counter', options: {} }],
            connections: [],
        })
        await mp.run()

        const c: any = mp.Container.devices['Counter1']
        c.ports.input.data.push(5)
        expect(c.count).toBe(5)

        const events: any[] = []
        mp.Container.on('device.action.before', (e: any) => events.push(e))

        // Default hook returns true — the action proceeds.
        expect(await mp.Container.deviceAction('Counter1', 'set.value', { value: 10 })).toBe(10)
        expect(c.count).toBe(10)
        expect(events.length).toBe(1)
        expect(events[0]).toEqual({ device: 'Counter1', data: 'set.value', trace: { value: 10 } })

        // Veto — onBeforeAction returns false: the action is rejected before the handler.
        c.onBeforeAction = () => false
        let err: any
        try {
            await mp.Container.deviceAction('Counter1', 'set.value', { value: 99 })
        } catch (e) {
            err = e
        }
        expect(ErrorManager.isCode(err, 'CONT_DEVICE_ACTION_VETOED')).toBe(true)
        expect(c.count).toBe(10) // unchanged — the handler never ran
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

        const dm = mp.Bootstrap.getBootClass('DeviceMetrics', JournalDbMetrics)
        expect(dm.has('Counter1', 'count')).toBe(true)
        expect(dm.has('Counter1', 'missing')).toBe(false)

        const c: any = mp.Container.devices['Counter1']
        // grid-aligned 1-minute window: 5 buckets of 15s, the write falls into the 4th
        const now = Math.floor(Date.now() / 15_000) * 15_000
        const start = now - 45_000
        const end = now + 15_000
        c.ports.input.data.push(5)

        // dense series, { time, value } — the vrack-db SingleDB.read contract
        // time is returned in seconds (vrack-db unit), matching VrackDbMetrics
        const res = dm.read('Counter1', 'count', `${start}:${end}`, '15s')
        expect(res.relevant).toBe(true)
        expect(res.start).toBe(start / 1000)
        expect(res.end).toBe(end / 1000)
        expect(res.rows).toEqual([
            { time: start / 1000, value: null },
            { time: (start + 15_000) / 1000, value: null },
            { time: (start + 30_000) / 1000, value: null },
            { time: now / 1000, value: 5 },
            { time: end / 1000, value: null },
        ])
    })

    it('read(): missing metric -> relevant: false with an all-null dense grid; malformed period/precision/func -> RangeError', async () => {
        const mp = makeMP({
            devices: [{ id: 'Counter1', type: 'testkit.Counter', options: {} }],
            connections: [],
        })
        await mp.run()

        const dm = mp.Bootstrap.getBootClass('DeviceMetrics', JournalDbMetrics)

        const now = Math.floor(Date.now() / 15_000) * 15_000
        const empty = dm.read('Counter1', 'missing', `${now - 60_000}:${now}`, '15s')
        expect(empty.relevant).toBe(false)
        expect(empty.start).toBe((now - 60_000) / 1000)
        expect(empty.end).toBe(now / 1000)
        expect(empty.rows.length).toBe(5)
        expect(empty.rows.every((r: any) => r.value === null)).toBe(true)
        expect(empty.rows.map((r: any) => r.time)).toEqual([(now - 60_000) / 1000, (now - 45_000) / 1000, (now - 30_000) / 1000, (now - 15_000) / 1000, now / 1000])

        // a numeric string precision is a point count (WS/API callers send numbers as strings)
        const h = Math.floor(Date.now() / 6_000) * 6_000
        const pts = dm.read('Counter1', 'missing', `${h - 3_600_000}:${h}`, '600')
        expect(pts.relevant).toBe(false)
        expect(pts.rows.length).toBe(601) // ceil(3 600 000 / 600) = 6000 ms -> 600 buckets + 1
        expect(pts.rows.every((r: any) => r.value === null)).toBe(true)

        // vrack2-journal-db 3.x: malformed period -> coded error (vError/vShort), not RangeError
        for (const period of ['garbage', 'now-1m']) {
            let err: any
            try { dm.read('Counter1', 'count', period, '15s') } catch (e) { err = e }
            expect(hasCode(err, 'INT_PERIOD_FORMAT')).toBe(true)
        }
        expect(() => dm.read('Counter1', 'count', 'now-1m:now', '15s', 'bogus')).toThrow(RangeError)
    })

    it('read(): aged-out data stays honest for max/min/sum/last/first after rollup (multi-agg tier columns)', async () => {
        const mp = makeMP({
            devices: [{ id: 'Counter1', type: 'testkit.Counter', options: {} }],
            connections: [],
        })
        await mp.run()

        const dm = mp.Bootstrap.getBootClass('DeviceMetrics', JournalDbMetrics)
        const now = Math.floor(Date.now() / 60_000) * 60_000
        // aged rows: 30..11 minutes ago — beyond the raw 5s:10m tier; one spike of 99
        for (let i = 0; i < 20; i++) {
            dm.table.append({ ts: now - 30 * 60_000 + i * 60_000, dev: 'counter1', met: 'count', value: i === 10 ? 99 : 5 })
        }
        dm.table.flush()
        dm.table.rollup()

        const period = `${now - 31 * 60_000}:${now}`
        const maxRes = dm.read('Counter1', 'count', period, '15m', 'max')
        expect(maxRes.rows.some((r: any) => r.value === 99)).toBe(true)
        const minRes = dm.read('Counter1', 'count', period, '15m', 'min')
        expect(minRes.rows.some((r: any) => r.value === 5)).toBe(true)
        const sumRes = dm.read('Counter1', 'count', period, '15m', 'sum')
        expect(sumRes.rows.reduce((a: number, r: any) => a + (r.value ?? 0), 0)).toBe(19 * 5 + 99)
        const lastRes = dm.read('Counter1', 'count', period, '15m', 'last')
        const lastFilled = lastRes.rows.filter((r: any) => r.value !== null).pop()
        expect(lastFilled.value).toBe(5) // the value at the greatest ts, not the bucket average
        const firstRes = dm.read('Counter1', 'count', period, '15m', 'first')
        expect(firstRes.rows.find((r: any) => r.value !== null).value).toBe(5)

        // aggregate(): avg rebuilt from sum/count through the tier columns
        const agg = dm.aggregate('Counter1', 'count', period)
        expect(agg.value_avg).toBeCloseTo((19 * 5 + 99) / 20, 10)
    })


    it('persists storage to disk and reloads it in a second process', async () => {
        const tmp = tmpDir()
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

        // release the first process (closes the journal-db store and its locks)
        try { await mp1.stop() } catch { /* ignore */ }
        try { await mp1.Bootstrap.destroyAll() } catch { /* ignore */ }

        // second process: same storage dir, counter must start from 9
        const mp2 = makeMP(service)
        await mp2.run()
        expect((mp2.Container.devices['Counter1'] as any).count).toBe(9)
    })
})

