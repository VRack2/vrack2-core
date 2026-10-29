import IMetricSettings from "./IMetricSettings";
import MetricOne from "./MetricOne";
/**
 * A metric group declaration (created via `Metric.group()`), declared under
 * a wildcard key in `Device.metrics()` — e.g. `'boilers.*'`.
 *
 * The group admits any metric name matching its pattern (`*` matches one
 * dot-separated segment); `list()` describes the known members with their
 * own metadata. Storage is identical for all members — a group is a
 * declaration unit, not a storage unit.
 */
export default class MetricGroup {
    /**
     * Declaration settings.
     */
    protected group: IMetricSettings;
    /**
     * Group description (applies to the whole group; members may carry
     * their own).
     *
     * @param des Short text description of the group
     */
    descriptions(des: string): this;
    /**
     * Additional information for the group.
     *
     * @param add Additional information
     */
    additional(add: any): this;
    /**
     * Known group members: member name (the `*` part) → its declaration.
     * Not exhaustive — any name matching the group pattern is accepted.
     *
     * @param list Member declarations
     */
    list(list: {
        [name: string]: MetricOne;
    }): this;
    /**
     * Export the declaration (used by the Container/structure).
     */
    export(): IMetricSettings;
}
