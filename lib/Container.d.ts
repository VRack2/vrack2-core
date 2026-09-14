import EventEmitter from "events";
import ICheckResult from "./ICheckResult";
import Device from "./service/Device";
import BasicAction from "./actions/BasicAction";
import IPort from "./ports/IPort";
import IAction from "./actions/IAction";
import Bootstrap from "./Bootstrap";
import IMetricSettings from "./metrics/IMetricSettings";
import BasicMetric from "./metrics/BasicMetric";
/**
 * Contains the structure of the service
 *
 * Where { DeviceID: DeviceStructure }
*/
export interface IContainerStructure {
    [key: string]: {
        /** Device ID */
        id: string;
        /** Device type like a 'vendor.Device'*/
        type: string;
        /** Actions list @see IAction */
        actions: {
            [key: string]: IAction;
        };
        /** List of ports with their connections  */
        outputs: {
            [key: string]: Array<{
                device: string;
                port: string;
            }>;
        };
        /** List of ports with their connections  */
        inputs: {
            [key: string]: Array<{
                device: string;
                port: string;
            }>;
        };
        /** List of all ports on the device */
        ports: Array<IDeviceStructurePort>;
        /** A list of device metrics */
        metrics: {
            [key: string]: IMetricSettings;
        };
        /** Device display settings */
        settings: {
            [key: string]: any;
        };
        /** Personalized display settings */
        display?: {
            header_bg?: string;
            body_bg?: string;
            group_bg?: string;
            is_rotated?: boolean;
            row?: number;
            col?: number;
        };
    };
}
export interface IDeviceStructurePort extends IPort {
    /** Port ID */
    port: string;
    /** Port direct */
    direct: string;
}
/**
 * Pure runtime container.
 *
 * Holds the device registry, the live `structure`, connection state
 * and the staged start. It does **not** own the service config or device
 * creation — those belong to `ServiceLoader`.
 *
 * This class is a bit complicated for a simple description.
 * It is recommended to familiarize yourself with the source code
*/
export default class Container extends EventEmitter {
    /** Unique service ID */
    id: string;
    /** List of devices in container */
    devices: {
        [key: string]: Device;
    };
    /** Parent container if it exists */
    parent?: Container;
    /**
     * Дополнительные метаданные
    */
    meta?: {
        [key: string]: any;
    };
    /**
     * Container bootstrap class
     *
     * A different bootstrap class must be created for each container
    */
    Bootstrap: Bootstrap;
    /** run flag */
    protected runned: boolean;
    /**
     * List of all device actions
     *
     * [deviceID]: { action.name: BasicAction}
    */
    protected deviceActions: {
        [key: string]: {
            [key: string]: BasicAction;
        };
    };
    /**
     * List of all device metrics
     *
    */
    protected deviceMetrics: {
        [key: string]: {
            [key: string]: BasicMetric;
        };
    };
    /**
     * Container structure
    */
    protected structure: IContainerStructure;
    /**
     * Set of device ids that are fully started
     * (`process()` + `processPromise()` completed).
     * Used to make `startDevice()` idempotent.
    */
    protected started: Set<string>;
    /**
     * Create a pure runtime container.
     *
     * The container holds the device registry, the live `structure`,
     * connection state and the staged start. It does **not** own the service
     * config or device creation — those belong to `ServiceLoader`.
     *
     * @param id Container ID
     * @param bootstrap Bootstrap class object
     */
    constructor(id: string, bootstrap: Bootstrap);
    /**
     * Run process & processPromise of all devices
     *
     * Staged start: first `process()` of every (not yet started) device,
     * then `processPromise()` of every (not yet started) device.
     * Devices that were already started via `startDevice()` are skipped,
     * which makes this method safe to call after hot adds.
    */
    runProcess(): Promise<void>;
    /**
     * Start a single (already registered) device: run `process()` and then
     * `processPromise()`.
     *
     * Idempotent — calling it again for the same device is a no-op.
     * Used to hot-start a device that was added via `addDevice()`.
     *
     * @param id Device ID
    */
    startDevice(id: string): Promise<void>;
    /**
     * Stop a single running device: call `stop()`, then `await stopPromise()`,
     * then mark it stopped (`running = false`, removed from `started`).
     *
     * Reversible — the device can be started again with `startDevice()`.
     * Idempotent — a device that is not running is a no-op.
     *
     * @param id Device ID
     */
    stopDevice(id: string): Promise<void>;
    /**
     * Stop all running devices in the reverse order of their start.
     *
     * Best-effort: every running device is stopped even if some of them fail;
     * if nothing is running this is a no-op.
     * If one or more devices failed, throws CTR_DEVICE_STOP_ALL_EXCEPTION
     * with each device error attached (`vAddErrors`).
     *
     * Stopped devices can be started again with `startDevice()`.
     */
    stopAll(): Promise<void>;
    /**
     * Whether a device has been fully started (`process` + `processPromise`).
     *
     * @param id Device ID
    */
    isStarted(id: string): boolean;
    /**
     * Check device action and run him
     *
     * @param device Device ID
     * @param action Device action (as 'action.name')
     * @param data Data for action
    */
    deviceAction(device: string, action: string, data: any): Promise<any>;
    /**
     * Return structure
    */
    getStructure(): Promise<IContainerStructure>;
    /**
     * Register a previously created & validated device instance into the
     * container:
     *  - add to the devices map
     *  - create the structure entry
     *  - run `preProcess()`
     *  - register actions
     *  - register metrics (emit `device.register.metric`)
     *  - create input & output ports
     *
     * @param dev A device created via `ServiceLoader.createDevice()`
     * @returns The registered device
    */
    registerDevice(dev: Device): Device;
    /**
     * Check device input handler
     * Make CTR_INPUT_HANDLER_NF error if not exists
     * @see registerDevice make inputPorts
    */
    protected checkInputHandler(port: string, handler: string, device: Device): void;
    /**
     * Parse & validate a connection string against the current container
     * state. Pure check — emits no events, commits nothing.
     *
     * @param conn Device connection string like a "DevID.port -> DevIDTO.port"
     * @returns The parsed connection
    */
    protected checkConnectionCore(conn: string): {
        outputDevice: string;
        outputPort: string;
        inputDevice: string;
        inputPort: string;
    };
    /**
     * Commit a validated connection: update the structure and create the
     * `DeviceConnect`. Does not emit (the caller emits `connection`).
     *
     * @param cc Parsed connection (from `checkConnectionCore`)
    */
    protected makeConnection(cc: {
        outputDevice: string;
        outputPort: string;
        inputDevice: string;
        inputPort: string;
    }): void;
    /**
     * Add a connection between two already-registered device ports.
     *
     * This is the hot-connection entry point. Validates the connection,
     * emits `connection`, updates the structure and creates the
     * `DeviceConnect`. Throws the specific VRack error on failure.
     *
     * @param conn Device connection string like a "DevID.port -> DevIDTO.port"
    */
    addConnection(conn: string): void;
    /**
     * Dry-run validation of a connection (no side effects, no `DeviceConnect`).
     *
     * @param conn Device connection string like a "DevID.port -> DevIDTO.port"
     * @returns `ICheckResult` describing validity
    */
    checkConnection(conn: string): ICheckResult;
    /**
     * Convert a thrown error into an `ICheckResult`
    */
    protected toCheckResult(error: any): ICheckResult;
    /**
     * Remove a device from the container:
     *  - stop it first, if it is running: `stop()` + `await stopPromise()`
     *  - call `beforeTerminate()`
     *  - disconnect all its connections (both sides)
     *  - remove its structure entry and all references to it
     *  - remove it from the devices / actions / metrics maps & `started`
     *  - emit `device.remove` (device id)
     *
     * The device is destroyed — unlike `stopDevice()`, it cannot be
     * started again. If the stop hooks fail, the removal is aborted and
     * the device stays in the container (fail-closed).
     *
     * The device's storage file is intentionally left on disk.
     *
     * @param id Device ID
    */
    removeDevice(id: string): Promise<void>;
    /**
     * Whether a device with the given id is registered in the container.
     *
     * @param id Device ID
    */
    hasDevice(id: string): boolean;
    /**
     * Get a registered device by id.
     *
     * @param id Device ID
     * @returns The device, or `undefined` if not registered
    */
    getDevice(id: string): Device | undefined;
    /**
     * List ids of all registered devices.
    */
    deviceList(): string[];
    /**
     * Container Helper - parse connection string to format object
     *
     * @return Connection object
    */
    private toConnection;
    /**
     * Check Port name (must contain at least one a-z, A-Z, 0-9 or '.' character)
     *
     * @param port Port name
    */
    protected checkPortName(port: string): void;
    /**
     * Convert dynamic port to ports list
     *
     * @param name Port name with %d symbols
     * @param iPort IPort object (port settings)
    */
    protected getPortList(name: string, iPort: IPort): {
        [key: string]: IPort;
    };
}
