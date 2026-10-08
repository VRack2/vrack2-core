import { StorageTypes } from "vrack-db";


export default interface IMetricSettings {
    /**
     *  Specifies the accuracy and storage period size of Graphite-style metrics
     *  @see SingleDB.metric
    */
    retentions: string;
    /**
     * Interval that defines the minimal time unit
     * 
     * s - second
     * ms - millisecond
     * us - microsecond
    */
    interval: 's' | 'ms' | 'us';

    /**
     * Defines the type of value storage
     * StorageTypes type like a StorageTypes.Uint64 (default)
    */
    vType: StorageTypes;

    /**
     * Defines the type of time storage
     * StorageTypes type like a StorageTypes.Uint64 (default)
    */
    tType: StorageTypes;

    /**
     * Aggregation function applied when rolling the metric up
     * (one of `min | max | sum | avg | count`). Defaults to `avg` in the
     * journal-db engine and to `last` in the legacy vrack-db engine.
     */
    modify?: string;

    /** Metric Description */
    description?: string;

    /**
     * Additional information for the metric
    */
    additional?: any;
}
