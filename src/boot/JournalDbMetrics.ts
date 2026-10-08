/*
 * Copyright © 2026 Boris Bobylev. All rights reserved.
 * Licensed under the Apache License, Version 2.0
 */

import path from 'path';
import { Store, Interval } from 'vrack2-journal-db';
import type { AggFn } from 'vrack2-journal-db';
import IDeviceEvent from '../service/IDeviceEvent';
import BootClass from './BootClass';
import IMetricSettings from '../metrics/IMetricSettings';
import Rule from '../validator/Rule';
import BasicType from '../validator/types/BasicType';

/**
 * Default metrics engine, backed by vrack2-journal-db — a disk-backed,
 * append-only columnar journal with a metric engine (retention tiers + rollup).
 *
 * One metric = one `Table` inside a shared `Store` (a catalog of journals under
 * a single data dir). The store is rooted at `<path>/<container.id>` so each
 * vrack instance keeps its metrics separate (the container id is unique per
 * instance).
 *
 * Uses the `device.metric` and `device.metric.register` events.
 *
 * @see Store
 * @see https://github.com/VRack2/vrack2-journal-db
 */
export default class JournalDbMetrics extends BootClass {
    /**
     * The journal-db store (one table per metric). Created in `onStart()`.
     */
    DB!: Store

    /**
     * Per-metric aggregation function (from the metric description), default `avg`.
     */
    protected modifies: Record<string, AggFn> = {}

    checkOptions(): { [key: string]: BasicType; } {
        return {
            path: Rule.string().required().default('./journals')
                .description('Base dir for the journal-db store; the store is rooted at <path>/<container.id>'),
        }
    }

    onStart(): void {
        const baseDir = path.resolve(this.options.path, this.Container.id)
        this.DB = new Store(baseDir)
        this.DB.init()

        this.Container.on('device.metric', this.deviceMetric.bind(this))
        this.Container.on('device.metric.register', this.deviceRegisterMetric.bind(this))
    }

    async onDestroy(): Promise<void> {
        if (this.DB) this.DB.closeAll()
    }

    /**
     * Checks if the metric exists
     *
     * @param device Device ID
     * @param name Registered metric name
     */
    has(device: string, name: string): boolean {
        return this.DB.openTables.has(this.getMetricPath(device, name))
    }

    /**
     * Read raw metric rows for a period. Each point is already at the
     * resolution of the retention tier that owns it (fine for recent data,
     * coarser for older data) — no manual downsampling.
     *
     * @param device Device ID
     * @param name Registered metric name
     * @param period Period in the form 'now-6h:now'
     * @returns `{ relevant, start, end, rows }` — `rows` are `{ ts, value }`, old → new
     */
    read(device: string, name: string, period: string) {
        const table = this.getMetric(device, name)
        const [start, end] = Interval.period(period)
        const rows = table ? table.query(start, end) : []
        return {
            relevant: rows.length > 0,
            start,
            end,
            rows,
        }
    }

    /**
     * Aggregate the metric value over a period using the metric's `modify`
     * function (default `avg`).
     *
     * @param device Device ID
     * @param name Registered metric name
     * @param period Period in the form 'now-6h:now'
     * @returns `{ [fn]: number | null }`
     */
    aggregate(device: string, name: string, period: string) {
        const table = this.getMetric(device, name)
        if (!table) return {}
        const [start, end] = Interval.period(period)
        return table.aggregate(start, end, [{ field: 'value', fn: this.getModify(device, name) }])
    }

    /**
     * Exact quantiles of the metric value over a period.
     *
     * @param device Device ID
     * @param name Registered metric name
     * @param period Period in the form 'now-6h:now'
     * @param levels A level (0..1) or array of levels, e.g. `[0.5, 0.95, 0.99]`
     * @returns `{ p50: number, p95: number, ... }`
     */
    percentile(device: string, name: string, period: string, levels: number | number[] = [0.5, 0.9, 0.95, 0.99]) {
        const table = this.getMetric(device, name)
        if (!table) return {}
        const [start, end] = Interval.period(period)
        return table.percentile(start, end, levels)
    }

    /**
     * Registers the device metric — opens its table with the declared
     * retention and aggregation.
     *
     * When a device is initialized the container passes the list of its metrics
     * to the `device.metric.register` event; each one becomes a table here.
     *
     * @param nEvent `{ device, data, trace: IMetricSettings }`
     * @see IMetricSettings
     */
    protected deviceRegisterMetric(nEvent: IDeviceEvent) {
        this.registerMetric(this.getMetricPath(nEvent.device, nEvent.data), nEvent.trace)
    }

    /**
     * Open the metric table (idempotent — re-open returns the existing table).
     *
     * @param metricPath Metric path
     * @param metric Metric settings
     */
    protected registerMetric(metricPath: string, metric: IMetricSettings) {
        const modify = this.toAggFn(metric.modify)
        this.modifies[metricPath] = modify
        this.DB.openTable(metricPath, {
            retention: metric.retentions,
            agg: { value: modify },
        })
    }

    /**
     * Write a metric value (raw append at the current time).
     *
     * @param nEvent `{ device, data, trace: { value } }`
     */
    protected deviceMetric(nEvent: IDeviceEvent) {
        const metricPath = this.getMetricPath(nEvent.device, nEvent.data)
        const table = this.DB.openTables.get(metricPath)
        if (!table) return
        table.append({ ts: Date.now(), value: nEvent.trace.value })
    }

    /**
     * Resolve the open table for a device metric (null if not registered).
     */
    protected getMetric(device: string, name: string) {
        return this.DB.openTables.get(this.getMetricPath(device, name))
    }

    /**
     * The metric's aggregation function (from its description), default `avg`.
     */
    protected getModify(device: string, name: string): AggFn {
        return this.modifies[this.getMetricPath(device, name)] ?? 'avg'
    }

    /**
     * Coerce a declared `modify` to a valid journal-db `AggFn`
     * (`min` | `max` | `sum` | `avg` | `count`), defaulting to `avg`.
     */
    protected toAggFn(modify: string | undefined): AggFn {
        const allowed: readonly AggFn[] = ['min', 'max', 'sum', 'avg', 'count']
        return allowed.includes(modify as AggFn) ? (modify as AggFn) : 'avg'
    }

    /**
     * Metric path
     *
     * @param device Device ID
     * @param name Metric name
     */
    protected getMetricPath(device: string, name: string) {
        return (device + '.' + name).toLowerCase()
    }
}
