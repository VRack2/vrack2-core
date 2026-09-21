import BootClass from './boot/BootClass';
import Container from './Container';
/**
 * One boot-class entry in a boot list config.
 *
 * `path` may be omitted: in layered merge (see `mergeBootList`) an entry
 * without `path` is an **options override** — the id must already be present
 * in a lower layer, whose `path` is kept. An entry without `path` that does
 * not match any lower-layer id is a configuration error.
 */
export interface IBootstrapEntry {
    /** VRack-style bootclass path. Optional — options-only override */
    path?: string;
    /** Options for this bootclass */
    options: {
        [key: string]: any;
    };
}
/**
 * Defines a list of bootstrap classes to load
 *
 * {
 *   'ClassID': {
 *      path: 'importclass.path',
 *      options: {}
 *    }
 * }
 *
 * In layered merge a value of `null` removes the id from the merged list.
 */
export interface IBootListConfig {
    [key: string]: IBootstrapEntry | null;
}
export declare function mergeBootList(layers: Array<IBootListConfig | null | undefined>): IBootListConfig;
/**
 * Bootstrap is a class for running bootclasses,
 * which should work above Container and is required
 * for Container to work.
 *
 * For example DeviceManager class - it is
 * necessary for Container to work but it must be
 * replaceable and customizable.
 *
 * Bootstrap handles the loading of DeviceManager and
 * provides the ability to work with it from Container.
 * Bootclasses are a forced exception.
 *
 * This is the minimum code that is needed to do everything
 * else in the style of VRack service.
 *
*/
export default class Bootstrap {
    /**
     * Container for which boot classes are loaded (set by `loadBootList()`).
     * Used to report `terminateAll()` failures as `system.error` events.
     */
    protected Container: Container | undefined;
    /**
     * Loaded class list
     *
     * ```ts
     * { UniqueID: ClassInstance }
     * ```
    */
    protected loaded: {
        [key: string]: BootClass;
    };
    /**
     * List of downloadable classes and their settings
     *
     * @see IBootListConfig
    */
    protected config: IBootListConfig;
    /**
     * True once `loadBootList()` has been executed (idempotency guard).
     * Re-running it would re-instantiate the boot classes and re-subscribe
     * their container event handlers (duplicate listeners).
     */
    protected booted: boolean;
    /**
     * True once `terminateAll()` has been executed (idempotency guard).
     * Re-running it would re-invoke `terminate()` on boot classes that have
     * already released their resources.
     */
    protected terminated: boolean;
    constructor(config: IBootListConfig);
    /**
     * Load bootclasses
     *
     * Bootclass has some analogy to devices within VRack services.
     * They also have options, process, processPromise methods similar to devices
     *
     * Idempotent: a second call is a no-op — boot classes are not re-instantiated
     * and their event handlers are not re-subscribed.
     *
     * @param Container Container for which loading is performed
    */
    loadBootList(Container: Container): Promise<void>;
    /**
     * Getting an initialized class
     *
     * @example
     * ```ts
     * this.Container.Bootstrap.getBootClass('DeviceMetrics', DeviceMetrics) as DeviceMetrics
     * ```
     *
     * @param id class identifier that was specified in the list
     * @param cs Class to be compared with when receiving
    */
    getBootClass(id: string, cs: any): typeof cs;
    /**
     * Gracefully stop **all** loaded boot classes, releasing their resources.
     *
     * Boot classes own process-level resources (database pools, file handles)
     * that live for the whole service lifetime, so they cannot be terminated
     * one by one — `terminateAll()` stops the entire set at once. There is
     * deliberately no public "terminate one boot class" entry point: closing
     * a single shared resource while the service is still running would leave
     * the rest of the service without it.
     *
     * Calls `terminate()` on every loaded boot class. All calls are awaited;
     * a single failure is reported as `system.error` and does not prevent the
     * remaining boot classes from terminating — the process is exiting anyway.
     *
     * One-way: once called, the flag is latched and further calls are no-ops
     * (mirrors the `booted` idempotency guard of `loadBootList()`).
     */
    terminateAll(): Promise<void>;
}
