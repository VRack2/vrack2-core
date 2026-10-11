/**
 * ServiceLogger integration tests.
 *
 * Boots a real MainProcess (default boot list → ServiceLogger is enabled by
 * default), drives channel events through the testkit Talker device and
 * verifies the events (all channels except `device.render`) are captured in
 * the journal-db table and readable back — via query() / tail() / count(),
 * and externally through the exposed Store (a fresh instance over the same dir).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import path from 'path'
import os from 'os'
import fs from 'fs'

import { MainProcess, ServiceLogger, ErrorManager, IServiceStructure } from 'vrack2-core'
import { Store } from 'vrack2-journal-db'

/**
 * Fresh tmp dir per test; it is also the process cwd, so the default
 * relative boot-class paths (./storage, ./journals, ./structure, ./logs)
 * land inside the tmp dir and the repo is not polluted.
 */
let tmp = ''
let oldCwd = ''
beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vrack2-logger-'))
    oldCwd = process.cwd()
    process.chdir(tmp)
})
afterEach(() => {
    try { process.chdir(oldCwd) } catch { /* ignore */ }
    if (tmp && fs.existsSync(tmp)) fs.rmSync(tmp, { recursive: true, force: true })
})

const TALKER_SERVICE: IServiceStructure = {
    devices: [{ id: 'Talker1', type: 'testkit.Talker', options: {} }],
    connections: [],
}

/**
 * Boots a MainProcess whose constructor layer pins only DeviceManager —
 * every other boot class (incl. ServiceLogger) comes from the core
 * default boot list.
 */
function makeMP(service: IServiceStructure, serviceBootstrap?: IServiceStructure['bootstrap']): MainProcess {
    return new MainProcess({
        id: 'logger',
        service: { ...service, bootstrap: serviceBootstrap },
        bootstrap: {
            DeviceManager: { path: 'vrack2-core.DeviceManager', options: { systemDir: path.resolve(__dirname, '../fixtures'), dir: 'devices' } },
        },
    })
}

describe('ServiceLogger: default boot list', () => {
    it('is enabled by default (id ServiceLogger) and exposes its DB', async () => {
        const mp = makeMP(TALKER_SERVICE)
        await mp.run()
        try {
            const logger = mp.Bootstrap.getBootClass('ServiceLogger', ServiceLogger)
            expect(logger.DB).toBeInstanceOf(Store)
            expect(logger.table).toBeDefined()
            expect(logger.DB.openTables.has('device_log')).toBe(true)
        } finally {
            await mp.stop()
        }
    })

    it('can be disabled via ServiceLogger: null in the service bootstrap', async () => {
        const mp = makeMP(TALKER_SERVICE, { ServiceLogger: null })
        await mp.run()
        try {
            expect(() => mp.Bootstrap.getBootClass('ServiceLogger', ServiceLogger)).toThrow()
        } finally {
            await mp.stop()
        }
    })
})

describe('ServiceLogger: event capture', () => {
    it('captures every device channel event except device.render', async () => {
        const mp = makeMP({
            devices: [
                { id: 'Talker1', type: 'testkit.Talker', options: {} },
                { id: 'Counter1', type: 'testkit.Counter', options: {} },
            ],
            connections: [],
        })
        await mp.run()
        try {
            const t: any = mp.Container.devices['Talker1']
            const c: any = mp.Container.devices['Counter1']

            // fire one message on each channel
            t.ports.input.data.push('terminal')
            t.ports.input.data.push('notify')
            t.ports.input.data.push('event')
            t.ports.input.data.push('alert')
            t.ports.input.data.push('error')

            // device.render + device.save + device.metric — must NOT be captured
            c.ports.input.data.push(5)

            const logger = mp.Bootstrap.getBootClass('ServiceLogger', ServiceLogger)
            const events = logger.tail(100).map((r: any) => r.event)

            expect(events.sort()).toEqual(['alert', 'error', 'event', 'notify', 'terminal'])
            expect(events).not.toContain('render')
            expect(events).not.toContain('save')
            expect(events).not.toContain('metric')
        } finally {
            await mp.stop()
        }
    })

    it('stores the row shape { ts, device, event, data, trace }', async () => {
        const mp = makeMP(TALKER_SERVICE)
        await mp.run()
        try {
            const t: any = mp.Container.devices['Talker1']
            t.ports.input.data.push('alert')

            const logger = mp.Bootstrap.getBootClass('ServiceLogger', ServiceLogger)
            const [row] = logger.tail(1)
            expect(row.device).toBe('Talker1')
            expect(row.event).toBe('alert')
            expect(row.data).toBe('alert-message')
            expect(row.trace).toEqual({ source: 'talker' })
            expect(typeof row.ts).toBe('number')
        } finally {
            await mp.stop()
        }
    })

    it('honors the channels option (captures only the listed channels)', async () => {
        const mp = makeMP(TALKER_SERVICE, {
            ServiceLogger: { options: { channels: ['error'] } },
        })
        await mp.run()
        try {
            const t: any = mp.Container.devices['Talker1']
            t.ports.input.data.push('notify')
            t.ports.input.data.push('error')

            const logger = mp.Bootstrap.getBootClass('ServiceLogger', ServiceLogger)
            const events = logger.tail(10).map((r: any) => r.event)
            expect(events).toEqual(['error'])
        } finally {
            await mp.stop()
        }
    })

    it('is readable after the process stopped — external access to the DB', async () => {
        const mp = makeMP(TALKER_SERVICE)
        await mp.run()
        const t: any = mp.Container.devices['Talker1']
        t.ports.input.data.push('notify')
        await mp.stop()
        // release the process's stores (closes tables, drops the journal locks)
        try { await mp.Bootstrap.destroyAll() } catch { /* ignore */ }

        // an external service opens the same dir and reads the table
        const store = new Store(path.resolve('./journals/logger'))
        store.init()
        try {
            const table = store.open('device_log')
            const rows = table.allRows()
            expect(rows.length).toBe(1)
            expect(rows[0].event).toBe('notify')
            expect(rows[0].data).toBe('notify-message')
        } finally {
            store.closeAll()
        }
    })

    it('enabled: false — no capture, query() throws SLG_NOT_STARTED; enable() starts capture', async () => {
        const mp = makeMP(TALKER_SERVICE, {
            ServiceLogger: { options: { enabled: false } },
        })
        await mp.run()
        try {
            const logger = mp.Bootstrap.getBootClass('ServiceLogger', ServiceLogger)
            expect(logger.enabled).toBe(false)
            expect(logger.DB).toBeNull()

            // no journal created, public read API is guarded
            expect(() => logger.count()).toThrow()
            try { logger.count() } catch (e) {
                expect(ErrorManager.isCode(e, 'SLG_NOT_STARTED')).toBe(true)
            }

            // events are not captured while disabled
            const t: any = mp.Container.devices['Talker1']
            t.ports.input.data.push('notify')
            t.ports.input.data.push('error')

            // enable() starts capture instantly
            logger.enable()
            expect(logger.enabled).toBe(true)
            expect(logger.DB).toBeInstanceOf(Store)

            t.ports.input.data.push('alert')
            expect(logger.count()).toBe(1)
            expect(logger.tail(10).map((r: any) => r.event)).toEqual(['alert'])
        } finally {
            await mp.stop()
        }
    })

    it('disable() stops capture, enable() resumes it (journal and subscriptions stay)', async () => {
        const mp = makeMP(TALKER_SERVICE)
        await mp.run()
        try {
            const logger = mp.Bootstrap.getBootClass('ServiceLogger', ServiceLogger)
            const t: any = mp.Container.devices['Talker1']

            t.ports.input.data.push('notify')
            expect(logger.count()).toBe(1)

            logger.disable()
            expect(logger.enabled).toBe(false)
            t.ports.input.data.push('error')
            expect(logger.count()).toBe(1)

            logger.enable()
            expect(logger.enabled).toBe(true)
            t.ports.input.data.push('alert')
            expect(logger.count()).toBe(2)
            expect(logger.tail(10).map((r: any) => r.event)).toEqual(['notify', 'alert'])
        } finally {
            await mp.stop()
        }
    })

    it('supports query(period) / count()', async () => {
        const mp = makeMP(TALKER_SERVICE)
        await mp.run()
        try {
            const t: any = mp.Container.devices['Talker1']
            t.ports.input.data.push('event')
            t.ports.input.data.push('event')
            t.ports.input.data.push('alert')

            const logger = mp.Bootstrap.getBootClass('ServiceLogger', ServiceLogger)
            expect(logger.count()).toBe(3)

            const res = logger.query('now-1m:now')
            expect(res.relevant).toBe(true)
            expect(res.rows.length).toBe(3)

            const empty = logger.query('now+1h:now+2h')
            expect(empty.relevant).toBe(false)
            expect(empty.rows).toEqual([])
        } finally {
            await mp.stop()
        }
    })
})
