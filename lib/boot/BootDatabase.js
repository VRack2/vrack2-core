"use strict";
/*
 * Copyright © 2024 Boris Bobylev. All rights reserved.
 * Licensed under the Apache License, Version 2.0
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const BootClass_1 = __importDefault(require("./BootClass"));
const ErrorManager_1 = __importDefault(require("../errors/ErrorManager"));
const Rule_1 = __importDefault(require("../validator/Rule"));
ErrorManager_1.default.registerMany('BootDatabase', [
    {
        short: 'DB_NOT_READY',
        description: 'A call was made before the database finished starting (before processPromise() resolved)',
        rules: {
            boot: Rule_1.default.string().required().description('Boot class id')
        }
    },
    {
        short: 'DB_CLOSED',
        description: 'A call was made after the database was terminated',
        rules: {
            boot: Rule_1.default.string().required().description('Boot class id')
        }
    },
    {
        short: 'DB_CONNECT_FAILED',
        description: 'The database could not be connected at service start (fail-fast: the service does not start)',
        rules: {
            message: Rule_1.default.string().required().description('Driver error message'),
            boot: Rule_1.default.string().required().description('Boot class id'),
            driverCode: Rule_1.default.string().description('Driver-specific error code (errno, code)')
        }
    },
    {
        short: 'DB_QUERY_FAILED',
        description: 'A database query failed (the driver error, re-wrapped; SQL text and params are not carried — they are sensitive)',
        rules: {
            message: Rule_1.default.string().required().description('Driver error message'),
            boot: Rule_1.default.string().required().description('Boot class id'),
            driverCode: Rule_1.default.string().description('Driver-specific error code (errno, code)')
        }
    },
    {
        short: 'DBS_BUSY',
        description: 'A second transaction was attempted on a database with a single connection (e.g. SQLite)',
        rules: {
            boot: Rule_1.default.string().required().description('Boot class id')
        }
    },
    {
        short: 'DB_TX_LOCKED',
        description: 'A nested transaction() call from within an open transaction is not allowed',
        rules: {
            boot: Rule_1.default.string().required().description('Boot class id')
        }
    },
    {
        short: 'DB_TRANSACTION_FAILED',
        description: 'A transaction could not be committed (error in the callback or in COMMIT; the rollback was performed)',
        rules: {
            message: Rule_1.default.string().required().description('The failure reason'),
            boot: Rule_1.default.string().required().description('Boot class id')
        }
    }
]);
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
class BootDatabase extends BootClass_1.default {
    constructor() {
        super(...arguments);
        /**
         * The lifecycle state of the class
         */
        this._state = 'pending';
    }
    /* ─── Lifecycle ─── */
    /**
     * Start the database: `connect()` and go to `ready`.
     * On failure the class goes to `closed` and throws `DB_CONNECT_FAILED`
     * so the service does not start (fail-fast).
     */
    async processPromise() {
        try {
            await this.connect();
        }
        catch (e) {
            this._state = 'closed';
            const extra = { message: e?.message, boot: this.id };
            if (e?.code !== undefined)
                extra.driverCode = e.code;
            const err = ErrorManager_1.default.make('DB_CONNECT_FAILED', extra);
            err.vAddErrors.push(e);
            throw err;
        }
        this._state = 'ready';
    }
    /**
     * Stop the database: `disconnect()` and go to `closed`.
     *
     * Idempotent: a second call is a no-op. A `disconnect()` failure is
     * reported as a `system.error` event and is not thrown: the process
     * is exiting anyway and `Bootstrap.terminateAll()` must continue
     * with the remaining boot classes.
     */
    async terminate() {
        if (this._state === 'closed')
            return;
        try {
            await this.disconnect();
        }
        catch (e) {
            this.error(ErrorManager_1.default.isError(e) ? e : ErrorManager_1.default.convert(e));
        }
        finally {
            this._state = 'closed';
        }
    }
    /**
     * True once the database is started and connected
     */
    get ready() {
        return this._state === 'ready';
    }
    /* ─── Public API ─── */
    /**
     * Execute a SQL query; returns all rows.
     * Rejects with `DB_NOT_READY` / `DB_CLOSED` depending on the lifecycle
     * state, and with `DB_QUERY_FAILED` (with the driver's `message` and,
     * where present, its code — never the SQL or its params) on driver error.
     *
     * @param sql SQL text
     * @param params Positional query parameters
     */
    async query(sql, params) {
        this.guard();
        try {
            return await this._query(sql, params);
        }
        catch (e) {
            throw this.wrapDriverError(e);
        }
    }
    /**
     * Execute a SQL query; returns the first row or `undefined`.
     *
     * @param sql SQL text
     * @param params Positional query parameters
     */
    async get(sql, params) {
        this.guard();
        try {
            const rows = await this._query(sql, params);
            return rows[0];
        }
        catch (e) {
            throw this.wrapDriverError(e);
        }
    }
    /**
     * Execute a SQL command (INSERT/UPDATE/DELETE/DDL); returns its result.
     *
     * @param sql SQL text
     * @param params Positional query parameters
     */
    async execute(sql, params) {
        this.guard();
        try {
            return await this._execute(sql, params);
        }
        catch (e) {
            throw this.wrapDriverError(e);
        }
    }
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
    async transaction(fn) {
        this.guard();
        let conn = null;
        let acquired = false;
        try {
            try {
                conn = await this.acquire();
                acquired = true;
            }
            catch (e) {
                // An adapter may already report a coded error (e.g. DBS_BUSY)
                if (ErrorManager_1.default.isError(e))
                    throw e;
                const err = ErrorManager_1.default.make('DB_TRANSACTION_FAILED', { message: e?.message, boot: this.id });
                err.vAddErrors.push(e);
                throw err;
            }
            try {
                await this._execute('BEGIN', [], conn);
                const result = await fn(this.bind(conn));
                await this._execute('COMMIT', [], conn);
                return result;
            }
            catch (e) {
                let rbError = null;
                try {
                    await this._execute('ROLLBACK', [], conn);
                }
                catch (rb) {
                    rbError = rb;
                }
                const err = ErrorManager_1.default.make('DB_TRANSACTION_FAILED', { message: e?.message, boot: this.id });
                err.vAddErrors.push(e);
                if (rbError !== null)
                    err.vAddErrors.push(rbError);
                throw err;
            }
        }
        finally {
            if (acquired)
                await this.release(conn);
        }
    }
    /**
     * Check that the database is alive.
     * Throws when it is not available (by design — «threw = not alive»).
     *
     * `SELECT 1` is valid in all supported dialects, so the base class
     * performs it via `_query()` — the adapter implements nothing extra.
     */
    async ping() {
        this.guard();
        try {
            await this._query('SELECT 1');
        }
        catch (e) {
            throw this.wrapDriverError(e);
        }
    }
    /* ─── Internals ─── */
    /**
     * Lifecycle guard of the public methods:
     * rejects with `DB_NOT_READY` before start, with `DB_CLOSED` after stop
     */
    guard() {
        if (this._state === 'pending')
            throw ErrorManager_1.default.make('DB_NOT_READY', { boot: this.id });
        if (this._state === 'closed')
            throw ErrorManager_1.default.make('DB_CLOSED', { boot: this.id });
    }
    /**
     * Re-wrap a driver error into a coded `DB_QUERY_FAILED` error.
     *
     * By the design decision the error carries the driver's `message` and,
     * where present, its code (`driverCode`) — but never the SQL text or
     * its params (they are sensitive).
     * VRack errors (e.g. coded errors thrown by an adapter itself) pass through unchanged.
     */
    wrapDriverError(e) {
        if (ErrorManager_1.default.isError(e))
            return e;
        const extra = { message: e?.message, boot: this.id };
        if (e?.code !== undefined)
            extra.driverCode = e.code;
        const err = ErrorManager_1.default.make('DB_QUERY_FAILED', extra);
        err.vAddErrors.push(e);
        return err;
    }
    /**
     * The transaction context: a wrapper over this class where all
     * `query`/`get`/`execute` calls are routed through the given
     * connection. `transaction()` from inside is not allowed
     * (`DB_TX_LOCKED`); every other member passes through unchanged
     * (functions stay bound to the class, never to the connection).
     */
    bind(conn) {
        const handler = {
            get: (target, prop, receiver) => {
                if (prop === 'query')
                    return (sql, params) => target._query(sql, params, conn);
                if (prop === 'get') {
                    return async (sql, params) => {
                        const rows = await target._query(sql, params, conn);
                        return rows[0];
                    };
                }
                if (prop === 'execute')
                    return (sql, params) => target._execute(sql, params, conn);
                if (prop === 'transaction')
                    return () => { throw ErrorManager_1.default.make('DB_TX_LOCKED', { boot: target.id }); };
                const value = Reflect.get(target, prop, receiver);
                return typeof value === 'function' ? value.bind(target) : value;
            }
        };
        return new Proxy(this, handler);
    }
}
exports.default = BootDatabase;
