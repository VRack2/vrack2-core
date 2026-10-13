/*
 * Copyright © 2026 Boris Bobylev. All rights reserved.
 * Licensed under the Apache License, Version 2.0
 */

import path from 'path';
import { Interval, Store, defineLogTable } from 'vrack2-journal-db';
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
        this.DB = new Store(baseDir, { lock: 'off' })
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
     * Read the dense metric series for a period — the `vrack-db`
     * `SingleDB.read` contract: one point per `precision` bucket, old → new,
     * `value: null` where the bucket has no data.
     *
     * @param device Device ID
     * @param name Registered metric name
     * @param period Period in the form 'now-6h:now'
     * @param precision Bucket size: an interval string ('15m', '5s', '1h') or a point count (10, 200, 1500); a numeric string ('600') is also a point count
     * @param func Per-bucket aggregation: 'last' (default) | 'first' | 'max' | 'min' | 'avg' | 'sum'
     * @returns `{ relevant, start, end, rows }` — `start`/`end` are the
     * absolute period bounds (ms, aligned to the grid), `relevant` — the
     * metric is registered, `rows` are `{ time, value }` (`value: null` where empty)
     * @throws RangeError if the period/precision is malformed, start > end, or func is unknown
     */
    read(device: string, name: string, period: string, precision: string | number, func: string = 'last') {
        this.checkFunc(func)
        const table = this.getMetric(device, name)
        const [start, end] = Interval.period(period)
        const step = this.parsePrecision(start, end, precision)
        const grid = Interval.getIntervals(start, end, step)
        const s = grid[0]
        const e = grid[grid.length - 1]

        const buckets: (number[] | null)[] = new Array(grid.length).fill(null)
        if (table) {
            // query the exact period: points in the unaligned head/tail slivers
            // (outside the rounded grid) clamp into the first/last bucket
            for (const row of table.query(start, end)) {
                const t = row.ts
                const v = row.value
                if (typeof t !== 'number') continue
                if (typeof v !== 'number' || !Number.isFinite(v)) continue
                const i = Math.min(grid.length - 1, Math.max(0, Math.floor((t - s) / step)))
                ;(buckets[i] ??= []).push(v)
            }
        }

        return {
            relevant: table !== undefined,
            start: s,
            end: e,
            rows: grid.map((time, i) => ({ time, value: buckets[i] ? this.aggregateValues(buckets[i] as number[], func) : null })),
        }
    }

    /**
     * Resolve `precision` to a bucket size (ms) — as in `vrack-db`
     * `SingleDB.parsePrecission`: an interval string ('15m' → 900 000) or a
     * point count (the bucket that fits exactly `count` points in [start, end]).
     * A numeric string ('600') is treated as a point count too — WS/API
     * callers often send numbers as strings.
     *
     * @param start Period start (ms)
     * @param end Period end (ms)
     * @param precision An interval string or a point count (number or numeric string)
     * @throws RangeError if the interval is malformed (see `Interval.parseInterval`)
     */
    protected parsePrecision(start: number, end: number, precision: string | number): number {
        if (typeof precision === 'number') return Interval.getIntervalOfFixedCount(start, end, precision)
        const s = String(precision).trim()
        if (/^\d+$/.test(s)) return Interval.getIntervalOfFixedCount(start, end, parseInt(s, 10))
        return Interval.parseInterval(s)
    }

    /**
     * The allowed per-bucket aggregation functions (the same set as `vrack-db`).
     */
    static readonly AGGREGATE_FUNCTIONS: string[] = ['last', 'first', 'max', 'min', 'avg', 'sum']

    /**
     * Rejects an unknown aggregation function (checked before the read, so it
     * fails fast even when the period has no data).
     *
     * @param func The requested aggregation function
     * @throws RangeError for an unknown func
     */
    protected checkFunc(func: string): void {
        if (!JournalDbMetrics.AGGREGATE_FUNCTIONS.includes(func)) {
            throw new RangeError(`JournalDbMetrics: unknown aggregate function '${func}' (available: ${JournalDbMetrics.AGGREGATE_FUNCTIONS.join(', ')})`)
        }
    }

    /**
     * Aggregate one bucket's values — the same semantics as `vrack-db`
     * `MetricResult.aggregate`: `last`/`first` — the last/first value,
     * `max`/`min` — the extremes, `avg` — the mean, `sum` — the sum.
     *
     * @param values The bucket's values (non-empty)
     * @param func 'last' | 'first' | 'max' | 'min' | 'avg' | 'sum'
     * @throws RangeError for an unknown func
     */
    protected aggregateValues(values: number[], func: string): number {
        switch (func) {
            case 'last': return values[values.length - 1]
            case 'first': return values[0]
            case 'max': {
                let m = values[0]
                for (const v of values) if (v > m) m = v
                return m
            }
            case 'min': {
                let m = values[0]
                for (const v of values) if (v < m) m = v
                return m
            }
            case 'avg': {
                let sum = 0
                for (const v of values) sum += v
                return sum / values.length
            }
            case 'sum': {
                let sum = 0
                for (const v of values) sum += v
                return sum
            }
            default: throw new RangeError(`JournalDbMetrics: unknown aggregate function '${func}' (available: last, first, max, min, avg, sum)`)
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
        const [start, end] = period.split(':')
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
        const [start, end] = period.split(':')
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
        this.DB.create(defineLogTable({
            name: metricPath,
            columns: { ts: 'delta', value: 'auto' },
            ...(metric.retentions ? { retention: metric.retentions, agg: { value: modify } } : {}),
        }))
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
