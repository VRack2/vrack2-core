import BootClass from '../BootClass';
import IDeviceEvent from '../../service/IDeviceEvent';
import IMetricSettings from '../../metrics/IMetricSettings';
/**
 * Common base class for the device-metrics boot-class engines —
 * `JournalDbMetrics` (disk-backed, `vrack2-journal-db`) and
 * `VrackDbMetrics` (in-memory, `vrack-db`, backward compatibility).
 *
 * It defines the contract every metrics engine exposes to the service:
 * `has()` and `read()` for reading, and the `device.metric` /
 * `device.metric.register` event wiring for writing. It also keeps the
 * declaration registry: exact declarations and wildcard group patterns
 * (`'group.*'`), with the known members of each group expanded into exact
 * paths, plus the set of metric paths actually seen in writes.
 *
 * A device may write any metric name — declarations are metadata, not
 * permission. A write matching no declaration is stored as-is (unknown
 * metric), with no description.
 *
 * Subclasses extend this instead of {@link BootClass} directly and implement
 * the abstract engine hooks (`has`, `read`, `deviceMetric`), optionally
 * overriding {@link onEngineStart} for engine initialization and
 * {@link registerMetric} for declaration side effects (e.g. pre-creating
 * in-memory series).
 *
 * @see JournalDbMetrics
 * @see VrackDbMetrics
 * @see BootClass
 */
export default abstract class BootDeviceMetrics extends BootClass {
    /**
     * Metric declarations by path (device.name, lowercased). Wildcard group
     * patterns are stored under their pattern path (contains `*`).
     */
    protected declared: Map<string, IMetricSettings>;
    /**
     * Metric paths written at least once since the engine started.
     */
    protected seen: Set<string>;
    /**
     * Boot-class start hook (overrides {@link BootClass.onStart}).
     *
     * Runs the engine-specific initialization hook {@link onEngineStart} and
     * then wires the shared metric events, so every engine exposes the same
     * behavior with a single source of truth for the wiring.
     */
    onStart(): void;
    /**
     * Engine-specific initialization hook, called at the start of
     * {@link onStart} (before the events are wired).
     *
     * Use it to open the underlying store/database, etc. Default: no-op.
     *
     * @example
     * ```ts
     * protected onEngineStart(): void {
     *     this.DB = new Store(path.resolve(this.options.path, this.Container.id), { lock: 'off' })
     *     this.DB.init()
     * }
     * ```
     */
    protected onEngineStart(): void;
    /**
     * Checks if the metric exists — declared (exact or a group member) or
     * written at least once since the engine started.
     *
     * @param device Device ID
     * @param name Metric name
     */
    abstract has(device: string, name: string): boolean;
    /**
     * Reads the device metric series for a period.
     *
     * The concrete result shape is engine-specific — see the subclass docs.
     *
     * @param device Device ID
     * @param name Metric name
     * @param period Period in the form 'now-6h:now'
     * @param precision Bucket size (an interval string) or a point count
     * @param func Per-bucket aggregation function
     */
    abstract read(device: string, name: string, period: string, precision: string | number, func?: string): unknown;
    /**
     * Declaration hook — called for every registered declaration path.
     *
     * Called by {@link deviceRegisterMetric} once per exact path and once per
     * group pattern (with the path containing `*`). Engines that need a
     * storage object per metric (e.g. an in-memory series) create it here —
     * pattern registrations are a no-op for them. Default: no-op (the
     * journal-db engine stores every metric in one table).
     *
     * @param path Metric path (device.name, lowercased) or group pattern path
     * @param metric Metric settings
     * @see IMetricSettings
     */
    protected registerMetric(path: string, metric: IMetricSettings): void;
    /**
     * Writes a metric value to the engine's storage.
     *
     * @param nEvent `{ device, data, trace: { value } }`
     */
    protected abstract deviceMetric(nEvent: IDeviceEvent): void;
    /**
     * `device.metric.register` event handler (shared).
     *
     * When a device is initialized the container passes its metric
     * declarations; the base records them (expanding known group members
     * into exact paths) and calls {@link registerMetric} per path.
     *
     * @param nEvent `{ device, data: declared key, trace: IMetricSettings }`
     */
    protected deviceRegisterMetric(nEvent: IDeviceEvent): void;
    /**
     * Validates a declaration key: a wildcard key must contain **exactly
     * one** `*` (a group). Keys with multiple `*` would expand members to
     * dead pattern-containing paths (silently unreachable by `has()`), so
     * they are rejected at registration (fail-closed).
     *
      * @throws `BDM_GROUP_PATTERN` for a malformed wildcard key
     */
    protected checkGroupPattern(key: string, settings: IMetricSettings): void;
    /**
     * Shallow-copies a declaration (and its member map) so the engine's
     * registry is decoupled from the container structure.
     */
    protected cloneSettings(s: IMetricSettings): IMetricSettings;
    /**
     * Marks a metric path as written (call from the engine's write path).
     *
     * @param path Metric path (device.name, lowercased)
     */
    protected markSeen(path: string): void;
    /**
     * Checks whether a metric path is known: declared exactly (no `*`) or
     * written at least once.
     *
     * @param path Metric path (device.name, lowercased)
     */
    protected isKnown(path: string): boolean;
    /**
     * Returns the canonical metric path.
     *
     * @param device Device ID
     * @param name Metric name
     */
    protected getMetricPath(device: string, name: string): string;
}
