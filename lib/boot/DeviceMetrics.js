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
const BootClass_1 = __importDefault(require("./BootClass"));
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
class DeviceMetrics extends BootClass_1.default {
    constructor() {
        super(...arguments);
        /**
         * VRack-DB class instance
        */
        this.DB = new vrack_db_1.SingleDB();
    }
    process() {
        this.Container.on('device.metric', this.deviceMetric.bind(this));
        this.Container.on('device.register.metric', this.deviceRegiterMetric.bind(this));
    }
    /**
     * Checks if the metric exists in the device
     *
     * @param device Device ID
     * @param name Registered metric name
    */
    has(device, name) {
        const path = this.getMetricPath(device, name);
        if (!this.DB.has(path))
            return false;
        return true;
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
    read(device, name, period, precision, func) {
        const path = this.getMetricPath(device, name);
        return this.DB.read(path, period, precision, func);
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
    deviceRegiterMetric(nEvent) {
        this.registerMetric(this.getMetricPath(nEvent.device, nEvent.data), nEvent.trace);
    }
    /**
     * @see deviceRegiterMetric
     * */
    registerMetric(path, metric) {
        this.DB.metric({
            name: path,
            retentions: metric.retentions,
            tStorage: metric.tType,
            vStorage: metric.vType,
            CInterval: this.selectInterval(metric.interval)
        });
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
    deviceMetric(nEvent) {
        const path = this.getMetricPath(nEvent.device, nEvent.data);
        if (!this.DB.has(path))
            return;
        this.DB.write(path, nEvent.trace.value, 0, nEvent.trace.modify);
    }
    /**
     * Selects the interval class depending on the specified minimal time unit
     *
     * @param interval  s | ms | us
     *
    */
    selectInterval(interval) {
        switch (interval) {
            case 's': return vrack_db_1.Interval;
            case 'ms': return vrack_db_1.IntervalMs;
            case 'us': return vrack_db_1.IntervalUs;
        }
        return vrack_db_1.Interval;
    }
    /**
     * Return metric path
     *
     * @param device Device ID
     * @param name Metric name
    */
    getMetricPath(device, name) {
        return (device + '.' + name).toLowerCase();
    }
}
exports.default = DeviceMetrics;
