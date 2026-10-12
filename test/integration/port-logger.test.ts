/**
 * PortLogger integration tests.
 *
 * Boots a real MainProcess (default boot list → PortLogger is enabled by
 * default), drives output-port traffic through the testkit devices and
 * verifies the `device.port` events are captured in the journal-db table
 * `port_log` and readable back — via query() / tail() / count(), and
 * externally through the exposed Store (a fresh instance over the same dir).
 *
 * Also covers: coexistence with ServiceLogger in one shared store dir
 * (per-table locks), `noCapture()` ports being suppressed, the `enabled`
 * option, and live enable()/disable().
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import path from 'path'
import os from 'os'
import fs from 'fs'

import { MainProcess, PortLogger, ServiceLogger, ErrorManager, IServiceStructure } from 'vrack2-core'
import { Store } from 'vrack2-journal-db'

let tmp = ''
let oldCwd = ''
beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vrack2-portlog-'))
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

function makeMP(service: IServiceStructure, serviceBootstrap?: IServiceStructure['bootstrap']): MainProcess {
    return new MainProcess({
        id: 'logger',
        service: { ...service, bootstrap: serviceBootstrap },
        bootstrap: {
            DeviceManager: { path: 'vrack2-core.DeviceManager', options: { systemDir: path.resolve(__dirname, '../fixtures'), dir: 'devices' } },
        },
    })
}

describe('PortLogger: default boot list', () => {
    it('is enabled by default (id PortLogger) and exposes its DB + port_log table', async () => {
        const mp = makeMP(TALKER_SERVICE)
        await mp.run()
        try {
            const logger = mp.Bootstrap.getBootClass('PortLogger', PortLogger)
            expect(logger.DB).toBeInstanceOf(Store)
            expect(logger.table).toBeDefined()
            expect(logger.DB.openTables.has('port_log')).toBe(true)
        } finally {
            await mp.stop()
        }
    })

    it('shares the same store dir as ServiceLogger (separate tables, per-table locks)', async () => {
        const mp = makeMP(TALKER_SERVICE)
        await mp.run()
        try {
            const sl = mp.Bootstrap.getBootClass('ServiceLogger', ServiceLogger)
            const pl = mp.Bootstrap.getBootClass('PortLogger', PortLogger)

            // same absolute dir, distinct tables
            expect(path.resolve(pl.DB!.path())).toBe(path.resolve(sl.DB!.path()))
            expect(sl.DB.openTables.has('device_log')).toBe(true)
            expect(pl.DB.openTables.has('port_log')).toBe(true)

            // both capture independently: a port push + a channel event
            const t: any = mp.Container.devices['Talker1']
            t.ports.input.data.push('alert')

            expect(sl.tail(10).map((r: any) => r.event)).toEqual(['alert'])
            expect(pl.tail(10).map((r: any) => r.port)).toEqual(['out'])
        } finally {
            await mp.stop()
        }
    })

    it('can be disabled via PortLogger: null in the service bootstrap', async () => {
        const mp = makeMP(TALKER_SERVICE, { PortLogger: null })
        await mp.run()
        try {
            expect(() => mp.Bootstrap.getBootClass('PortLogger', PortLogger)).toThrow()
        } finally {
            await mp.stop()
        }
    })
})

describe('PortLogger: event capture', () => {
    it('captures device.port { device, port, data } on output pushes', async () => {
        const mp = makeMP(TALKER_SERVICE)
        await mp.run()
        try {
            const t: any = mp.Container.devices['Talker1']
            t.ports.input.data.push('notify')
            t.ports.input.data.push('alert')

            const logger = mp.Bootstrap.getBootClass('PortLogger', PortLogger)
            const rows = logger.tail(10)
            expect(rows.length).toBe(2)
            expect(rows[0]).toMatchObject({ device: 'Talker1', port: 'out', data: 'notify' })
            expect(rows[1]).toMatchObject({ device: 'Talker1', port: 'out', data: 'alert' })
            expect(typeof rows[0].ts).toBe('number')
        } finally {
            await mp.stop()
        }
    })

    it('honors noCapture(): hidden output port is not captured, open port is', async () => {
        const mp = makeMP({
            devices: [{ id: 'Src1', type: 'testkit.NoCaptureSrc', options: {} }],
            connections: [],
        })
        await mp.run()
        try {
            const src: any = mp.Container.devices['Src1']
            src.ports.output.open.push('visible')
            src.ports.output.hidden.push('invisible')

            const logger = mp.Bootstrap.getBootClass('PortLogger', PortLogger)
            const rows = logger.tail(10)
            expect(rows.length).toBe(1)
            expect(rows[0]).toMatchObject({ device: 'Src1', port: 'open', data: 'visible' })
            expect(rows.map((r: any) => r.port)).not.toContain('hidden')
        } finally {
            await mp.stop()
        }
    })

    it('enabled: false — no capture, query() throws PLG_NOT_STARTED; enable() starts capture', async () => {
        const mp = makeMP(TALKER_SERVICE, {
            PortLogger: { options: { enabled: false } },
        })
        await mp.run()
        try {
            const logger = mp.Bootstrap.getBootClass('PortLogger', PortLogger)
            expect(logger.enabled).toBe(false)
            expect(logger.DB).toBeNull()

            expect(() => logger.count()).toThrow()
            try { logger.count() } catch (e) {
                expect(ErrorManager.isCode(e, 'PLG_NOT_STARTED')).toBe(true)
            }

            // not captured while disabled
            const t: any = mp.Container.devices['Talker1']
            t.ports.input.data.push('notify')

            // enable() starts capture instantly
            logger.enable()
            expect(logger.enabled).toBe(true)
            expect(logger.DB).toBeInstanceOf(Store)

            t.ports.input.data.push('alert')
            expect(logger.count()).toBe(1)
            expect(logger.tail(10).map((r: any) => r.port)).toEqual(['out'])
        } finally {
            await mp.stop()
        }
    })

    it('disable() stops capture, enable() resumes it', async () => {
        const mp = makeMP(TALKER_SERVICE)
        await mp.run()
        try {
            const logger = mp.Bootstrap.getBootClass('PortLogger', PortLogger)
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
            expect(logger.tail(10).map((r: any) => r.data)).toEqual(['notify', 'alert'])
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

            const logger = mp.Bootstrap.getBootClass('PortLogger', PortLogger)
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

    it('is readable after the process stopped — external access to the DB', async () => {
        const mp = makeMP(TALKER_SERVICE)
        await mp.run()
        const t: any = mp.Container.devices['Talker1']
        t.ports.input.data.push('notify')
        await mp.stop()
        try { await mp.Bootstrap.destroyAll() } catch { /* ignore */ }

        const store = new Store(path.resolve('./journals/logger'))
        store.init()
        try {
            const table = store.open('port_log')
            const rows = table.allRows()
            expect(rows.length).toBe(1)
            expect(rows[0].port).toBe('out')
            expect(rows[0].data).toBe('notify')
        } finally {
            store.closeAll()
        }
    })
})
