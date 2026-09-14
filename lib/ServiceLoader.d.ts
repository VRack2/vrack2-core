import Device from "./service/Device";
import Bootstrap from "./Bootstrap";
import type Container from "./Container";
import IServiceStructure from "./IServiceStructure";
import IStructureDevice from "./IStructureDevice";
import ICheckResult from "./ICheckResult";
/**
 * ServiceLoader — device creation & validation from config, hot add/remove,
 * connection wiring, and the *structure finalization* signal.
 *
 *  - **ServiceLoader** owns *device creation & validation*, *hot add/remove*,
 *    *connection wiring*, and emits `serviceLoaded` (the finalization
 *    event that triggers persistence of the structure).
 *  - **Container** owns *registration, connections state, staged start, and
 *    runtime actions* (`registerDevice`, `addConnection`, `startDevice`, ...).
 *
 * The Loader is constructed with the Container and the service structure.
 * `load()` materializes all devices & connections (the previous
 * `Container.init()`), then emits `serviceLoaded`.
 */
export default class ServiceLoader {
    /** Container this loader builds devices for */
    Container: Container;
    /** Bootstrap (DeviceManager, etc.) used to resolve device classes */
    Bootstrap: Bootstrap;
    /** Service structure (devices + connections) this loader loads */
    service: IServiceStructure;
    /** Optional conf file that overrides device options */
    confFile?: string;
    /** True after `load()` has run once (idempotency guard) */
    inited: boolean;
    /** Guard against concurrent adds of the same device id */
    pending: Set<string>;
    constructor(container: Container, service: IServiceStructure, confFile?: string);
    /**
     * Load the full structure from `this.service` into the container.
     *
     * This re-homes the previous `Container.init()`:
     * 1. `configure` event, then `fillConfFile()` (override device options;
     *    failures wrapped in `CTR_CONF_EXTENDS_PROBLEM`).
     * 2. `beforeInit` / `init` events, then for each device: `initDevice`
     *    event + `createDevice()` + `Container.registerDevice()` (failures
     *    wrapped in `CTR_ERROR_INIT_DEVICE`).
     * 3. `afterInit` / `beforeConnections` / `connections` events, then wire
     *    every device connection and `service.connections` entry (failures
     *    wrapped in `CTR_ERROR_INIT_CONNECTION`).
     * 4. `afterConnections` event.
     * 5. **`serviceLoaded`** — the finalization signal. Listeners such as
     *    `StructureStorage` react to it by persisting the structure once.
     *
     * Idempotent — a second call is a no-op.
     */
    load(): Promise<void>;
    /**
     * Wire one connection during `load()`, wrapping any failure in
     * `CTR_ERROR_INIT_CONNECTION` (preserves the original init behavior).
     */
    private initConnection;
    /**
     * Hot-add a device: create it, register it in the container, and emit
     * `initDevice` + `device.add` + `serviceLoaded`.
     *
     * The device is registered (structure, ports, actions, metrics) but is
     * **not** started. Start it with `Container.startDevice(id)`.
     *
     * @param dconf Device configuration
     * @returns The registered (not yet started) device
     */
    addDevice(dconf: IStructureDevice): Promise<Device>;
    /**
     * Hot-remove a device from the container and emit `serviceLoaded`.
     *
     * If the device is running, it is stopped first
     * (`stop()` + `await stopPromise()`) and then destroyed
     * (`beforeTerminate()` + cleanup).
     *
     * @param id Device ID
     */
    removeDevice(id: string): Promise<void>;
    /**
     * Hot-add a connection and emit `serviceLoaded`.
     *
     * @param conn Device connection string like "DevID.port -> DevIDTO.port"
     */
    addConnection(conn: string): void;
    /**
     * Override device options (and connections) from the conf file.
     *
     * Re-homed from `Container.fillConfFile()`.
     */
    protected fillConfFile(): void;
    /**
     * Create and validate a device instance from its configuration.
     *
     * Steps:
     * 1. Resolve the device class via DeviceManager
     * 2. Validate the device id
     * 3. Guard against a duplicate id
     * 4. Instantiate the device
     * 5. Fill & `prepareOptions()`
     * 6. Validate options against `checkOptions()`
     *
     * The returned device is **not** registered in the container.
     *
     * @param dconf Device configuration
     * @returns A validated, unregistered Device instance
     */
    createDevice(dconf: IStructureDevice): Promise<Device>;
    /**
     * Dry-run validation of a device configuration.
     *
     * Builds a throwaway instance to exercise `prepareOptions()` and option
     * validation, then discards it. It has **no side effects** on the container
     * (nothing is registered).
     *
     * > Device constructors and `prepareOptions()` should be side-effect free.
     *
     * @param dconf Device configuration
     * @returns `ICheckResult` describing validity (and problems, if any)
     */
    checkDevice(dconf: IStructureDevice): Promise<ICheckResult>;
    /**
     * Dry-run validation of a connection (delegates to Container).
     *
     * @param conn Device connection string like "DevID.port -> DevIDTO.port"
     * @returns `ICheckResult` describing validity
     */
    checkConnection(conn: string): ICheckResult;
    /**
     * Convert a thrown error into an `ICheckResult`
     */
    protected toResult(error: any): ICheckResult;
}
