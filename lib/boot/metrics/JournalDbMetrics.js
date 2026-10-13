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
const Rule_1 = __importDefault(require("../../validator/Rule"));
const BootDeviceMetrics_1 = __importDefault(require("./BootDeviceMetrics"));
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
 * @see BootDeviceMetrics
 */
class JournalDbMetrics extends BootDeviceMetrics_1.default {
    constructor() {
        super(...arguments);
        /**
         * Per-metric aggregation function (from the metric description), default `avg`.
         */
        this.modifies = {};
    }
    checkOptions() {
        return {
            path: Rule_1.default.string().required().default('./journals')
                .description('Base dir for the journal-db store; the store is rooted at <path>/<container.id>'),
        };
    }
    onEngineStart() {
        const baseDir = path_1.default.resolve(this.options.path, this.Container.id);
        this.DB = new vrack2_journal_db_1.Store(baseDir, { lock: 'off' });
        this.DB.init();
    }
    async onDestroy() {
        if (this.DB)
            this.DB.closeAll();
    }
    /**
     * Checks if the metric exists
     *
     * @param device Device ID
     * @param name Registered metric name
     */
    has(device, name) {
        return this.DB.openTables.has(this.getMetricPath(device, name));
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
     * absolute period bounds (seconds, aligned to the grid), `relevant` — the
     * metric is registered, `rows` are `{ time, value }` with `time` in seconds
     * (`value: null` where empty). Matches the `vrack-db` (seconds) unit.
     * @throws RangeError if the period/precision is malformed, start > end, or func is unknown
     */
    read(device, name, period, precision, func = 'last') {
        this.checkFunc(func);
        const table = this.getMetric(device, name);
        const [start, end] = vrack2_journal_db_1.Interval.period(period);
        const step = this.parsePrecision(start, end, precision);
        const grid = vrack2_journal_db_1.Interval.getIntervals(start, end, step);
        const s = grid[0];
        const e = grid[grid.length - 1];
        const buckets = new Array(grid.length).fill(null);
        if (table) {
            // query the exact period: points in the unaligned head/tail slivers
            // (outside the rounded grid) clamp into the first/last bucket
            for (const row of table.query(start, end)) {
                const t = row.ts;
                const v = row.value;
                if (typeof t !== 'number')
                    continue;
                if (typeof v !== 'number' || !Number.isFinite(v))
                    continue;
                const i = Math.min(grid.length - 1, Math.max(0, Math.floor((t - s) / step)));
                (buckets[i] ??= []).push(v);
            }
        }
        return {
            relevant: table !== undefined,
            start: s / 1000,
            end: e / 1000,
            rows: grid.map((time, i) => ({ time: time / 1000, value: buckets[i] ? this.aggregateValues(buckets[i], func) : null })),
        };
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
    parsePrecision(start, end, precision) {
        if (typeof precision === 'number')
            return vrack2_journal_db_1.Interval.getIntervalOfFixedCount(start, end, precision);
        const s = String(precision).trim();
        if (/^\d+$/.test(s))
            return vrack2_journal_db_1.Interval.getIntervalOfFixedCount(start, end, parseInt(s, 10));
        return vrack2_journal_db_1.Interval.parseInterval(s);
    }
    /**
     * Rejects an unknown aggregation function (checked before the read, so it
     * fails fast even when the period has no data).
     *
     * @param func The requested aggregation function
     * @throws RangeError for an unknown func
     */
    checkFunc(func) {
        if (!JournalDbMetrics.AGGREGATE_FUNCTIONS.includes(func)) {
            throw new RangeError(`JournalDbMetrics: unknown aggregate function '${func}' (available: ${JournalDbMetrics.AGGREGATE_FUNCTIONS.join(', ')})`);
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
    aggregateValues(values, func) {
        switch (func) {
            case 'last': return values[values.length - 1];
            case 'first': return values[0];
            case 'max': {
                let m = values[0];
                for (const v of values)
                    if (v > m)
                        m = v;
                return m;
            }
            case 'min': {
                let m = values[0];
                for (const v of values)
                    if (v < m)
                        m = v;
                return m;
            }
            case 'avg': {
                let sum = 0;
                for (const v of values)
                    sum += v;
                return sum / values.length;
            }
            case 'sum': {
                let sum = 0;
                for (const v of values)
                    sum += v;
                return sum;
            }
            default: throw new RangeError(`JournalDbMetrics: unknown aggregate function '${func}' (available: last, first, max, min, avg, sum)`);
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
    aggregate(device, name, period) {
        const table = this.getMetric(device, name);
        if (!table)
            return {};
        const [start, end] = period.split(':');
        return table.aggregate(start, end, [{ field: 'value', fn: this.getModify(device, name) }]);
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
    percentile(device, name, period, levels = [0.5, 0.9, 0.95, 0.99]) {
        const table = this.getMetric(device, name);
        if (!table)
            return {};
        const [start, end] = period.split(':');
        return table.percentile(start, end, levels);
    }
    /**
     * Open the metric table (idempotent — re-open returns the existing table).
     *
     * @param metricPath Metric path
     * @param metric Metric settings
     */
    registerMetric(metricPath, metric) {
        const modify = this.toAggFn(metric.modify);
        this.modifies[metricPath] = modify;
        this.DB.create((0, vrack2_journal_db_1.defineLogTable)({
            name: metricPath,
            columns: { ts: 'delta', value: 'auto' },
            ...(metric.retentions ? { retention: metric.retentions, agg: { value: modify } } : {}),
        }));
    }
    /**
     * Write a metric value (raw append at the current time).
     *
     * @param nEvent `{ device, data, trace: { value } }`
     */
    deviceMetric(nEvent) {
        const metricPath = this.getMetricPath(nEvent.device, nEvent.data);
        const table = this.DB.openTables.get(metricPath);
        if (!table)
            return;
        table.append({ ts: Date.now(), value: nEvent.trace.value });
    }
    /**
     * Resolve the open table for a device metric (null if not registered).
     */
    getMetric(device, name) {
        return this.DB.openTables.get(this.getMetricPath(device, name));
    }
    /**
     * The metric's aggregation function (from its description), default `avg`.
     */
    getModify(device, name) {
        return this.modifies[this.getMetricPath(device, name)] ?? 'avg';
    }
    /**
     * Coerce a declared `modify` to a valid journal-db `AggFn`
     * (`min` | `max` | `sum` | `avg` | `count`), defaulting to `avg`.
     */
    toAggFn(modify) {
        const allowed = ['min', 'max', 'sum', 'avg', 'count'];
        return allowed.includes(modify) ? modify : 'avg';
    }
}
/**
 * The allowed per-bucket aggregation functions (the same set as `vrack-db`).
 */
JournalDbMetrics.AGGREGATE_FUNCTIONS = ['last', 'first', 'max', 'min', 'avg', 'sum'];
exports.default = JournalDbMetrics;
