/**
 * Integration tests for the BootDatabase boot classes (Phase 4).
 *
 * Boots a real MainProcess whose `bootstrap` section contains a database
 * (`vrack2-core.BootDatabaseSqlite` / `vrack2-core.BootDatabaseMemory`)
 * alongside the standard boot classes, and verifies the full lifecycle:
 *   - `run()` opens the database (boot class `processPromise()`)
 *   - the service (devices) runs while the database is up
 *   - `terminate()` + `terminateAll()` close it (DB_CLOSED afterwards)
 *   - data is durable across two process boots (WAL checkpoint on close)
 *   - an invalid database configuration fails the service start (fail-fast)
 *
 * The adapter contract itself (state machine, guards, transactions) is
 * covered in test/unit/boot-database*.test.ts.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import path from 'path'
import os from 'os'
import fs from 'fs'

import {
    MainProcess,
    ErrorManager,
    BootDatabaseSqlite,
    BootDatabaseMemory,
    IServiceStructure,
} from 'vrack2-core'

const FIXTURES = path.resolve(__dirname, '../fixtures')

/** fresh tmp dir per test */
let tmp = ''
let lastMP: MainProcess | undefined

beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vrack2-dbit-'))
    lastMP = undefined
})
afterEach(async () => {
    if (lastMP) {
        try { await lastMP.terminate() } catch { /* startup already failed */ }
        try { await lastMP.Bootstrap.terminateAll() } catch { /* startup already failed */ }
    }
    lastMP = undefined
    if (tmp && fs.existsSync(tmp)) fs.rmSync(tmp, { recursive: true, force: true })
})

const COUNTER_SERVICE: IServiceStructure = {
    devices: [{ id: 'Counter1', type: 'testkit.Counter', options: {} }],
    connections: [],
}

/** Build a MainProcess with the standard boot classes + a database */
function makeMP(
    service: IServiceStructure,
    dbId = 'DB',
    dbOptions: Record<string, any> = {},
    dbPath = 'vrack2-core.BootDatabaseSqlite',
): MainProcess {
    const mp = new MainProcess({
        id: 'dbit',
        service,
        bootstrap: {
            DeviceManager: { path: 'vrack2-core.DeviceManager', options: { systemDir: FIXTURES, dir: 'devices' } },
            DeviceStorage: { path: 'vrack2-core.DeviceFileStorage', options: { storageDir: path.join(tmp, 'storage') } },
            StructureStorage: { path: 'vrack2-core.StructureStorage', options: { structureDir: path.join(tmp, 'structure') } },
            DeviceMetrics: { path: 'vrack2-core.DeviceMetrics', options: {} },
            [dbId]: { path: dbPath, options: dbOptions },
        },
    })
    lastMP = mp
    return mp
}

/** Run the process and return the thrown error (or undefined) */
async function runOrError(mp: MainProcess): Promise<any> {
    try {
        await mp.run()
        return undefined
    } catch (e) {
        return e
    }
}

/** Check that err (and its nested errors) contain the given vShort code */
function hasCode(err: any, code: string): boolean {
    if (!err) return false
    if (err.vShort === code) return true
    if (Array.isArray(err.vAddErrors)) return err.vAddErrors.some((e: any) => hasCode(e, code))
    return false
}

/* ================================================================== */
/*  FILE-BACKED SQLITE DATABASE IN A SERVICE                          */
/* ================================================================== */

describe('Service with a file-backed SQLite database', () => {

    it('boots, runs devices, and terminates the database cleanly', async () => {
        const dbFile = path.join(tmp, 'svc.db')
        const mp = makeMP(COUNTER_SERVICE, 'DB', { file: dbFile })
        await mp.run()

        const db = mp.Bootstrap.getBootClass('DB', BootDatabaseSqlite)
        expect(db.ready).toBe(true)
        expect(await db.get('SELECT 1 AS one')).toEqual({ one: 1 })
        expect(fs.existsSync(dbFile)).toBe(true)

        // the service works alongside the database
        const c: any = mp.Container.devices['Counter1']
        c.ports.input.data.push(7)
        expect(c.count).toBe(7)

        await mp.terminate()
        await mp.Bootstrap.terminateAll()

        // the database is closed: every public call rejects with DB_CLOSED
        await expect(db.get('SELECT 1')).rejects.toMatchObject({ vShort: 'DB_CLOSED' })
    })

    it('keeps data between two process boots (WAL is checkpointed on close)', async () => {
        const dbFile = path.join(tmp, 'svc.db')

        // first process: create a table and write a row
        const first = makeMP(COUNTER_SERVICE, 'DB', { file: dbFile })
        await first.run()
        const db1 = first.Bootstrap.getBootClass('DB', BootDatabaseSqlite)
        await db1.transaction(async (tx) => {
            await tx.execute('CREATE TABLE kv (k TEXT PRIMARY KEY, v INTEGER)')
            await tx.execute('INSERT INTO kv (k, v) VALUES (?, ?)', ['first', 42])
        })
        await first.terminate()
        await first.Bootstrap.terminateAll()
        lastMP = undefined

        // second process: same file — the row must be there
        const second = makeMP(COUNTER_SERVICE, 'DB', { file: dbFile })
        await second.run()
        const db2 = second.Bootstrap.getBootClass('DB', BootDatabaseSqlite)
        expect(await db2.get('SELECT v FROM kv WHERE k = ?', ['first'])).toEqual({ v: 42 })
    }, 10000)

    it('device.getDB() returns the database (default id) for query & transaction', async () => {
        const service: IServiceStructure = {
            devices: [{ id: 'Reader1', type: 'testkit.DbReader', options: {} }],
            connections: [],
        }
        const mp = makeMP(service, 'DB', { file: path.join(tmp, 'svc.db') })
        await mp.run()

        // the device's processPromise() already ran `SELECT 1` through this.getDB(): shares prove it
        expect((mp.Container.devices['Reader1'] as any).shares.one).toBe(1)

        const db = mp.Bootstrap.getBootClass('DB', BootDatabaseSqlite)
        await db.transaction(async (tx) => { tx.execute('CREATE TABLE kv (k TEXT PRIMARY KEY, v INTEGER)') })

        // the device's action 'write' uses this.getDB().transaction() on the same database
        expect(await mp.Container.deviceAction('Reader1', 'write', { k: 'fromDevice', v: 7 })).toBe(7)
        expect(await db.get('SELECT v FROM kv WHERE k = ?', ['fromDevice'])).toEqual({ v: 7 })

        // unknown id → BTSP_CLASS_ID_NOT_FOUND from the Bootstrap guard
        let caught: any
        try { (mp.Container.devices['Reader1'] as any).getDB('Nope') } catch (e) { caught = e }
        expect(caught?.vShort).toBe('BTSP_CLASS_ID_NOT_FOUND')

        await mp.terminate()
        await mp.Bootstrap.terminateAll()
    })
})

/* ================================================================== */
/*  FAULTS AT SERVICE START (fail-fast)                               */
/* ================================================================== */

describe('Database faults at service start', () => {

    it('fails the service when a database option is invalid (VR_NOT_PASS)', async () => {
        const mp = makeMP(COUNTER_SERVICE, 'DB', {
            file: path.join(tmp, 'svc.db'),
            readOnly: 'yes', // not a boolean
        })
        const err = await runOrError(mp)
        expect(err).toBeDefined()
        expect(ErrorManager.isCode(err, 'VR_NOT_PASS')).toBe(true)
        expect(err.problems.some((p: any) => p.fieldKey === 'readOnly')).toBe(true)
    })

    it('fails the service when the database cannot be connected (DB_CONNECT_FAILED)', async () => {
        // a path whose directory does not exist: the driver cannot open it
        const badFile = path.join(tmp, 'no-such-dir', 'svc.db')
        const mp = makeMP(COUNTER_SERVICE, 'DB', { file: badFile })
        const err = await runOrError(mp)
        expect(err).toBeDefined()
        expect(hasCode(err, 'DB_CONNECT_FAILED')).toBe(true)

        const connErr = (err.vAddErrors || []).find((e: any) => hasCode(e, 'DB_CONNECT_FAILED')) || err
        expect(connErr.driverCode).toBe('ERR_SQLITE_ERROR')
        expect(String(connErr.message)).toContain('unable to open')
    })
})

/* ================================================================== */
/*  IN-MEMORY DATABASE IN A SERVICE                                    */
/* ================================================================== */

describe('Service with an in-memory database', () => {

    it('boots BootDatabaseMemory and works without any file', async () => {
        const mp = makeMP(COUNTER_SERVICE, 'DB', {}, 'vrack2-core.BootDatabaseMemory')
        await mp.run()

        const db = mp.Bootstrap.getBootClass('DB', BootDatabaseMemory)
        expect(db.ready).toBe(true)
        await db.transaction(async (tx) => {
            await tx.execute('CREATE TABLE t (v INTEGER)')
            await tx.execute('INSERT INTO t VALUES (1)')
        })
        expect(await db.get('SELECT COUNT(*) AS n FROM t')).toEqual({ n: 1 })
    })
})
