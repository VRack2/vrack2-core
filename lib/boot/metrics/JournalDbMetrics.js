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
const ErrorManager_1 = __importDefault(require("../../errors/ErrorManager"));
const Rule_1 = __importDefault(require("../../validator/Rule"));
const BootDeviceMetrics_1 = __importDefault(require("./BootDeviceMetrics"));
/**
 * Default metrics engine, backed by vrack2-journal-db — a disk-backed,
 * append-only columnar journal.
 *
 * One table for the whole service: `metrics { ts, dev, met, value }` inside
 * a single `Store` rooted at `<path>/<container.id>` (the container id is
 * unique per vrack instance). Every device metric is a row, not a table —
 * thousands of metrics cost one journal per retention tier, not per metric.
 * The table is clustered by `['dev','met']` (dimension-local segments, whole
 * segments skipped by the `.meta` dims summaries), so a read of one metric
 * stays sublinear. Retention is service-level: a Graphite-style
 * `'res:ttl[,...]'` string — one tier is pure TTL (rows kept raw, auto-purged),
 * two or more tiers also roll up (`value: 'avg'`).
 *
 * Metric declarations (`Metric.one()` / `Metric.group()`) are metadata only:
 * the engine records them in the base registry (`has()`/`read()` report them)
 * and creates no per-metric storage. A write of any name goes into the same
 * table, declared or not.
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
         * Background cluster-compaction watermark: closed segments up to this ts
         * have been (re)laid out by the dimension cluster key.
         */
        this.compactedTo = 0;
        /**
         * Background cluster-compaction timer (null when disabled).
         */
        this.compactTimer = null;
    }
    checkOptions() {
        return {
            path: Rule_1.default.string().required().default('./journals')
                .description('Base dir for the journal-db store; the store is rooted at <path>/<container.id>'),
            retention: Rule_1.default.string().required().default(JournalDbMetrics.DEFAULT_RETENTION)
                .description('Service-level retention, Graphite-style "res:ttl" list (one tier — pure TTL, no rollup; two or more — rollup of value by avg)'),
            clusterCompactInterval: Rule_1.default.number().required().default(600000)
                .description('Background cluster-compaction period, ms (0 — off; freshly written segments become dimension-clustered on each pass)'),
            maxReadPoints: Rule_1.default.number().integer().min(10).required().default(200000)
                .description('Max points/rows a single read()/percentile() call may materialize (grid buckets / scanned raw rows)'),
        };
    }
    onEngineStart() {
        const baseDir = path_1.default.resolve(this.options.path, this.Container.id);
        this.DB = new vrack2_journal_db_1.Store(baseDir, { lock: 'off' });
        this.DB.init();
        this.table = this.DB.create((0, vrack2_journal_db_1.defineLogTable)({
            name: 'metrics',
            desc: 'All device metrics of the service: one row per value (dev, met, value)',
            columns: { ts: 'delta', dev: 'auto', met: 'auto', value: 'auto' },
            retention: this.options.retention,
            agg: { value: 'avg' },
            dims: ['dev', 'met'],
            cluster: ['dev', 'met'],
        }));
        // Seed at 0 (not wall-clock): the first pass covers everything the
        // store already holds — segments closed before this run started
        // (previous-run tail) and segments written under a backward clock
        // correction. journal-db skips segments fully below the window, so
        // a wall-clock seed would leave them unclustered forever.
        this.compactedTo = 0;
        if (this.options.clusterCompactInterval > 0) {
            this.compactTimer = setInterval(() => this.runClusterCompact(), this.options.clusterCompactInterval);
            this.compactTimer.unref?.();
        }
    }
    async onDestroy() {
        if (this.compactTimer)
            clearInterval(this.compactTimer);
        if (this.DB)
            this.DB.closeAll();
    }
    /**
     * Cluster-compacts closed segments written since the last pass (window
     * between the watermark and now — already-clustered older segments are
     * outside the window and left untouched).
     */
    runClusterCompact() {
        if (!this.DB || !this.table)
            return;
        const to = Date.now();
        if (to <= this.compactedTo)
            return;
        try {
            this.table.clusterCompact(this.compactedTo, to);
            this.compactedTo = to;
        }
        catch (err) {
            // A throw inside the interval callback would be an
            // uncaughtException and kill the service — report it like every
            // other background failure and retry the same window next pass.
            this.error(err instanceof Error ? err : new Error(String(err)));
        }
    }
    /**
     * Checks if the metric exists — declared or written since the engine
     * started.
     *
     * @param device Device ID
     * @param name Metric name
     */
    has(device, name) {
        return this.isKnown(this.getMetricPath(device, name));
    }
    /**
     * Read the dense metric series for a period — the `vrack-db`
     * `SingleDB.read` contract: one point per `precision` bucket, old → new,
     * `value: null` where the bucket has no data.
     *
     * @param device Device ID
     * @param name Metric name
     * @param period Period in the form 'now-6h:now'
     * @param precision Bucket size: an interval string ('15m', '5s', '1h') or a point count (10, 200, 1500); a numeric string ('600') is also a point count
     * @param func Per-bucket aggregation: 'last' (default) | 'first' | 'max' | 'min' | 'avg' | 'sum'
     * @returns `{ relevant, start, end, rows }` — `start`/`end` are the
     * absolute period bounds (seconds, aligned to the grid), `relevant` — the
     * metric is known (declared or written), `rows` are `{ time, value }` with
     * `time` in seconds (`value: null` where empty). Matches the `vrack-db`
     * (seconds) unit.
      * @throws coded error (vError/vShort, from `vrack2-journal-db` `Interval`) if the period/precision is malformed or start > end; RangeError if func is unknown
     */
    read(device, name, period, precision, func = 'last') {
        this.checkFunc(func);
        const [start, end] = vrack2_journal_db_1.Interval.period(period);
        const step = this.parsePrecision(start, end, precision);
        const grid = vrack2_journal_db_1.Interval.getIntervals(start, end, step);
        const max = this.options.maxReadPoints;
        if (grid.length > max) {
            throw ErrorManager_1.default.make('JDM_POINTS_LIMIT', { points: grid.length, limit: max });
        }
        const s = grid[0];
        const e = grid[grid.length - 1];
        const buckets = new Array(grid.length).fill(null);
        // query the exact period: points in the unaligned head/tail slivers
        // (outside the rounded grid) clamp into the first/last bucket
        for (const row of this.metricRows(device, name, start, end)) {
            const t = row.ts;
            const v = row.value;
            if (typeof t !== 'number')
                continue;
            if (typeof v !== 'number' || !Number.isFinite(v))
                continue;
            const i = Math.min(grid.length - 1, Math.max(0, Math.floor((t - s) / step)));
            (buckets[i] ??= []).push(v);
        }
        return {
            relevant: this.isKnown(this.getMetricPath(device, name)),
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
      * @throws coded error (vError/vShort) if the interval is malformed (see `Interval.parseInterval`)
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
     * Aggregate the metric value over a period (avg — the single table has
     * no per-metric modify anymore).
     *
     * @param device Device ID
     * @param name Metric name
     * @param period Period in the form 'now-6h:now'
     * @returns `{ value_avg: number | null }`
     */
    aggregate(device, name, period) {
        const [start, end] = period.split(':');
        return this.table.aggregate(start, end, [{ field: 'value', fn: 'avg' }], this.metricWhere(device, name));
    }
    /**
     * Exact quantiles of the metric value over a period.
     *
     * @param device Device ID
     * @param name Metric name
     * @param period Period in the form 'now-6h:now'
     * @param levels A level (0..1) or array of levels, e.g. `[0.5, 0.95, 0.99]`
     * @returns `{ p50: number, p95: number, ... }`
     */
    percentile(device, name, period, levels = [0.5, 0.9, 0.95, 0.99]) {
        const lv = Array.isArray(levels) ? levels.slice() : [levels];
        for (const q of lv) {
            if (typeof q !== 'number' || !Number.isFinite(q) || q <= 0 || q >= 1) {
                throw new RangeError(`JournalDbMetrics: percentile level must be in (0, 1), got ${q}`);
            }
        }
        const [start, end] = period.split(':');
        const max = this.options.maxReadPoints;
        const vals = [];
        let scanned = 0;
        for (const row of this.metricRows(device, name, start, end, max + 1)) {
            scanned++;
            const v = row.value;
            if (typeof v === 'number' && Number.isFinite(v))
                vals.push(v);
        }
        if (scanned > max) {
            throw ErrorManager_1.default.make('JDM_POINTS_LIMIT', { points: scanned, limit: max });
        }
        vals.sort((a, b) => a - b);
        const out = {};
        for (const q of lv) {
            out[`p${Math.round(q * 100)}`] = vals.length === 0
                ? null
                : this.percentileOf(vals, q);
        }
        return out;
    }
    /**
     * Percentile by linear interpolation between ranks (same as
     * `vrack2-journal-db` `Percentile.of`).
     */
    percentileOf(sorted, q) {
        const pos = (sorted.length - 1) * q;
        const lo = Math.floor(pos);
        const hi = Math.ceil(pos);
        if (lo === hi)
            return sorted[lo];
        return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
    }
    /**
     * `device.metric.register` is a metadata registration in the base — no
     * per-metric storage exists in this engine.
     */
    deviceMetric(nEvent) {
        this.markSeen(this.getMetricPath(nEvent.device, nEvent.data));
        this.table.append({
            ts: Date.now(),
            dev: nEvent.device.toLowerCase(),
            met: String(nEvent.data).toLowerCase(),
            value: nEvent.trace.value,
        });
    }
    /**
     * The `where` selecting one device metric in the shared table.
     */
    metricWhere(device, name) {
        return [
            { field: 'dev', op: 'eq', value: device.toLowerCase() },
            { field: 'met', op: 'eq', value: String(name).toLowerCase() },
        ];
    }
    /**
     * Raw rows of one metric in a ts window (projection: ts + value).
     *
     * @param start Period start (ms or journal-db period string)
     * @param end Period end (ms or journal-db period string)
     * @param limit Optional max rows to scan
     */
    metricRows(device, name, start, end, limit) {
        return this.table.scan({
            start, end,
            where: this.metricWhere(device, name),
            select: ['ts', 'value'],
            ...(limit !== undefined ? { limit } : {}),
        });
    }
}
/**
 * Default service retention — the old per-metric Graphite default, now
 * one policy for the whole service (raw 5s for 10 min up to daily rows
 * for a year; a single `'res:ttl'` pair would be pure TTL).
 */
JournalDbMetrics.DEFAULT_RETENTION = '5s:10m, 1m:2h, 15m:1d, 1h:1w, 6h:1mon, 1d:1y';
/**
 * The allowed per-bucket aggregation functions (the same set as `vrack-db`).
 */
JournalDbMetrics.AGGREGATE_FUNCTIONS = ['last', 'first', 'max', 'min', 'avg', 'sum'];
exports.default = JournalDbMetrics;
ErrorManager_1.default.registerMany('JournalDbMetrics', [
    {
        short: 'JDM_POINTS_LIMIT',
        description: 'read()/percentile() window exceeds `maxReadPoints` (the call would materialize too many grid buckets / scanned rows) — narrow the period or coarsen the precision',
        rules: {
            points: Rule_1.default.number().required().description('Points/rows the call would materialize'),
            limit: Rule_1.default.number().required().description('Configured maxReadPoints'),
        }
    },
]);
