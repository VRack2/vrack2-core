import { Interval, SingleDB } from "vrack-db";
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
    DB: SingleDB;
    process(): void;
    /**
     * Checks if the metric exists in the device
     *
     * @param device Device ID
     * @param name Registered metric name
    */
    has(device: string, name: string): boolean;
    /**
     * Read device metric from the database
     *
     * @param device Device ID
     * @param name Registered metric name
     * @param period Period in the format 'now-6h:now' @see SingleDB.read
     * @param precision Accuracy interval '15m', '5s', '1h' or count of metrics 10, 200, 1500
     * @param precision func Data aggregation function @see SingleDB.read
    */
    read(device: string, name: string, period: string, precision: string | number, func?: string): import("vrack-db").IMetricReadResult;
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
    protected deviceRegiterMetric(nEvent: IDeviceEvent): void;
    /**
     * @see deviceRegiterMetric
     * */
    protected registerMetric(path: string, metric: IMetricSettings): void;
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
    protected deviceMetric(nEvent: IDeviceEvent): void;
    /**
     * Selects the interval class depending on the specified minimal time unit
     *
     * @param interval  s | ms | us
     *
    */
    protected selectInterval(interval: string): typeof Interval;
    /**
     * Return metric path
     *
     * @param device Device ID
     * @param name Metric name
    */
    protected getMetricPath(device: string, name: string): string;
}
