/**
 * Unit tests for BootDatabaseSqlite / BootDatabaseMemory against the real
 * node:sqlite driver (DBINTEGRATION.md, section 4, step 2).
 *
 * The base-class semantics (lifecycle, guards, error wrapping, transactions)
 * are covered by boot-database.test.ts with a fake adapter; here the real
 * driver is exercised: file databases, :memory:, WAL, read-only, real
 * transactions and the single-connection (DBS_BUSY) contract.
 */
import { describe, it, expect, afterEach } from 'vitest'
import { ErrorManager, BootDatabaseSqlite, BootDatabaseMemory } from 'vrack2-core'
import * as os from 'os'
import * as fs from 'fs'
import * as path from 'path'

const make = (cls: any, options: { [key: string]: any }) => new cls('DB', 'Test', null, options)
const start = async (db: any) => { await db.processPromise(); return db }

const tmpDirs: string[] = []
const tmpFile = (name: string) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vrack2-sqlite-'))
    tmpDirs.push(dir)
    return path.join(dir, name)
}

afterEach(() => {
    while (tmpDirs.length) {
        const dir = tmpDirs.pop()
        if (dir) fs.rmSync(dir, { recursive: true, force: true })
    }
})

const setupUsers = async (db: any) => {
    await db.execute(`CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE, active INTEGER NOT NULL DEFAULT 1)`)
}

describe('BootDatabaseSqlite', () => {

    it('round-trips query/get/execute on a real file database with params', async () => {
        const file = tmpFile('roundtrip.db')
        const db = make(BootDatabaseSqlite, { file })
        await start(db)
        await setupUsers(db)

        await db.execute('INSERT INTO users (name, active) VALUES (?, ?)', ['alice', 1])
        await db.execute('INSERT INTO users (name, active) VALUES (?, ?)', ['bob', 0])

        const rows = await db.query<{ name: string }[]>('SELECT name FROM users ORDER BY name')
        expect(rows).toEqual([{ name: 'alice' }, { name: 'bob' }])
        expect(await db.get('SELECT name FROM users WHERE name = ?', ['alice'])).toEqual({ name: 'alice' })
        expect(await db.get('SELECT name FROM users WHERE name = ?', ['ghost'])).toBeUndefined()

        await db.terminate()
        expect(fs.existsSync(file)).toBe(true) // the file exists even after close
    })

    it('reports affectedRows and insertId on execute', async () => {
        const file = tmpFile('exec.db')
        await start(make(BootDatabaseSqlite, { file }))
        const db = make(BootDatabaseSqlite, { file })
        await start(db)
        await setupUsers(db)

        const insert = await db.execute('INSERT INTO users (name) VALUES (?)', ['alice'])
        expect(insert).toMatchObject({ affectedRows: 1, insertId: 1 })
        const update = await db.execute('UPDATE users SET active = ? WHERE id = ?', [1, 1])
        expect(update).toMatchObject({ affectedRows: 1 })
        expect(update.insertId).toBeUndefined() // no INSERT here

        await db.terminate()
    })

    it('persistence: data survives terminate() and a new instance on the same file', async () => {
        const file = tmpFile('persist.db')
        const db = make(BootDatabaseSqlite, { file })
        await start(db)
        await setupUsers(db)
        await db.execute('INSERT INTO users (name) VALUES (?)', ['alice'])
        await db.terminate()

        const db2 = make(BootDatabaseSqlite, { file })
        await start(db2)
        expect(await db2.get('SELECT name FROM users WHERE id = 1')).toEqual({ name: 'alice' })
        await db2.terminate()
    })

    it('WAL is enabled by default on file databases and can be turned off', async () => {
        const file = tmpFile('wal.db')
        const db = make(BootDatabaseSqlite, { file })
        await start(db)
        expect((await db.get("PRAGMA journal_mode"))?.journal_mode).toBe('wal')
        await db.terminate()

        const db2 = make(BootDatabaseSqlite, { file, wal: false })
        await start(db2)
        // WAL cannot be switched off from inside; a freshly created file keeps the default delete mode
        const file2 = tmpFile('wal-off.db')
        await db2.terminate()
        const db3 = make(BootDatabaseSqlite, { file: file2, wal: false })
        await start(db3)
        expect((await db3.get("PRAGMA journal_mode"))?.journal_mode).toBe('delete')
        await db3.terminate()
    })

    it('opens read-only when requested: SELECT works, INSERT fails with a coded DB_QUERY_FAILED', async () => {
        const file = tmpFile('ro.db')
        const rw = make(BootDatabaseSqlite, { file })
        await start(rw)
        await setupUsers(rw)
        await rw.execute('INSERT INTO users (name) VALUES (?)', ['alice'])
        await rw.terminate()

        const ro = make(BootDatabaseSqlite, { file, readOnly: true })
        await start(ro)
        expect(await ro.get('SELECT name FROM users WHERE id = 1')).toEqual({ name: 'alice' })
        await expect(ro.execute('INSERT INTO users (name) VALUES (?)', ['bob'])).rejects.toMatchObject({
            vShort: 'DB_QUERY_FAILED',
        })
        await expect(ro.query('SELECT 1')).resolves.toEqual([
            // "SELECT 1" returns a row { 1: 1 } in node:sqlite — the shape is driver-specific, the key check is that it resolved
            expect.anything()
        ])
        await ro.terminate()
    })

    it('a bad path fails the start with DB_CONNECT_FAILED and a driver code', async () => {
        const file = tmpFile('blocked.db')
        fs.writeFileSync(file, 'not a database') // a file where the directory would be
        const db = make(BootDatabaseSqlite, { file: path.join(file, 'inner.db') })
        let err: any
        try {
            await db.processPromise()
        } catch (e) {
            err = e
        }
        expect(ErrorManager.isCode(err, 'DB_CONNECT_FAILED')).toBe(true)
        expect(typeof err.driverCode).toBe('string')
        expect(db.ready).toBe(false)
    })

    it('driver errors (no such table) are wrapped into DB_QUERY_FAILED without exposing the SQL', async () => {
        const file = tmpFile('err.db')
        const db = make(BootDatabaseSqlite, { file })
        await start(db)
        let err: any
        try {
            await db.query('SELECT * FROM table_that_does_not_exist')
        } catch (e) {
            err = e
        }
        expect(ErrorManager.isCode(err, 'DB_QUERY_FAILED')).toBe(true)
        expect(typeof err.driverCode).toBe('string')
        expect(JSON.stringify(err)).not.toContain('table_that_does_not_exist')
        await db.terminate()
    })

    it('a real transaction commits on success', async () => {
        const file = tmpFile('tx.db')
        const db = make(BootDatabaseSqlite, { file })
        await start(db)
        await setupUsers(db)

        const result = await db.transaction(async (tx: any) => {
            await tx.execute('INSERT INTO users (name) VALUES (?)', [1])
            await tx.execute('INSERT INTO users (name) VALUES (?)', [2])
            return 'done'
        })
        expect(result).toBe('done')
        expect(await db.query('SELECT COUNT(1) AS total FROM users')).toEqual([{ total: 2 }])

        await db.terminate()
    })

    it('a real transaction rolls back atomically on error', async () => {
        const file = tmpFile('tx-rb.db')
        const db = make(BootDatabaseSqlite, { file })
        await start(db)
        await setupUsers(db)

        let err: any
        try {
            await db.transaction(async (tx: any) => {
                await tx.execute('INSERT INTO users (name) VALUES (?)', ['one'])
                await tx.execute('INSERT INTO users (name) VALUES (?)', ['one']) // UNIQUE violation
            })
        } catch (e) {
            err = e
        }
        expect(ErrorManager.isCode(err, 'DB_TRANSACTION_FAILED')).toBe(true)
        expect(await db.query('SELECT COUNT(1) AS total FROM users')).toEqual([{ total: 0 }]) // rolled back
        // the connection is free for the next transaction
        await db.transaction(async (tx: any) => {
            await tx.execute('INSERT INTO users (name) VALUES (?)', ['two'])
        })
        await db.terminate()
    })

    it('a second concurrent transaction on the single connection is DBS_BUSY and the database stays usable afterwards', async () => {
        const file = tmpFile('busy.db')
        const db: any = make(BootDatabaseSqlite, { file })
        await start(db)
        await setupUsers(db)

        await (db as any).acquire() // simulate an open transaction taking the single handle
        let err: any
        try {
            await db.transaction(async () => 1)
        } catch (e) {
            err = e
        }
        expect(err.vShort).toBe('DBS_BUSY')
        expect(err.boot).toBe('DB')

        await (db as any).release(null)
        await db.transaction(async (tx: any) => {
            await tx.execute('INSERT INTO users (name) VALUES (?)', ['after'])
        })
        expect(await db.query('SELECT COUNT(1) AS total FROM users')).toEqual([{ total: 1 }])
        await db.terminate()
    })
})

describe('BootDatabaseMemory', () => {

    it('defaults to a pure in-memory database: no options needed, no file on disk', async () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vrack2-memory-'))
        tmpDirs.push(dir)
        const db = make(BootDatabaseMemory, {})
        await start(db)
        expect((db as any).options.file).toBe(':memory:')

        await (db as any).execute(`CREATE TABLE t (id INTEGER PRIMARY KEY, v TEXT)`)
        await (db as any).execute('INSERT INTO t (v) VALUES (?)', ['x'])
        expect(await (db as any).get('SELECT v FROM t WHERE id = 1')).toEqual({ v: 'x' })

        await db.terminate()
        // nothing was written to the requested directory
        expect(fs.readdirSync(dir)).toEqual([])
    })

    it('two instances are isolated (separate in-memory databases)', async () => {
        const a = make(BootDatabaseMemory, {})
        const b = make(BootDatabaseMemory, {})
        await start(a)
        await start(b)
        await (a as any).execute(`CREATE TABLE t (id INTEGER PRIMARY KEY, v TEXT)`)
        await (a as any).execute('INSERT INTO t (v) VALUES (?)', ['only-in-a'])

        // a fresh :memory: database has no tables at all
        let err: any
        try {
            await (b as any).execute('INSERT INTO t (v) VALUES (?)', ['x'])
        } catch (e) {
            err = e
        }
        expect(ErrorManager.isCode(err, 'DB_QUERY_FAILED')).toBe(true)

        await a.terminate()
        await b.terminate()
    })

    it('accepts an explicit file and behaves as a regular file database (persistence)', async () => {
        const file = tmpFile('memory-explicit.db')
        const dir = path.dirname(file)

        const db = make(BootDatabaseMemory, { file })
        await start(db)
        await (db as any).execute(`CREATE TABLE t (id INTEGER PRIMARY KEY, v TEXT)`)
        await (db as any).execute('INSERT INTO t (v) VALUES (?)', ['x'])
        await db.terminate()
        expect(fs.existsSync(file)).toBe(true)

        const db2 = make(BootDatabaseMemory, { file })
        await start(db2)
        expect(await (db2 as any).get('SELECT v FROM t WHERE id = 1')).toEqual({ v: 'x' })
        await db2.terminate()
        void dir
    })
})
