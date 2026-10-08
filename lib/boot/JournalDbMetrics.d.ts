import { Store } from 'vrack2-journal-db';
import type { AggFn } from 'vrack2-journal-db';
import IDeviceEvent from '../service/IDeviceEvent';
import BootClass from './BootClass';
import IMetricSettings from '../metrics/IMetricSettings';
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
    DB: Store;
    /**
     * Per-metric aggregation function (from the metric description), default `avg`.
     */
    protected modifies: Record<string, AggFn>;
    checkOptions(): {
        [key: string]: BasicType;
    };
    onStart(): void;
    onDestroy(): Promise<void>;
    /**
     * Checks if the metric exists
     *
     * @param device Device ID
     * @param name Registered metric name
     */
    has(device: string, name: string): boolean;
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
    read(device: string, name: string, period: string): {
        relevant: boolean;
        start: number;
        end: number;
        rows: import("vrack2-journal-db").Row[];
    };
    /**
     * Aggregate the metric value over a period using the metric's `modify`
     * function (default `avg`).
     *
     * @param device Device ID
     * @param name Registered metric name
     * @param period Period in the form 'now-6h:now'
     * @returns `{ [fn]: number | null }`
     */
    aggregate(device: string, name: string, period: string): Record<string, number | null>;
    /**
     * Exact quantiles of the metric value over a period.
     *
     * @param device Device ID
     * @param name Registered metric name
     * @param period Period in the form 'now-6h:now'
     * @param levels A level (0..1) or array of levels, e.g. `[0.5, 0.95, 0.99]`
     * @returns `{ p50: number, p95: number, ... }`
     */
    percentile(device: string, name: string, period: string, levels?: number | number[]): Record<string, number | null>;
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
    protected deviceRegisterMetric(nEvent: IDeviceEvent): void;
    /**
     * Open the metric table (idempotent — re-open returns the existing table).
     *
     * @param metricPath Metric path
     * @param metric Metric settings
     */
    protected registerMetric(metricPath: string, metric: IMetricSettings): void;
    /**
     * Write a metric value (raw append at the current time).
     *
     * @param nEvent `{ device, data, trace: { value } }`
     */
    protected deviceMetric(nEvent: IDeviceEvent): void;
    /**
     * Resolve the open table for a device metric (null if not registered).
     */
    protected getMetric(device: string, name: string): import("vrack2-journal-db").Table | undefined;
    /**
     * The metric's aggregation function (from its description), default `avg`.
     */
    protected getModify(device: string, name: string): AggFn;
    /**
     * Coerce a declared `modify` to a valid journal-db `AggFn`
     * (`min` | `max` | `sum` | `avg` | `count`), defaulting to `avg`.
     */
    protected toAggFn(modify: string | undefined): AggFn;
    /**
     * Metric path
     *
     * @param device Device ID
     * @param name Metric name
     */
    protected getMetricPath(device: string, name: string): string;
}
