"use strict";
/*
 * Copyright © 2025 Boris Bobylev. All rights reserved.
 * Licensed under the Apache License, Version 2.0
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const vrack_db_1 = require("vrack-db");
const vrack_db_2 = require("vrack-db");
const Rule_1 = __importDefault(require("../../validator/Rule"));
const BootDeviceMetrics_1 = __importDefault(require("./BootDeviceMetrics"));
const JournalDbMetrics_1 = __importDefault(require("./JournalDbMetrics"));
/**
 * Legacy in-memory metrics engine, backed by vrack-db.
 *
 * Kept as an option for embedded systems with free RAM. The default engine
 * is {@link JournalDbMetrics} (disk-backed, vrack2-journal-db). Enable this
 * one by pointing the `DeviceMetrics` bootstrap entry at
 * `vrack2-core.VrackDbMetrics`.
 *
 * Using a database vrack-db. Collects and stores container metrics in memory.
 * Retention is service-level (`retentions` boot-class option) and applies to
 * every metric; the time unit is always ms. Metric declarations are metadata:
 * exact declarations create the series up front, group members and
 * undeclared names create it lazily on the first write.
 *
 * @see SingleDB
 * @see BootDeviceMetrics
 *
 * Uses the `device.metric` and `device.metric.register` events
 *
 * @see deviceMetric()
 * @see deviceRegisterMetric()
 */
class VrackDbMetrics extends BootDeviceMetrics_1.default {
    constructor() {
        super(...arguments);
        /**
         * VRack-DB class instance
        */
        this.DB = new vrack_db_1.SingleDB();
    }
    checkOptions() {
        return {
            retentions: Rule_1.default.string().required().default(JournalDbMetrics_1.default.DEFAULT_RETENTION)
                .description('Service-level retention for every metric (Graphite-style "res:ttl,...")'),
        };
    }
    /**
     * Checks if the metric exists in the device — declared or written since
     * the engine started (and its series created).
     *
     * @param device Device ID
     * @param name Metric name
    */
    has(device, name) {
        const path = this.getMetricPath(device, name);
        return this.DB.has(path);
    }
    /**
     * Read device metric from the database
     *
     * @param device Device ID
     * @param name Metric name
     * @param period Period in the format 'now-6h:now' @see SingleDB.read
     * @param precision Accuracy interval '15m', '5s', '1h' or count of metrics 10, 200, 1500
     * @param func Data aggregation function @see SingleDB.read
    */
    read(device, name, period, precision, func) {
        const path = this.getMetricPath(device, name);
        return this.DB.read(path, period, precision, func);
    }
    /**
     * Declaration hook: create the series up front for exact declarations.
     * Group pattern registrations are skipped — members (and any undeclared
     * name) are created lazily by {@link ensureMetric} on first write.
     */
    registerMetric(path, _metric) {
        if (path.includes('*'))
            return;
        this.ensureMetric(path);
    }
    /**
     * Creates the vrack-db series with the service retention (idempotent).
     *
     * @param path Metric path (device.name, lowercased)
     */
    ensureMetric(path) {
        if (this.DB.has(path))
            return;
        this.DB.metric({
            name: path,
            retentions: this.options.retentions,
            tStorage: vrack_db_2.StorageTypes.Uint64,
            vStorage: vrack_db_2.StorageTypes.Float,
            CInterval: vrack_db_1.IntervalMs
        });
    }
    /**
     * A method of writing a metric to a database.
     *
     * @param nEvent Object like a { device: 'Device ID',  data: 'metric.name', trace: { value } }
     */
    deviceMetric(nEvent) {
        const path = this.getMetricPath(nEvent.device, nEvent.data);
        this.ensureMetric(path);
        this.markSeen(path);
        this.DB.write(path, nEvent.trace.value, 0, 'last');
    }
}
exports.default = VrackDbMetrics;
