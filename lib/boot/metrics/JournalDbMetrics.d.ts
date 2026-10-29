import { Store } from 'vrack2-journal-db';
import type { ScanOptions, Table } from 'vrack2-journal-db';
import IDeviceEvent from '../../service/IDeviceEvent';
import BasicType from '../../validator/types/BasicType';
import BootDeviceMetrics from './BootDeviceMetrics';
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
export default class JournalDbMetrics extends BootDeviceMetrics {
    /**
     * The journal-db store (holds the single `metrics` table). Created in
     * {@link onEngineStart}.
     */
    DB: Store;
    /**
     * The single metrics table. Created in {@link onEngineStart}.
     */
    table: Table;
    /**
     * Default service retention — the old per-metric Graphite default, now
     * one policy for the whole service (raw 5s for 10 min up to daily rows
     * for a year; a single `'res:ttl'` pair would be pure TTL).
     */
    static readonly DEFAULT_RETENTION = "5s:10m, 1m:2h, 15m:1d, 1h:1w, 6h:1mon, 1d:1y";
    /**
     * Background cluster-compaction watermark: closed segments up to this ts
     * have been (re)laid out by the dimension cluster key.
     */
    protected compactedTo: number;
    /**
     * Background cluster-compaction timer (null when disabled).
     */
    protected compactTimer: ReturnType<typeof setInterval> | null;
    checkOptions(): {
        [key: string]: BasicType;
    };
    protected onEngineStart(): void;
    onDestroy(): Promise<void>;
    /**
     * Cluster-compacts closed segments written since the last pass (window
     * between the watermark and now — already-clustered older segments are
     * outside the window and left untouched).
     */
    protected runClusterCompact(): void;
    /**
     * Checks if the metric exists — declared or written since the engine
     * started.
     *
     * @param device Device ID
     * @param name Metric name
     */
    has(device: string, name: string): boolean;
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
    read(device: string, name: string, period: string, precision: string | number, func?: string): {
        relevant: boolean;
        start: number;
        end: number;
        rows: {
            time: number;
            value: number | null;
        }[];
    };
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
    protected parsePrecision(start: number, end: number, precision: string | number): number;
    /**
     * The allowed per-bucket aggregation functions (the same set as `vrack-db`).
     */
    static readonly AGGREGATE_FUNCTIONS: string[];
    /**
     * Rejects an unknown aggregation function (checked before the read, so it
     * fails fast even when the period has no data).
     *
     * @param func The requested aggregation function
     * @throws RangeError for an unknown func
     */
    protected checkFunc(func: string): void;
    /**
     * Aggregate one bucket's values — the same semantics as `vrack-db`
     * `MetricResult.aggregate`: `last`/`first` — the last/first value,
     * `max`/`min` — the extremes, `avg` — the mean, `sum` — the sum.
     *
     * @param values The bucket's values (non-empty)
     * @param func 'last' | 'first' | 'max' | 'min' | 'avg' | 'sum'
     * @throws RangeError for an unknown func
     */
    protected aggregateValues(values: number[], func: string): number;
    /**
     * Aggregate the metric value over a period (avg — the single table has
     * no per-metric modify anymore).
     *
     * @param device Device ID
     * @param name Metric name
     * @param period Period in the form 'now-6h:now'
     * @returns `{ value_avg: number | null }`
     */
    aggregate(device: string, name: string, period: string): Record<string, number | null>;
    /**
     * Exact quantiles of the metric value over a period.
     *
     * @param device Device ID
     * @param name Metric name
     * @param period Period in the form 'now-6h:now'
     * @param levels A level (0..1) or array of levels, e.g. `[0.5, 0.95, 0.99]`
     * @returns `{ p50: number, p95: number, ... }`
     */
    percentile(device: string, name: string, period: string, levels?: number | number[]): Record<string, number | null>;
    /**
     * Percentile by linear interpolation between ranks (same as
     * `vrack2-journal-db` `Percentile.of`).
     */
    protected percentileOf(sorted: number[], q: number): number;
    /**
     * `device.metric.register` is a metadata registration in the base — no
     * per-metric storage exists in this engine.
     */
    protected deviceMetric(nEvent: IDeviceEvent): void;
    /**
     * The `where` selecting one device metric in the shared table.
     */
    protected metricWhere(device: string, name: string): NonNullable<ScanOptions['where']>;
    /**
     * Raw rows of one metric in a ts window (projection: ts + value).
     *
     * @param start Period start (ms or journal-db period string)
     * @param end Period end (ms or journal-db period string)
     * @param limit Optional max rows to scan
     */
    protected metricRows(device: string, name: string, start: number | string, end: number | string, limit?: number): import("vrack2-journal-db").Row[];
}
