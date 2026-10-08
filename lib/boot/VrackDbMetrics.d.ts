import { Interval, SingleDB } from "vrack-db";
import IDeviceEvent from "../service/IDeviceEvent";
import BootClass from "./BootClass";
import IMetricSettings from "../metrics/IMetricSettings";
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
 *
 * Uses the `device.metric` and `device.metric.register` events
 *
 * @see deviceMetric()
 * @see deviceRegisterMetric()
 */
export default class VrackDbMetrics extends BootClass {
    /**
     * VRack-DB class instance
    */
    DB: SingleDB;
    /**
     * Per-metric write-modify (from the metric description), default `last`.
     */
    protected modifies: Record<string, string>;
    onStart(): void;
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
     * @param func Data aggregation function @see SingleDB.read
    */
    read(device: string, name: string, period: string, precision: string | number, func?: string): import("vrack-db").IMetricReadResult;
    /**
     * Registers the device metric
     *
     * When a device is initialized - the container gets a list of
     * device metrics and passes them to the `device.metric.register` event for each metric.
     *
     * @param nEvent Object like a { device: 'Device ID',  data: 'metric.name', trace: IMetricSettings object}
     * @see IMetricSettings
     * @see registerMetric
    */
    protected deviceRegisterMetric(nEvent: IDeviceEvent): void;
    /**
     * @see deviceRegisterMetric
     * */
    protected registerMetric(path: string, metric: IMetricSettings): void;
    /**
     * A method of writing a metric to a database.
     *
     * @param nEvent Object like a { device: 'Device ID',  data: 'metric.name', trace: { value } }
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
