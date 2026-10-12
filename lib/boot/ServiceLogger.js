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
 * ServiceLogger — collects device channel events into a journal-db table
 * (`device_log`) so the history of device activity can be queried after the
 * fact.
 *
 * Enabled by default (id `ServiceLogger` in `MainProcess.DEFAULT_BOOTLIST`):
 * it captures every device channel event — `device.terminal`, `device.notify`,
 * `device.event`, `device.alert`, `device.error`, `device.terminate` — i.e.
 * all of them except `device.render`.
 *
 * Capture is switchable: the `enabled` option sets the at-start state
 * (default `true`), and the live `enable()` / `disable()` methods toggle it
 * on a running service — `disable()` only stops the writes (the journal and
 * the subscriptions stay, so `enable()` is instant).
 *
 * The store is rooted at `<path>/<container.id>`, the same layout as
 * `JournalDbMetrics`: an external service can open the same dir with
 * vrack2-journal-db and read the `device_log` table directly (or use the
 * `DB` / `table` / `query()` / `tail()` / `count()` methods of this class).
 *
 * The store is opened with `lock: 'off'` — each boot class owns exactly one
 * table and writes are serialized by the process event loop, so the journal-db
 * inter-process `.lock` file is not needed (and would only false-positive
 * across two in-process Store instances over the same dir).
 *
 * Row: `{ ts, device, event, data, trace }`
 *
 * Fail-soft: an append failure reports `SLG_APPEND_FAILED` on `system.error`
 * and logging continues.
 *
 * @see BootClass
 * @see JournalDbMetrics
 * @see https://github.com/VRack2/vrack2-journal-db
 */
class ServiceLogger extends BootClass_1.default {
    constructor() {
        super(...arguments);
        /**
         * The journal-db store (owns the `device_log` table). Created by
         * `enable()` (or in `onStart()` when the `enabled` option is `true`).
         */
        this.DB = null;
        /**
         * The `device_log` table. Created by `enable()`.
         */
        this.table = null;
        /**
         * Live capture state: `true` — channel events are appended to the table.
         */
        this.enabled = false;
    }
    checkOptions() {
        return {
            enabled: Rule_1.default.boolean().required().default(true)
                .description('Capture enabled at start (live toggle: enable()/disable())'),
            path: Rule_1.default.string().required().default('./journals')
                .description('Base dir for the journal-db store; the store is rooted at <path>/<container.id>'),
            channels: Rule_1.default.array().required().default(ServiceLogger.DEFAULT_CHANNELS)
                .content(Rule_1.default.string().required().description('Device channel'))
                .description('Device channels to capture (default: all except render)'),
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
     * and subscribes to the channels if not done yet, then turns the capture
     * flag on.
     */
    enable() {
        if (!this.DB) {
            const baseDir = path_1.default.resolve(this.options.path, this.Container.id);
            this.DB = new vrack2_journal_db_1.Store(baseDir, { lock: 'off' });
            this.DB.init();
            this.table = this.DB.create((0, vrack2_journal_db_1.defineLogTable)({
                name: 'device_log',
                columns: { ts: 'delta', device: 'dictionary', event: 'dictionary', data: 'auto', trace: 'catchall' },
            }));
            for (const channel of this.options.channels) {
                this.Container.on('device.' + channel, this.onChannelEvent.bind(this, channel));
            }
        }
        this.enabled = true;
    }
    /**
     * Disable capture: channel events stop being appended, but the journal
     * and the subscriptions stay — `enable()` resumes instantly.
     */
    disable() {
        this.enabled = false;
    }
    /**
     * The `device_log` table, or `SLG_NOT_STARTED` if capture has never been
     * enabled (or the boot class was already destroyed).
     */
    ensureTable() {
        if (!this.table)
            throw ErrorManager_1.default.make('SLG_NOT_STARTED');
        return this.table;
    }
    /**
     * Query the logged events for a period (same period format as
     * `JournalDbMetrics.read()`).
     *
     * @param period Period in the form 'now-6h:now'
     * @returns `{ relevant, start, end, rows }` — `rows` are old → new
     * @throws SLG_NOT_STARTED if capture has never been enabled
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
     * The last `count` logged events (old → new).
     *
     * @param count Number of events (default 100)
     * @throws SLG_NOT_STARTED if capture has never been enabled
     */
    tail(count = 100) {
        return this.ensureTable().allRows().slice(-count);
    }
    /**
     * Total number of logged events.
     *
     * @throws SLG_NOT_STARTED if capture has never been enabled
     */
    count() {
        return this.ensureTable().allRows().length;
    }
    /**
     * Appends a channel event to the `device_log` table while capture is
     * enabled (fail-soft: a failure reports `SLG_APPEND_FAILED` on
     * `system.error`, logging continues).
     *
     * @param channel Device channel
     * @param nEvent `{ device, data, trace }`
     */
    onChannelEvent(channel, nEvent) {
        if (!this.enabled)
            return;
        try {
            this.table.append({ ts: Date.now(), device: nEvent.device, event: channel, data: nEvent.data, trace: nEvent.trace });
        }
        catch (e) {
            this.error(ErrorManager_1.default.make('SLG_APPEND_FAILED', { channel, device: nEvent.device }).add(ErrorManager_1.default.convert(e)));
        }
    }
}
/**
 * Channels captured by default — every device channel except `render`.
 */
ServiceLogger.DEFAULT_CHANNELS = ['terminal', 'notify', 'event', 'alert', 'error', 'terminate'];
exports.default = ServiceLogger;
ErrorManager_1.default.registerMany('ServiceLogger', [
    {
        short: 'SLG_NOT_STARTED',
        description: 'ServiceLogger public method (query/tail/count) called before capture has been enabled (the enabled option is false and enable() was never called), or after the boot class was destroyed',
    },
    {
        short: 'SLG_APPEND_FAILED',
        description: 'Failed to append a device event to the device_log table (logging continues)',
        rules: {
            channel: Rule_1.default.string().required().description('Device channel'),
            device: Rule_1.default.string().required().description('Device name'),
        }
    },
]);
