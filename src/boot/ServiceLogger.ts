/*
 * Copyright © 2026 Boris Bobylev. All rights reserved.
 * Licensed under the Apache License, Version 2.0
 */

import path from 'path';
import { Store, Table, defineLogTable } from 'vrack2-journal-db';
import type { Row } from 'vrack2-journal-db';
import IDeviceEvent from '../service/IDeviceEvent';
import BootClass from './BootClass';
import Rule from '../validator/Rule';
import BasicType from '../validator/types/BasicType';
import ErrorManager from '../errors/ErrorManager';

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
 * The store is rooted at `<path>/<container.id>`, the same layout as
 * `JournalDbMetrics`: an external service can open the same dir with
 * vrack2-journal-db and read the `device_log` table directly (or use the
 * `DB` / `table` / `query()` / `tail()` / `count()` methods of this class).
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
export default class ServiceLogger extends BootClass {
    /**
     * The journal-db store (owns the `device_log` table). Created in `onStart()`.
     */
    DB!: Store

    /**
     * The `device_log` table. Created in `onStart()`.
     */
    table!: Table

    /**
     * Channels captured by default — every device channel except `render`.
     */
    static readonly DEFAULT_CHANNELS: string[] = ['terminal', 'notify', 'event', 'alert', 'error', 'terminate']

    checkOptions(): { [key: string]: BasicType; } {
        return {
            path: Rule.string().required().default('./journals')
                .description('Base dir for the journal-db store; the store is rooted at <path>/<container.id>'),
            channels: Rule.array().required().default(ServiceLogger.DEFAULT_CHANNELS)
                .content(Rule.string().required().description('Device channel'))
                .description('Device channels to capture (default: all except render)'),
        }
    }

    onStart(): void {
        const baseDir = path.resolve(this.options.path, this.Container.id)
        this.DB = new Store(baseDir)
        this.DB.init()
        this.table = this.DB.create(defineLogTable({
            name: 'device_log',
            columns: { ts: 'delta', device: 'dictionary', event: 'dictionary', data: 'auto', trace: 'catchall' },
        }))
        for (const channel of this.options.channels) {
            this.Container.on('device.' + channel, this.onChannelEvent.bind(this, channel))
        }
    }

    async onDestroy(): Promise<void> {
        if (this.DB) this.DB.closeAll()
    }

    /**
     * Query the logged events for a period (same period format as
     * `JournalDbMetrics.read()`).
     *
     * @param period Period in the form 'now-6h:now'
     * @returns `{ relevant, start, end, rows }` — `rows` are old → new
     */
    query(period: string) {
        const [start, end] = period.split(':')
        const rows = this.table.query(start, end)
        return {
            relevant: rows.length > 0,
            start,
            end,
            rows,
        }
    }

    /**
     * The last `count` logged events (old → new).
     *
     * @param count Number of events (default 100)
     */
    tail(count = 100): Row[] {
        return this.table.allRows().slice(-count)
    }

    /**
     * Total number of logged events.
     */
    count(): number {
        return this.table.allRows().length
    }

    /**
     * Appends a channel event to the `device_log` table (fail-soft: a failure
     * reports `SLG_APPEND_FAILED` on `system.error`, logging continues).
     *
     * @param channel Device channel
     * @param nEvent `{ device, data, trace }`
     */
    protected onChannelEvent(channel: string, nEvent: IDeviceEvent) {
        try {
            this.table.append({ ts: Date.now(), device: nEvent.device, event: channel, data: nEvent.data, trace: nEvent.trace })
        } catch (e) {
            this.error(ErrorManager.make('SLG_APPEND_FAILED', { channel, device: nEvent.device }).add(ErrorManager.convert(e as Error)))
        }
    }
}

ErrorManager.registerMany('ServiceLogger', [
    {
        short: 'SLG_APPEND_FAILED',
        description: 'Failed to append a device event to the device_log table (logging continues)',
        rules: {
            channel: Rule.string().required().description('Device channel'),
            device: Rule.string().required().description('Device name'),
        }
    },
])
