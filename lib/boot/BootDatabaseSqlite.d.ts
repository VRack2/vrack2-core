import type { DatabaseSync } from 'node:sqlite';
import BootDatabase, { IExecResult } from './BootDatabase';
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
    checkOptions(): {
        file: import("../validator/types/StringType").default;
        wal: import("../validator/types/BooleanType").default;
        readOnly: import("../validator/types/BooleanType").default;
    };
    /** The open handle (null until connected); single connection for the process */
    protected _handle: DatabaseSync | null;
    /** Prepared statements, cached per SQL text (node:sqlite has no pool — the cache is the "pool") */
    private _statements;
    /** Transaction lock: one transaction at a time on the single handle */
    private _txOpen;
    /**
     * Open the database file and apply the journal mode.
     * Requires Node.js ≥ 22.5: on older runtimes the dynamic import fails
     * and the base class reports `DB_CONNECT_FAILED` (fail-fast).
     */
    protected connect(): Promise<void>;
    /**
     * Close the handle and drop the prepared-statement cache.
     * The database file (if any) is not touched.
     */
    protected disconnect(): Promise<void>;
    protected _query<T = Record<string, any>>(sql: string, params?: any[], conn?: unknown): Promise<T[]>;
    protected _execute(sql: string, params?: any[], conn?: unknown): Promise<IExecResult>;
    /**
     * Take the single connection for a transaction.
     * There is exactly one `node:sqlite` handle in the process: a second
     * `acquire()` while a transaction is open is `DBS_BUSY` (never a pool).
     */
    protected acquire(): Promise<unknown>;
    /**
     * Return the single connection after a transaction (committed or rolled back).
     */
    protected release(_conn: unknown): Promise<void>;
    /**
     * Get (or prepare once per SQL text) the statement for the handle.
     * The single handle is the only one in the process, and a `conn` from
     * `acquire()` is that same handle — statements are always bound to it.
     */
    private _prepare;
}
