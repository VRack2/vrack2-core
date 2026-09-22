/**
 * Unit tests for the BootDatabase base class (DBINTEGRATION.md, section 9).
 *
 * A fake adapter (FakeAdapter) inherits BootDatabase and implements the
 * 6 protected methods; the tests cover the base class behavior:
 * lifecycle, guard states, query/get/execute/transaction/ping,
 * error wrapping and terminate idempotency.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ErrorManager, BootDatabase } from 'vrack2-core'
import type { IExecResult } from 'vrack2-core'

class FakeAdapter extends BootDatabase {
    connected = false
    disconnected = false
    rows: Array<Record<string, any>> = []
    private connRef: unknown = null
    private txActive = false

    protected async connect() {
        if (this['connectShouldFail']) throw Object.assign(new Error('boom connect'), { code: 'SQLITE_CANTOPEN' })
        this.connected = true
    }

    protected async disconnect() {
        if (this['disconnectShouldFail']) throw Object.assign(new Error('boom disconnect'), { code: 'SQLITE_BUSY' })
        this.disconnected = true
    }

    protected async _query<T = Record<string, any>>(sql: string, params?: any[], conn?: unknown): Promise<T[]> {
        if (this['queryShouldFail']) throw Object.assign(new Error('boom query'), { code: 'SQLITE_CONSTRAINT_FOREIGNKEY' })
        if (sql === 'SELECT 1' || sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') return []
        this.rows.push({ sql, params, conn })
        return [{ v: 1 }]
    }

    protected async _execute(sql: string, params?: any[], conn?: unknown): Promise<IExecResult> {
        if (this['executeShouldFail']) throw Object.assign(new Error('boom execute'), { code: 'SQLITE_CANTOPEN' })
        if (sql === 'BEGIN') this.txActive = true
        if (sql === 'COMMIT' || sql === 'ROLLBACK') this.txActive = false
        this.rows.push({ sql, params, conn })
        return { affectedRows: 1, insertId: 42 }
    }

    protected async acquire(): Promise<unknown> {
        if (this.txActive) throw Object.assign(new Error('database is locked'), { code: 'SQLITE_BUSY' })
        this.txActive = true
        return this
    }

    protected async release(_conn: unknown): Promise<void> {
        this.txActive = false
    }
}

const id = (o: { [key: string]: any } = {}) => Object.assign(new FakeAdapter('DB', 'FakeAdapter', null, {}), o)

describe('BootDatabase', () => {

    beforeEach(() => {
        // flags are plain properties of the fake adapter
    })

    it('rejects every public API call before start with DB_NOT_READY', async () => {
        const db = id()
        await expect((db as any).query('SELECT 1')).rejects.toMatchObject({ vShort: 'DB_NOT_READY' })
        await expect((db as any).get('SELECT 1')).rejects.toMatchObject({ vShort: 'DB_NOT_READY' })
        await expect((db as any).execute('SELECT 1')).rejects.toMatchObject({ vShort: 'DB_NOT_READY' })
        await expect((db as any).transaction(async () => 1)).rejects.toMatchObject({ vShort: 'DB_NOT_READY' })
        await expect((db as any).ping()).rejects.toMatchObject({ vShort: 'DB_NOT_READY' })
        expect((db as any).ready).toBe(false)
    })

    it('start failure goes to closed and throws DB_CONNECT_FAILED (fail-fast)', async () => {
        const db: any = id({ connectShouldFail: true })
        await expect(db.processPromise()).rejects.toMatchObject({ vShort: 'DB_CONNECT_FAILED', driverCode: 'SQLITE_CANTOPEN', boot: 'DB' })
        expect((db as any).ready).toBe(false)
        await expect(db.query('SELECT 1')).rejects.toMatchObject({ vShort: 'DB_CLOSED' })
        expect((db as any).disconnected).toBe(false) // connect died, no disconnect to do
    })

    it('query/get/execute work after a successful start and route through the adapter', async () => {
        const db: any = id()
        await db.processPromise()
        expect(db.ready).toBe(true)

        const rows = await db.query<{ v: number }>('SELECT v FROM t', [1, 2])
        expect(rows).toEqual([{ v: 1 }])
        expect(db.rows).toContainEqual({ sql: 'SELECT v FROM t', params: [1, 2], conn: undefined })

        expect(await db.get('SELECT v')).toEqual({ v: 1 })
        expect(await db.execute('UPDATE t SET v = 2')).toEqual({ affectedRows: 1, insertId: 42 })

        await db.ping()
    })

    it('wraps driver errors into DB_QUERY_FAILED keeping message and driver code, never SQL', async () => {
        const db: any = id()
        await db.processPromise()
        db.queryShouldFail = true
        let err: any
        try {
            await db.query('SELECT secret FROM t', ['x'])
        } catch (e) {
            err = e
        }
        expect(ErrorManager.isCode(err, 'DB_QUERY_FAILED')).toBe(true)
        expect(err.message).toBe('boom query')
        expect(err.driverCode).toBe('SQLITE_CONSTRAINT_FOREIGNKEY')
        expect(JSON.stringify(err)).not.toContain('secret')
        expect(err.vAddErrors[0].code).toBe('SQLITE_CONSTRAINT_FOREIGNKEY')
    })

    it('transaction commits on success and calls the callback with a bound context', async () => {
        const db: any = id()
        await db.processPromise()
        let seen: any = null
        const result = await db.transaction(async (tx: BootDatabase) => {
            seen = tx
            await tx.execute('INSERT INTO t VALUES (1)')
            return 7
        })
        expect(result).toBe(7)
        expect(seen).not.toBe(db)
        const ins = db.rows.find((r: any) => r.sql === 'INSERT INTO t VALUES (1)')
        expect(ins.conn).toBe(db) // routed through the transaction connection
        const order = db.rows.map((r: any) => r.sql)
        expect(order.indexOf('BEGIN')).toBeLessThan(order.indexOf('INSERT INTO t VALUES (1)'))
        expect(order.indexOf('INSERT INTO t VALUES (1)')).toBeLessThan(order.indexOf('COMMIT'))
    })

    it('transaction rolls back on callback error and throws DB_TRANSACTION_FAILED', async () => {
        const db: any = id()
        await db.processPromise()
        let err: any
        try {
            await db.transaction(async () => {
                await db.execute('INSERT INTO t VALUES (1)')
                throw new Error('boom in fn')
            })
        } catch (e) {
            err = e
        }
        expect(ErrorManager.isCode(err, 'DB_TRANSACTION_FAILED')).toBe(true)
        expect(err.message).toBe('boom in fn')
        const order = db.rows.map((r: any) => r.sql)
        expect(order).toContain('ROLLBACK')
        expect(order).not.toContain('COMMIT')
        expect(db.txActive).toBe(false) // connection released
    })

    it('transaction wraps the connection-acquire failure (e.g. DBS_BUSY semantics)', async () => {
        const db: any = id()
        await db.processPromise()
        await db.acquire() // lock taken externally
        let err: any
        try {
            await db.transaction(async () => 1)
        } catch (e) {
            err = e
        }
        expect(ErrorManager.isCode(err, 'DB_TRANSACTION_FAILED')).toBe(true)
        expect(err.message).toBe('database is locked')
        expect(err.vAddErrors[0].code).toBe('SQLITE_BUSY')
        // acquire failed -> nothing was released -> the external lock stays held
        expect(db.txActive).toBe(true)
    })

    it('rejects a nested transaction() from within the open transaction (DB_TX_LOCKED)', async () => {
        const db: any = id()
        await db.processPromise()
        let err: any
        try {
            await db.transaction(async (tx: BootDatabase) => {
                await (tx as any).transaction(async () => 1)
            })
        } catch (e) {
            err = e
        }
        expect(ErrorManager.isCode(err, 'DB_TRANSACTION_FAILED')).toBe(true)
        expect(err.vAddErrors[0].vShort).toBe('DB_TX_LOCKED')
    })

    it('terminate closes the database; every later call rejects with DB_CLOSED', async () => {
        const db: any = id()
        await db.processPromise()
        await db.terminate()
        expect(db.disconnected).toBe(true)
        expect(db.ready).toBe(false)
        await expect(db.query('SELECT 1')).rejects.toMatchObject({ vShort: 'DB_CLOSED' })
        await expect(db.transaction(async () => 1)).rejects.toMatchObject({ vShort: 'DB_CLOSED' })
        await expect(db.ping()).rejects.toMatchObject({ vShort: 'DB_CLOSED' })
    })

    it('terminate is idempotent and never throws on driver failure (reported via system.error)', async () => {
        const db: any = id({ disconnectShouldFail: true })
        const sysError = vi.fn()
        db.Container = { emit: sysError }
        await db.terminate()
        await db.terminate()
        expect((sysError as any).mock.calls.length).toBe(1)
        expect((sysError as any).mock.calls[0][0]).toBe('system.error')
        expect((sysError as any).mock.calls[0][1].vShort).toBe('EM_ERROR_CONVERT')
        expect(db.disconnected).toBe(false)
    })
})