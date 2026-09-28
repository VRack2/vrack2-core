import BasicType from "../validator/types/BasicType";
import BootDatabase from "../boot/BootDatabase";
import Container from '../Container';
import BasicAction from "../actions/BasicAction";
import BasicPort from "../ports/BasicPort";
import DevicePort from "./DevicePort";
import BasicMetric from "../metrics/BasicMetric";
export declare enum EDeviceMessageTypes {
    terminal = "terminal",
    info = "info",
    error = "error",
    event = "event",
    action = "action",
    alert = "alert"
}
interface IDeviceSettings {
    /**
     * List of broadcast channels
     * Device channels list:
     *  - terminal
     *  - notify
     *  - event
     *  - action
     *  - alert
     *  - error
     *  - render
     *  - status (automatic — maintained by the Container, see IDeviceStatus)
    */
    channels: Array<'terminal' | 'notify' | 'event' | 'action' | 'alert' | 'error' | 'render' | 'status'>;
}
export default class Device {
    /**
     * Device unique for this container id
     * the name usually begins with a capital letter
     *
     * @example 'DeviceName'
     * */
    id: string;
    /**
     * Device type string
     * Uses the vendor name and device name
     * @example 'vrack.KeyManager'
    */
    type: string;
    /**
     * Device running state — read-only, derived from the Container's
     * device status record (single source of truth: `deviceStatus[id].state`).
     *
     * `true` for `registered` (not started yet, so startup traffic such as
     * command registration flows) and `started` devices;
     * `false` for `stopped` devices and for ids without a status record
     * (removed devices — fail-closed, they accept no port data).
     *
     * A stopped device also gets its actions rejected with the
     * CTR_DEVICE_STOPPED error (the Container checks its `started` set).
     */
    get running(): boolean;
    /**
     * Allows access to port management.
    */
    ports: {
        input: {
            [key: string]: DevicePort;
        };
        output: {
            [key: string]: DevicePort;
        };
    };
    /**
     * Active loader container
     * */
    Container: Container;
    /**
     * Device options
     *
     * @see checkOptions()
    */
    options: {
        [key: string]: any;
    };
    /**
     * @param id Unique ID
     * @param type Device type string
     * @param Container Active loader container
    */
    constructor(id: string, type: string, Container: Container);
    /**
     * Device settings
     *
     * Needs to be finalized
    */
    settings(): IDeviceSettings;
    /**
     * Short device description. Can use markdown markup
     *
     * @return {string} Device description
     * */
    description(): string;
    /**
     * This is a fast updating data object — the device's fast-changing state
     * for the outside world. Mutating it emits nothing: the device calls
     * `render()` itself after the change and the emitted `device.render`
     * event carries the *live* reference to this object.
     *
     * A subclass declares its shape as a plain class field - inside the class
     * `this.shares` keeps the declared typing (not Record<string, any>):
     * ```ts
     * class MyDevice extends Device {
     *     shares = { data: 1, name: 'x' }          // initial state + its type
     *     work() { const n: number = this.shares.data }   // fully typed in the IDE
     * }
     * ```
     * Without a field the default is an empty `{}`; writes in
     * constructor/preProcess() work as well.
     *
     * @see render()
     */
    shares: Record<string, any>;
    /**
     * This data will be loaded for the specific instance of the device.
     * The device itself determines this data and saves it at the right moment
     *
     * The structure is determined by the device
    */
    storage: any;
    /**
     * Device action list
     * Device actions can be called from the container.
     * This is a way to interact with the device from the outside world
     *
     * @example
     * ```
     *  return {
     *      'test.action': Action.global().requirements({
     *          id: Rule.string().required().default('www').description('Some id')
     *      }).description('Test action')
     *  }
     * ```
     *
     * A handler must be created for each action. For example, for `test.action` action `actionTestAction` must be created.
     * */
    actions(): {
        [key: string]: BasicAction;
    };
    /**
     * Defining device metrics.
     *
     * @example
     *
     * ```
     * return {
     *  'test.metric': Metric.inS().retentions('1s:6h').description('Test metric')
     * }
     * ```
     * @see BasicMetric
    */
    metrics(): {
        [key: string]: BasicMetric;
    };
    /**
     * Run before each device action
     *
     * @param action "device.action" like string
     * @param data  data for action
    */
    beforeAction(action: string, data: any): boolean;
    /**
     * Prepare options
     *
     * this method call before validating options
    */
    prepareOptions(): void;
    /**
     * Defining a list of device parameters
     *
     * @example
     * ```ts
     * return {
     *      timeout: Rule.number().integer().min(0).description('Interval timeout').example(0)
     * }
     * ```
     *
     * @returns {Array<Rule>}
     * */
    checkOptions(): {
        [key: string]: BasicType;
    };
    /**
     * Device inputs list
     *
     * Use like this object:
     * {
     *    'group.portname': Port.standard(),
     *    'group.portname': Port.standard()
     * }
     *
    */
    inputs(): {
        [key: string]: BasicPort;
    };
    /**
     * Device output list
     *
     * @see inputs
    */
    outputs(): {
        [key: string]: BasicPort;
    };
    /**
     * Registration hook (canonical name): the entry point to start device
     * initialization. Runs in `Container.registerDevice()`, before ports and
     * connections are created — use it to assign functions for dynamic ports.
     *
     * During the deprecation window the Container calls **both** this method
     * and the deprecated `preProcess()` — keep your logic in only one of them.
     */
    onRegister(): void;
    /**
     * The method is an input point to start device initialization
     *
     * The device will only go through the following device creation steps:
     *
     * - Creating a class
     * - Assigning device parameters
     *
     * Must be used to assign functions to call dynamic ports
     * of the device.
     *
     * @deprecated use onRegister() instead of preProcess()
     */
    preProcess(): void;
    /**
     * Sync start hook (canonical name): the entry point to start device
     * operation. Runs in `Container.runProcess()` / `startDevice()` after
     * ports and connections are wired — start basic operation here (timers,
     * subscriptions, connections).
     *
     * During the deprecation window the Container calls **both** this method
     * and the deprecated `process()` — keep your logic in only one of them.
     */
    onStart(): void;
    /**
     * The method is an input point for the start of device operation
     *
     * The device will go through the following steps to create the device:
     *
     * - Creating a class
     * - Assigning device parameters
     * - Creating ports
     * - Assigning call functions
     * - Creating connections between devices
     *
     * Must be used to start basic operation of the device
     * e.g. initialization of connections, creation of timers, etc.
     *
     * @deprecated use onStart() instead of process()
     */
    process(): void;
    /**
     * Async start hook (canonical name): the asynchronous part of startup.
     * The Container awaits this method for every device (staged start, after
     * all sync `onStart()` calls). Use it for async initialization (file
     * databases, connections, etc.).
     *
     * During the deprecation window the Container calls **both** this method
     * and the deprecated `processPromise()` — keep your logic in only one of them.
     */
    onStartAsync(): Promise<void>;
    /**
     * Similar to `process` but asynchronous, the loader will wait for the execution of all the
     * `processPromise` methods of all devices.
     *
     * Used when there is a need to execute before starting the rack
     * and wait for asynchronous code to execute (initialization of some file databases, etc.)
     *
     * @deprecated use onStartAsync() instead of processPromise()
     */
    processPromise(): Promise<void>;
    /**
     * Sync stop hook (canonical name): the synchronous part of device
     * stopping. Called by the Container (`stopDevice()` / `stopAll()`) when
     * the device is running. The device is **not destroyed** — it can be
     * started again with `Container.startDevice()`.
     *
     * Use it to pause the device work: stop timers, pause consumers, etc.
     *
     * During the deprecation window the Container calls **both** this method
     * and the deprecated `stop()` — keep your logic in only one of them.
     */
    onStop(): void;
    /**
     * The synchronous part of device stopping.
     *
     * Called by the Container (`stopDevice()` / `stopAll()`) when the device
     * is running. The device is **not destroyed** — it can be started again
     * with `Container.startDevice()` (which re-runs `process()` + `processPromise()`).
     *
     * Use it to pause the device work: stop timers, pause consumers, etc.
     *
     * @deprecated use onStop() instead of stop()
     */
    stop(): void;
    /**
     * Async stop hook (canonical name): the asynchronous part of stopping —
     * the Container awaits it before the device is considered stopped.
     *
     * Use it for async cleanup that must complete before the device is
     * stopped: closing reusable connections, flushing pending work, etc.
     *
     * During the deprecation window the Container calls **both** this method
     * and the deprecated `stopPromise()` — keep your logic in only one of them.
     */
    onStopAsync(): Promise<void>;
    /**
     * Similar to `stop` but asynchronous — the Container awaits it
     * before the device is considered stopped.
     *
     * Use it for async cleanup that must complete before the device is
     * stopped: closing reusable connections, flushing pending work, etc.
     *
     * @deprecated use onStopAsync() instead of stopPromise()
     */
    stopPromise(): Promise<void>;
    /**
     * Destruction hook (canonical name): called by the Container
     * (`removeDevice()`) right before the device is removed from the
     * container. Not called by `stopDevice()` — a stopped device is reusable.
     *
     * The device is about to be destroyed — close everything, flush, save.
     * Note: it may not be called at all (depends on how the service exits).
     *
     * During the deprecation window the Container calls **both** this method
     * and the deprecated `beforeTerminate()` — keep your logic in only one of them.
     */
    onDestroy(): void;
    /**
     * Destruction hook: called by the Container (`removeDevice()`)
     * right before the device is removed from the container.
     * Not called by `stopDevice()` — a stopped device is reusable.
     *
     * The device is about to be destroyed — close everything, flush, save.
     * Note: it may not be called at all (depends on how the service exits)
     *
     * @deprecated use onDestroy() instead of beforeTerminate()
     */
    beforeTerminate(): void;
    /**
     * Sends the current `shares` to external consumers.
     *
     * Explicit only: mutating `shares` emits nothing — call `render()` after
     * the change. The `trace` of the emitted `device.render` event is the
     * *live* reference to `shares`: subscribers must treat it as read-only
     * (mutating it mutates the device state) and clone it themselves before
     * crossing a serialization boundary (postMessage / worker reply).
     *
     * @see shares
     */
    render(): boolean;
    /**
     * Save device storage
     *
     * @see storage
    */
    save(): boolean;
    /**
     * Write metric value
     *
     * @param path Registered metric path
     * @param value value record
     * @param modify Write modify 'last' | 'first' | 'max' | 'min' | 'avg' | 'sum'
    */
    metric(path: string, value: number, modify?: 'last' | 'first' | 'max' | 'min' | 'avg' | 'sum'): boolean;
    /**
     * @param data Message
     * @param trace Trace info (object needed)
    */
    terminal(data: string, trace: {
        [key: string]: any;
    }, ...args: any[]): boolean;
    /**
     * @param data Message
     * @param trace Trace info (object needed)
    */
    notify(data: string, trace: {
        [key: string]: any;
    }, ...args: any[]): boolean;
    /**
     * @param data Message
     * @param trace Trace info (object needed)
    */
    event(data: string, trace: {
        [key: string]: any;
    }, ...args: any[]): boolean;
    /**
     * @param data Message
     * @param trace Trace info (object needed)
    */
    alert(data: string, trace: {
        [key: string]: any;
    }, ...args: any[]): boolean;
    /**
     * @param data Message
     * @param trace Trace info (object needed)
    */
    error(data: string, trace: {
        [key: string]: any;
    }, ...args: any[]): boolean;
    /**
     * Make & emit device event
     *
     * @param type event type
     * @param data event data string
     * @param trace additional information
    */
    protected makeEvent(type: string, data: string, trace: {
        [key: string]: any;
    }, args: any[]): boolean;
    /**
     * Adding processing for the incoming port
     *
     * @param name Port name in 'port.name' format
     * @param action CallBack function to execute
    */
    addInputHandler(name: string, action: (data: any) => any): void;
    /**
     * Adding a handle for the action
     *
     * @param name Action name in the format 'action.name'
     * @param action CallBack function to execute
    */
    addActionHandler(name: string, action: (data: any) => any): void;
    /**
     * Informs the rack that the unit cannot continue to operate.
     * and a critical error has occurred
     *
     * Requires DeviceError to be created
    */
    terminate(error: Error, action: string): boolean;
    /**
     * Get the database boot class (default id — 'DB').
     *
     * The device is typed against the `BootDatabase` interface, not a concrete
     * adapter: for adapter-specific methods pull the concrete class instead
     * (`this.Container.Bootstrap.getBootClass('DB', BootDatabaseSqlite)`).
     *
     * The database must be declared in the service's `bootstrap` section —
     * otherwise this throws `BTSP_CLASS_ID_NOT_FOUND`.
     *
     * @param id boot class identifier from the bootstrap list (default 'DB')
     */
    getDB(id?: string): BootDatabase;
}
export {};
