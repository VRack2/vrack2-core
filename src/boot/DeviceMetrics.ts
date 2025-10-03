/*
 * Copyright © 2025 Boris Bobylev. All rights reserved.
 * Licensed under the Apache License, Version 2.0
*/

import { Interval, IntervalMs, IntervalUs, SingleDB } from "vrack-db";
import IDeviceEvent from "../service/IDeviceEvent";
import BootClass from "./BootClass";
import IMetricSettings from "../metrics/IMetricSettings";

/**
 * A class to support metrics inside devices
 * Using a database vrack-db. Collects and stores container metrics
 * 
 * @see SingleDB
 *
 * Uses the `device.metric` and `device.register.metric` events
 * 
 * @see deviceMetric()
 * @see deviceRegiterMetric()
*/
export default class DeviceMetrics extends BootClass {
    /**
     * VRack-DB class instance
    */
    DB = new SingleDB()

    process(): void {
        this.Container.on('device.metric', this.deviceMetric.bind(this))
        this.Container.on('device.register.metric', this.deviceRegiterMetric.bind(this))
    }
    
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
     * @param precision func Data aggregation function @see SingleDB.read
    */
    read(device: string, name: string, period: string, precision: string | number, func?: string) {
        const path = this.getMetricPath(device, name)
        return this.DB.read(path, period, precision, func)
    }

    /**
     * Registers the device metric
     * 
     * When a device is initialized - the container gets a list of 
     * device metrics and passes them to the `device.register.metric` event for each metric.
     * 
     * @param nEvent Object like a { device: 'Device ID',  data: 'metric.name', trace: IMetricSettings object}
     * @see IMetricSettings
     * @see registerMetric
    */
    protected deviceRegiterMetric(nEvent: IDeviceEvent) {
        this.registerMetric(this.getMetricPath(nEvent.device, nEvent.data), nEvent.trace)
    }

    /**
     * @see deviceRegiterMetric
     * */
    protected registerMetric(path: string, metric: IMetricSettings) {
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
     * @param nEvent Object like a { device: 'Device ID',  data: 'metric.name', trace:  { value: metric value 123, modify: function of vrack db modify } } 
     * @example 
     * ```ts
     * deviceMetric({
     *  device: 'Device ID',  
     *  data: 'metric.name',
     *  trace: { value: 5.25, modify: 'last'}
     * })
     * ```
    */
    protected deviceMetric(nEvent: IDeviceEvent) {
        const path = this.getMetricPath(nEvent.device, nEvent.data)
        if (!this.DB.has(path)) return
        this.DB.write(path, nEvent.trace.value, 0, nEvent.trace.modify)
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

    /**
     * Return metric path 
     * 
     * @param device Device ID
     * @param name Metric name
    */
    protected getMetricPath(device: string, name: string) {
        return (device + '.' + name).toLowerCase()
    }
}