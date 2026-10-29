import MetricGroup from "./MetricGroup";
import MetricOne from "./MetricOne";
/**
 * Device metric declarations — factory for the values returned from
 * `Device.metrics()`.
 *
 * Declared under an exact key: `Metric.one()` — a single metric.
 * Declared under a wildcard key (`'group.*'`): `Metric.group()` — a group
 * admitting any name matching the pattern, with optional known members.
 *
 * Declarations carry metadata only (description/additional); storage,
 * retention and the time unit (always ms internally) belong to the metrics
 * engine (`JournalDbMetrics` / `VrackDbMetrics`).
 */
export default class Metric {
    /**
     * Declare a single metric.
     */
    static one(): MetricOne;
    /**
     * Declare a metric group under a wildcard key (e.g. `'boilers.*'`).
     */
    static group(): MetricGroup;
}
