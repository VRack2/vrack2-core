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
class JournalDbMetrics extends BootClass_1.default {
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
    onStart() {
        const baseDir = path_1.default.resolve(this.options.path, this.Container.id);
        this.DB = new vrack2_journal_db_1.Store(baseDir);
        this.DB.init();
        this.Container.on('device.metric', this.deviceMetric.bind(this));
        this.Container.on('device.metric.register', this.deviceRegisterMetric.bind(this));
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
     * Read raw metric rows for a period. Each point is already at the
     * resolution of the retention tier that owns it (fine for recent data,
     * coarser for older data) — no manual downsampling.
     *
     * @param device Device ID
     * @param name Registered metric name
     * @param period Period in the form 'now-6h:now'
     * @returns `{ relevant, start, end, rows }` — `rows` are `{ ts, value }`, old → new
     */
    read(device, name, period) {
        const table = this.getMetric(device, name);
        const [start, end] = vrack2_journal_db_1.Interval.period(period);
        const rows = table ? table.query(start, end) : [];
        return {
            relevant: rows.length > 0,
            start,
            end,
            rows,
        };
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
        const [start, end] = vrack2_journal_db_1.Interval.period(period);
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
        const [start, end] = vrack2_journal_db_1.Interval.period(period);
        return table.percentile(start, end, levels);
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
    deviceRegisterMetric(nEvent) {
        this.registerMetric(this.getMetricPath(nEvent.device, nEvent.data), nEvent.trace);
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
        this.DB.openTable(metricPath, {
            retention: metric.retentions,
            agg: { value: modify },
        });
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
    /**
     * Metric path
     *
     * @param device Device ID
     * @param name Metric name
     */
    getMetricPath(device, name) {
        return (device + '.' + name).toLowerCase();
    }
}
exports.default = JournalDbMetrics;
