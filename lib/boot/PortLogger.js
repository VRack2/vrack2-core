"use strict";
/*
 * Copyright © 2026 Boris Bobylev. All rights reserved.
 * Licensed under the Apache License, Version 2.0
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = __importDefault(require("path"));
const vrack2_journal_db_1 = require("vrack2-journal-db");
const BootClass_1 = __importDefault(require("./BootClass"));
const Rule_1 = __importDefault(require("../validator/Rule"));
const ErrorManager_1 = __importDefault(require("../errors/ErrorManager"));
/**
 * PortLogger — collects output-port traffic into a journal-db table
 * (`port_log`) so the data flows through the service ports can be queried
 * after the fact.
 *
 * Enabled by default (id `PortLogger` in `MainProcess.DEFAULT_BOOTLIST`):
 * it captures the `device.port` event — emitted by every **output** port on
 * each `push` (`{ device, data: portName, trace: data }`), unless the port
 * was marked `noCapture()`.
 *
 * Capture is switchable: the `enabled` option sets the at-start state
 * (default `true`), and the live `enable()` / `disable()` methods toggle it
 * on a running service — `disable()` only stops the writes (the journal and
 * the subscription stay, so `enable()` is instant).
 *
 * The store is rooted at `<path>/<container.id>` — the **same dir** as
 * `ServiceLogger` and `JournalDbMetrics` (each boot class owns its own table
 * in one shared store dir). An external
 * service can open the same dir with vrack2-journal-db and read the
 * `port_log` table directly (or use the `DB` / `table` / `query()` / `tail()`
 * / `count()` methods of this class).
 *
 * The store is opened with `lock: 'off'` — each boot class owns exactly one
 * table and writes are serialized by the process event loop, so the journal-db
 * inter-process `.lock` file is not needed (and would only false-positive
 * across two in-process Store instances over the same dir).
 *
 * Row: `{ ts, device, port, data }` — `port` is the output port name,
 * `data` is the pushed payload.
 *
 * Fail-soft: an append failure reports `PLG_APPEND_FAILED` on `system.error`
 * and logging continues.
 *
 * @see BootClass
 * @see ServiceLogger
 * @see https://github.com/VRack2/vrack2-journal-db
 */
class PortLogger extends BootClass_1.default {
    constructor() {
        super(...arguments);
        /**
         * The journal-db store (owns the `port_log` table). Created by
         * `enable()` (or in `onStart()` when the `enabled` option is `true`).
         */
        this.DB = null;
        /**
         * The `port_log` table. Created by `enable()`.
         */
        this.table = null;
        /**
         * Live capture state: `true` — `device.port` events are appended to the table.
         */
        this.enabled = false;
    }
    checkOptions() {
        return {
            enabled: Rule_1.default.boolean().required().default(true)
                .description('Capture enabled at start (live toggle: enable()/disable())'),
            path: Rule_1.default.string().required().default('./journals')
                .description('Base dir for the journal-db store; the store is rooted at <path>/<container.id> (shared with ServiceLogger/JournalDbMetrics)'),
        };
    }
    onStart() {
        if (this.options.enabled)
            this.enable();
    }
    async onDestroy() {
        if (this.DB) {
            this.DB.closeAll();
            this.DB = null;
            this.table = null;
        }
        this.enabled = false;
    }
    /**
     * Enable capture (idempotent, safe to call repeatedly): opens the journal
     * and subscribes to `device.port` if not done yet, then turns the capture
     * flag on.
     */
    enable() {
        if (!this.DB) {
            const baseDir = path_1.default.resolve(this.options.path, this.Container.id);
            this.DB = new vrack2_journal_db_1.Store(baseDir, { lock: 'off' });
            this.DB.init();
            this.table = this.DB.create((0, vrack2_journal_db_1.defineLogTable)({
                name: 'port_log',
                columns: { ts: 'delta', device: 'dictionary', port: 'dictionary', data: 'auto' },
            }));
            this.Container.on('device.port', this.onPortEvent.bind(this));
        }
        this.enabled = true;
    }
    /**
     * Disable capture: `device.port` events stop being appended, but the
     * journal and the subscription stay — `enable()` resumes instantly.
     */
    disable() {
        this.enabled = false;
    }
    /**
     * The `port_log` table, or `PLG_NOT_STARTED` if capture has never been
     * enabled (or the boot class was already destroyed).
     */
    ensureTable() {
        if (!this.table)
            throw ErrorManager_1.default.make('PLG_NOT_STARTED');
        return this.table;
    }
    /**
     * Query the logged port traffic for a period (same period format as
     * `JournalDbMetrics.read()`).
     *
     * @param period Period in the form 'now-6h:now'
     * @returns `{ relevant, start, end, rows }` — `rows` are old → new
     * @throws PLG_NOT_STARTED if capture has never been enabled
     */
    query(period) {
        const [start, end] = period.split(':');
        const rows = this.ensureTable().query(start, end);
        return {
            relevant: rows.length > 0,
            start,
            end,
            rows,
        };
    }
    /**
     * The last `count` logged port pushes (old → new).
     *
     * @param count Number of rows (default 100)
     * @throws PLG_NOT_STARTED if capture has never been enabled
     */
    tail(count = 100) {
        return this.ensureTable().allRows().slice(-count);
    }
    /**
     * Total number of logged port pushes.
     *
     * @throws PLG_NOT_STARTED if capture has never been enabled
     */
    count() {
        return this.ensureTable().allRows().length;
    }
    /**
     * Appends a `device.port` event to the `port_log` table while capture is
     * enabled (fail-soft: a failure reports `PLG_APPEND_FAILED` on
     * `system.error`, logging continues).
     *
     * @param nEvent `{ device, data: portName, trace: data }`
     */
    onPortEvent(nEvent) {
        if (!this.enabled)
            return;
        try {
            this.table.append({ ts: Date.now(), device: nEvent.device, port: nEvent.data, data: nEvent.trace });
        }
        catch (e) {
            this.error(ErrorManager_1.default.make('PLG_APPEND_FAILED', { device: nEvent.device, port: nEvent.data }).add(ErrorManager_1.default.convert(e)));
        }
    }
}
exports.default = PortLogger;
ErrorManager_1.default.registerMany('PortLogger', [
    {
        short: 'PLG_NOT_STARTED',
        description: 'PortLogger public method (query/tail/count) called before capture has been enabled (the enabled option is false and enable() was never called), or after the boot class was destroyed',
    },
    {
        short: 'PLG_APPEND_FAILED',
        description: 'Failed to append a device.port event to the port_log table (logging continues)',
        rules: {
            device: Rule_1.default.string().required().description('Device name'),
            port: Rule_1.default.string().required().description('Output port name'),
        }
    },
]);
