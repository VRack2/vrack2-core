/*
 * Copyright © 2024 Boris Bobylev. All rights reserved.
 * Licensed under the Apache License, Version 2.0
 */

import type { DatabaseSync, StatementSync } from 'node:sqlite'
import BootDatabase, { IExecResult } from './BootDatabase'
import ErrorManager from '../errors/ErrorManager'
import Rule from '../validator/Rule'

/**
 * SQLite adapter for `BootDatabase`, backed by the built-in `node:sqlite`
 * module (no external npm driver). Requires Node.js ≥ 22.5 (the module is
 * built-in there); on older runtimes `connect()` fails with
 * `DB_CONNECT_FAILED` and the service does not start — the same fail-fast
 * contract as every other database.
 *
 * `node:sqlite` is synchronous, so the driver calls complete before the
 * promise resolves — the async surface is the single connection point with
 * the rest of the (async) framework.
 *
 * Connection management is intentionally simple:
 *  - **one handle** for the process (`node:sqlite` is not pooled)
 *  - prepared statements are cached per SQL text
 *  - a **transaction** is `BEGIN`/`COMMIT`/`ROLLBACK` on the same handle
 *    (single connection: at most one, enforced by the base class)
 *  - WAL (default on) makes concurrent readers from other processes safe;
 *    only **one writer per file at a time** (the driver reports `SQLITE_BUSY`
 *    — surfaced as `DB_QUERY_FAILED` with `driverCode`)
 *
 * @extends BootDatabase
 */
export default class BootDatabaseSqlite extends BootDatabase {

    /**
     * Options:
     *  - `file` (string, required) — path to the database file;
     *    `:memory:` is a valid in-memory database
     *  - `wal` (boolean, default `true`) — enable WAL journal mode
     *    (file databases; skipped for `:memory:` and read-only databases)
     *  - `readOnly` (boolean, default `false`) — open the database read-only
     */
    checkOptions() {
        return {
            file: Rule.string().required().description('Path to the SQLite database file ("":memory:" for in-memory — or use BootDatabaseMemory)'),
            wal: Rule.boolean().required().default(true).description('Enable WAL journal mode (no effect on ":memory:" or read-only databases)'),
            readOnly: Rule.boolean().required().default(false).description('Open the database in read-only mode (no writes, no WAL)')
        }
    }

    /** The open handle (null until connected); single connection for the process */
    protected _handle: DatabaseSync | null = null

    /** Prepared statements, cached per SQL text (node:sqlite has no pool — the cache is the "pool") */
    private _statements = new Map<string, StatementSync>()

    /** Transaction lock: one transaction at a time on the single handle */
    private _txOpen = false

    /**
     * Open the database file and apply the journal mode.
     * Requires Node.js ≥ 22.5: on older runtimes the dynamic import fails
     * and the base class reports `DB_CONNECT_FAILED` (fail-fast).
     */
    protected async connect(): Promise<void> {
        let driver: typeof import('node:sqlite')
        try {
            driver = await import('node:sqlite')
        } catch (e: any) {
            throw Object.assign(
                new Error(`The "node:sqlite" module is not available in this Node.js runtime — it requires Node.js 22.5 or newer: ${e?.message}`),
                { code: String(e?.code ?? 'ERR_MODULE_NOT_FOUND') }
            )
        }

        const file: string = this.options.file
        const openOptions: import('node:sqlite').DatabaseSyncOptions = {}
        if (this.options.readOnly) openOptions.readOnly = true
        this._handle = new driver.DatabaseSync(file, openOptions)

        // WAL needs write access; a file database in writable mode gets it,
        // an in-memory or read-only database keeps its default journal mode.
        if (this.options.wal && !this.options.readOnly && file !== ':memory:') {
            this._handle.exec('PRAGMA journal_mode = WAL')
        }
    }

    /**
     * Close the handle and drop the prepared-statement cache.
     * The database file (if any) is not touched.
     */
    protected async disconnect(): Promise<void> {
        if (this._handle) {
            this._handle.close()
            this._handle = null
        }
        this._statements.clear()
    }

    protected async _query<T = Record<string, any>>(sql: string, params?: any[], conn?: unknown): Promise<T[]> {
        const stmt = this._prepare(sql)
        return stmt.all(...(params ?? [])) as T[]
    }

    protected async _execute(sql: string, params?: any[], conn?: unknown): Promise<IExecResult> {
        const stmt = this._prepare(sql)
        const res = stmt.run(...(params ?? []))
        const result: IExecResult = { affectedRows: Number(res.changes) }
        // lastInsertRowid in SQLite is only updated by INSERT statements
        // (UPDATE/DELETE keep the previous value), so report it only for them
        if (res.lastInsertRowid > 0 && /^\s*insert\s/i.test(sql)) result.insertId = Number(res.lastInsertRowid)
        return result
    }

    /**
     * Take the single connection for a transaction.
     * There is exactly one `node:sqlite` handle in the process: a second
     * `acquire()` while a transaction is open is `DBS_BUSY` (never a pool).
     */
    protected async acquire(): Promise<unknown> {
        if (this._txOpen) throw ErrorManager.make('DBS_BUSY', { boot: this.id })
        this._txOpen = true
        return this._handle
    }

    /**
     * Return the single connection after a transaction (committed or rolled back).
     */
    protected async release(_conn: unknown): Promise<void> {
        this._txOpen = false
    }

    /**
     * Get (or prepare once per SQL text) the statement for the handle.
     * The single handle is the only one in the process, and a `conn` from
     * `acquire()` is that same handle — statements are always bound to it.
     */
    private _prepare(sql: string): StatementSync {
        let stmt = this._statements.get(sql)
        if (stmt === undefined) {
            stmt = this._handle?.prepare(sql)
            if (stmt === undefined) throw new Error('The database is not connected')
            this._statements.set(sql, stmt)
        }
        return stmt
    }
}
