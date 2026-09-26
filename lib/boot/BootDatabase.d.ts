import BootClass from './BootClass';
import CoreError from '../errors/CoreError';
/**
 * Result of an execute command
 *
 * @example
 * ```ts
 * { affectedRows: 1, insertId: 42 }
 * ```
 */
export interface IExecResult {
    /** Number of rows affected by the command */
    affectedRows: number;
    /** Id of the inserted row (where applicable to the database) */
    insertId?: number;
}
/**
 * Base class for a database: a boot class that owns the process-wide
 * connection to a database.
 *
 * A database is a process-level resource: it is created once per service
 * in the `bootstrap` section of `service.json`, is available to all devices
 * and is terminated with the process (never by a device).
 *
 * The lifecycle is a 3-state machine:
 *  - `pending` — not started; all public calls reject with `DB_NOT_READY`
 *  - `ready` — connected; all public calls work
 *  - `closed` — stopped; all public calls reject with `DB_CLOSED`
 *
 * A database adapter (a concrete subclass) implements exactly 6 protected
 * methods: `connect`, `disconnect`, `_query`, `_execute`, `acquire`,
 * `release` (plus optional `checkOptions`) — only the dialect-specific
 * details live there. Everything else (the state machine, the guards,
 * `transaction()`, the error wrapping) is implemented once in this base
 * class, so all adapters share the same public API and the same semantics.
 *
 * @extends BootClass
 */
export default abstract class BootDatabase extends BootClass {
    /**
     * The lifecycle state of the class
     */
    protected _state: 'pending' | 'ready' | 'closed';
    /**
     * Connect to the database.
     * A failure fails the service start (fail-fast; retries are the
     * supervisor's job, not the framework's).
     */
    protected abstract connect(): Promise<void>;
    /**
     * Disconnect from the database. Called from `terminate()`.
     */
    protected abstract disconnect(): Promise<void>;
    /**
     * Execute a SQL query; returns all rows.
     * Positions-only params (`?`); named params and SQL concatenation
     * are not part of the contract.
     *
     * @param sql SQL text
     * @param params Positional query parameters
     * @param conn Connection from `acquire()` — the transaction context
     */
    protected abstract _query<T = Record<string, any>>(sql: string, params?: any[], conn?: unknown): Promise<T[]>;
    /**
     * Execute a SQL command; returns its result.
     *
     * @param sql SQL text
     * @param params Positional query parameters
     * @param conn Connection from `acquire()` — the transaction context
     */
    protected abstract _execute(sql: string, params?: any[], conn?: unknown): Promise<IExecResult>;
    /**
     * Take a connection (from the pool, or the single handle) for a
     * transaction. One transaction may be in progress at a time:
     * a concurrent `acquire()` must reject (`DBS_BUSY`).
     */
    protected abstract acquire(): Promise<unknown>;
    /**
     * Return a connection to the pool.
     * Must always be called after a successful `acquire()`,
     * including after a failed transaction.
     */
    protected abstract release(conn: unknown): Promise<void>;
    /**
     * Start the database: `connect()` and go to `ready`.
     * On failure the class goes to `closed` and throws `DB_CONNECT_FAILED`
     * so the service does not start (fail-fast).
     */
    processPromise(): Promise<void>;
    /**
     * Stop the database: `disconnect()` and go to `closed`.
     *
     * Idempotent: a second call is a no-op. A `disconnect()` failure is
     * reported as a `system.error` event and is not thrown: the process
     * is exiting anyway and `Bootstrap.terminateAll()` must continue
     * with the remaining boot classes.
     */
    terminate(): Promise<void>;
    /**
     * True once the database is started and connected
     */
    get ready(): boolean;
    /**
     * Execute a SQL query; returns all rows.
     * Rejects with `DB_NOT_READY` / `DB_CLOSED` depending on the lifecycle
     * state, and with `DB_QUERY_FAILED` (with the driver's `message` and,
     * where present, its code — never the SQL or its params) on driver error.
     *
     * @param sql SQL text
     * @param params Positional query parameters
     */
    query<T = Record<string, any>>(sql: string, params?: any[]): Promise<T[]>;
    /**
     * Execute a SQL query; returns the first row or `undefined`.
     *
     * @param sql SQL text
     * @param params Positional query parameters
     */
    get<T = Record<string, any>>(sql: string, params?: any[]): Promise<T | undefined>;
    /**
     * Execute a SQL command (INSERT/UPDATE/DELETE/DDL); returns its result.
     *
     * @param sql SQL text
     * @param params Positional query parameters
     */
    execute(sql: string, params?: any[]): Promise<IExecResult>;
    /**
     * Execute the callback within a transaction with the same semantics
     * for every adapter: `acquire()` → `BEGIN` → `fn(tx)` →
     * `COMMIT`/`ROLLBACK` → `release()`.
     *
     * The callback receives a transaction context where every
     * `query`/`get`/`execute` call is routed through the transaction's
     * connection; a nested `transaction()` from inside it is not allowed
     * (`DB_TX_LOCKED`). On any failure the transaction is rolled back and
     * `DB_TRANSACTION_FAILED` is thrown; the connection is released either
     * way.
     *
     * @param fn Callback executed within the transaction
     */
    transaction<T>(fn: (tx: BootDatabase) => Promise<T>): Promise<T>;
    /**
     * Check that the database is alive.
     * Throws when it is not available (by design — «threw = not alive»).
     *
     * `SELECT 1` is valid in all supported dialects, so the base class
     * performs it via `_query()` — the adapter implements nothing extra.
     */
    ping(): Promise<void>;
    /**
     * Lifecycle guard of the public methods:
     * rejects with `DB_NOT_READY` before start, with `DB_CLOSED` after stop
     */
    protected guard(): void;
    /**
     * Re-wrap a driver error into a coded `DB_QUERY_FAILED` error.
     *
     * By the design decision the error carries the driver's `message` and,
     * where present, its code (`driverCode`) — but never the SQL text or
     * its params (they are sensitive).
     * VRack errors (e.g. coded errors thrown by an adapter itself) pass through unchanged.
     */
    protected wrapDriverError(e: any): CoreError;
    /**
     * The transaction context: a wrapper over this class where all
     * `query`/`get`/`execute` calls are routed through the given
     * connection. `transaction()` from inside is not allowed
     * (`DB_TX_LOCKED`); every other member passes through unchanged
     * (functions stay bound to the class, never to the connection).
     */
    protected bind(conn: unknown): BootDatabase;
}
