import { StorageTypes } from "vrack-db";
import IMetricSettings from "./IMetricSettings";
/**
 * Metric base class. Used internally to define device metrics.
*/
export default class BasicMetric {
    /**
     * Default metric setting
    */
    protected metric: IMetricSettings;
    /**
     * Defines the type of time storage
     *
     * @param type StorageTypes type like a StorageTypes.Uint64 (default)
    */
    timeStorage(type: StorageTypes): this;
    /**
     *  Defines the type of value storage
     *
     * @param type StorageTypes type like a StorageTypes.Uint64 (default)
    */
    valueStorage(type: StorageTypes): this;
    /**
     * Specifies the accuracy and storage period size of Graphite-style metrics
     *
     *
     * @see SingleDB.metric
     * @param req retentions Graphite-style `5s:10m, 1m:2h, 15m:1d, 1h:1w, 6h:1mon, 1d:1y`
    */
    retentions(req: string): this;
    /**
     * Metric Description
     *
     * @param des Short text description of the metric
    */
    description(des: string): this;
    /**
     * To add additional data to the metric, you can specify
     * any object describing the metric in this method.
     *
     * @param add Additional information for the metric
    */
    additional(add: any): this;
    /**
     * Returns the internal metric settings object. Used inside Container
     * @private
    */
    export(): IMetricSettings;
}
