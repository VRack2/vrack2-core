/*
 * Copyright © 2025 Boris Bobylev. All rights reserved.
 * Licensed under the Apache License, Version 2.0
 */

import { IntervalMs, SingleDB } from "vrack-db";
import { StorageTypes } from "vrack-db";
import IDeviceEvent from "../../service/IDeviceEvent";
import IMetricSettings from "../../metrics/IMetricSettings";
import Rule from "../../validator/Rule";
import BasicType from "../../validator/types/BasicType";
import BootDeviceMetrics from "./BootDeviceMetrics";
import JournalDbMetrics from "./JournalDbMetrics";

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
export default class VrackDbMetrics extends BootDeviceMetrics {
    /**
     * VRack-DB class instance
    */
    DB = new SingleDB()

    checkOptions(): { [key: string]: BasicType; } {
        return {
            retentions: Rule.string().required().default(JournalDbMetrics.DEFAULT_RETENTION)
                .description('Service-level retention for every metric (Graphite-style "res:ttl,...")'),
        }
    }

    /**
     * Checks if the metric exists in the device — declared or written since
     * the engine started (and its series created).
     *
     * @param device Device ID
     * @param name Metric name
    */
    has(device: string, name: string){
        const path = this.getMetricPath(device, name)
        return this.DB.has(path)
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
    read(device: string, name: string, period: string, precision: string | number, func?: string) {
        const path = this.getMetricPath(device, name)
        return this.DB.read(path, period, precision, func)
    }

    /**
     * Declaration hook: create the series up front for exact declarations.
     * Group pattern registrations are skipped — members (and any undeclared
     * name) are created lazily by {@link ensureMetric} on first write.
     */
    protected registerMetric(path: string, _metric: IMetricSettings) {
        if (path.includes('*')) return
        this.ensureMetric(path)
    }

    /**
     * Creates the vrack-db series with the service retention (idempotent).
     *
     * @param path Metric path (device.name, lowercased)
     */
    protected ensureMetric(path: string) {
        if (this.DB.has(path)) return
        this.DB.metric({
            name: path,
            retentions: this.options.retentions,
            tStorage: StorageTypes.Uint64,
            vStorage: StorageTypes.Float,
            CInterval: IntervalMs
        })
    }

    /**
     * A method of writing a metric to a database.
     *
     * @param nEvent Object like a { device: 'Device ID',  data: 'metric.name', trace: { value } }
     */
    protected deviceMetric(nEvent: IDeviceEvent) {
        const path = this.getMetricPath(nEvent.device, nEvent.data)
        this.ensureMetric(path)
        this.markSeen(path)
        this.DB.write(path, nEvent.trace.value, 0, 'last')
    }
}
