/*
 * Copyright © 2025 Boris Bobylev. All rights reserved.
 * Licensed under the Apache License, Version 2.0
 */

import { Interval, IntervalMs, IntervalUs, SingleDB } from "vrack-db";
import IDeviceEvent from "../../service/IDeviceEvent";
import IMetricSettings from "../../metrics/IMetricSettings";
import BootDeviceMetrics from "./BootDeviceMetrics";

/**
 * Legacy in-memory metrics engine, backed by vrack-db.
 *
 * Kept as an option for backward compatibility. The default engine is now
 * {@link JournalDbMetrics} (disk-backed, vrack2-journal-db). Enable this one
 * by pointing the `DeviceMetrics` bootstrap entry at
 * `vrack2-core.VrackDbMetrics`.
 *
 * Using a database vrack-db. Collects and stores container metrics in memory.
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

    /**
     * Per-metric write-modify (from the metric description), default `last`.
     */
    protected modifies: Record<string, string> = {}

    /**
     * Checks if the metric exists in the device
     *
     * @param device Device ID
     * @param name Registered metric name
    */
    has(device: string, name: string){
        const path = this.getMetricPath(device, name)
        if (!this.DB.has(path)) return false
        return true
    }

    /**
     * Read device metric from the database
     *
     * @param device Device ID
     * @param name Registered metric name
     * @param period Period in the format 'now-6h:now' @see SingleDB.read
     * @param precision Accuracy interval '15m', '5s', '1h' or count of metrics 10, 200, 1500
     * @param func Data aggregation function @see SingleDB.read
    */
    read(device: string, name: string, period: string, precision: string | number, func?: string) {
        const path = this.getMetricPath(device, name)
        return this.DB.read(path, period, precision, func)
    }

    /**
     * @see deviceRegisterMetric
     * */
    protected registerMetric(path: string, metric: IMetricSettings) {
        this.modifies[path] = metric.modify ?? 'last'
        this.DB.metric({
            name: path,
            retentions: metric.retentions,
            tStorage: metric.tType,
            vStorage: metric.vType,
            CInterval: this.selectInterval(metric.interval)
        })
    }

    /**
     * A method of writing a metric to a database.
     *
     * @param nEvent Object like a { device: 'Device ID',  data: 'metric.name', trace: { value } }
     */
    protected deviceMetric(nEvent: IDeviceEvent) {
        const path = this.getMetricPath(nEvent.device, nEvent.data)
        if (!this.DB.has(path)) return
        this.DB.write(path, nEvent.trace.value, 0, this.modifies[path] ?? 'last')
    }

    /**
     * Selects the interval class depending on the specified minimal time unit
     *
     * @param interval  s | ms | us
     *
    */
    protected selectInterval(interval: string): typeof Interval {
        switch (interval) {
            case 's': return Interval
            case 'ms': return IntervalMs
            case 'us': return IntervalUs
        }
        return Interval
    }
}
