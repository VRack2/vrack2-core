"use strict";
/*
 * Copyright © 2022 Boris Bobylev. All rights reserved.
 * Licensed under the Apache License, Version 2.0
*/
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EDeviceMessageTypes = void 0;
const BootDatabase_1 = __importDefault(require("../boot/BootDatabase"));
const CoreError_1 = __importDefault(require("../errors/CoreError"));
const ImportManager_1 = __importDefault(require("../ImportManager"));
var EDeviceMessageTypes;
(function (EDeviceMessageTypes) {
    EDeviceMessageTypes["terminal"] = "terminal";
    EDeviceMessageTypes["info"] = "info";
    EDeviceMessageTypes["error"] = "error";
    EDeviceMessageTypes["event"] = "event";
    EDeviceMessageTypes["action"] = "action";
    EDeviceMessageTypes["alert"] = "alert";
})(EDeviceMessageTypes || (exports.EDeviceMessageTypes = EDeviceMessageTypes = {}));
class Device {
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
    get running() {
        return this.Container.isRunning(this.id);
    }
    /**
     * @param id Unique ID
     * @param type Device type string
     * @param Container Active loader container
    */
    constructor(id, type, Container) {
        /**
         * Device options
         *
         * @see checkOptions()
        */
        this.options = {};
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
        this.shares = {};
        /**
         * This data will be loaded for the specific instance of the device.
         * The device itself determines this data and saves it at the right moment
         *
         * The structure is determined by the device
        */
        this.storage = {};
        this.id = id;
        this.type = type;
        this.Container = Container;
        this.ports = {
            input: {},
            output: {}
        };
    }
    /**
     * Device settings
     *
     * Needs to be finalized
    */
    settings() {
        return {
            channels: ['terminal', 'notify', 'event', 'action', 'alert', 'error', 'render', 'status']
        };
    }
    /**
     * Short device description. Can use markdown markup
     *
     * @return {string} Device description
     * */
    description() {
        return '';
    }
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
    actions() { return {}; }
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
    metrics() { return {}; }
    /**
     * Run before each device action
     *
     * @param action "device.action" like string
     * @param data  data for action
    */
    beforeAction(action, data) { return true; }
    /**
     * Prepare options
     *
     * this method call before validating options
    */
    prepareOptions() { return; }
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
    checkOptions() { return {}; }
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
    inputs() { return {}; }
    /**
     * Device output list
     *
     * @see inputs
    */
    outputs() { return {}; }
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
    */
    preProcess() { return; }
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
    */
    process() { return; }
    /**
     * Similar to `process` but asynchronous, the loader will wait for the execution of all the
     * `processPromise` methods of all devices.
     *
     * Used when there is a need to execute before starting the rack
     * and wait for asynchronous code to execute (initialization of some file databases, etc.)
    */
    async processPromise() { return; }
    /**
     * The synchronous part of device stopping.
     *
     * Called by the Container (`stopDevice()` / `stopAll()`) when the device
     * is running. The device is **not destroyed** — it can be started again
     * with `Container.startDevice()` (which re-runs `process()` + `processPromise()`).
     *
     * Use it to pause the device work: stop timers, pause consumers, etc.
     */
    stop() { return; }
    /**
     * Similar to `stop` but asynchronous — the Container awaits it
     * before the device is considered stopped.
     *
     * Use it for async cleanup that must complete before the device is
     * stopped: closing reusable connections, flushing pending work, etc.
     */
    async stopPromise() { return; }
    /**
     * Destruction hook: called by the Container (`removeDevice()`)
     * right before the device is removed from the container.
     * Not called by `stopDevice()` — a stopped device is reusable.
     *
     * The device is about to be destroyed — close everything, flush, save.
     * Note: it may not be called at all (depends on how the service exits)
     */
    beforeTerminate() { return; }
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
    render() {
        return this.makeEvent('device.render', 'shares', this.shares, []);
    }
    /**
     * Save device storage
     *
     * @see storage
    */
    save() { return this.makeEvent('device.save', 'storage', this.storage, []); }
    /**
     * Write metric value
     *
     * @param path Registered metric path
     * @param value value record
     * @param modify Write modify 'last' | 'first' | 'max' | 'min' | 'avg' | 'sum'
    */
    metric(path, value, modify = 'last') {
        return this.makeEvent('device.metric', path, { value, modify }, []);
    }
    /**
     * @param data Message
     * @param trace Trace info (object needed)
    */
    terminal(data, trace, ...args) { return this.makeEvent('device.terminal', data, trace, args); }
    /**
     * @param data Message
     * @param trace Trace info (object needed)
    */
    notify(data, trace, ...args) { return this.makeEvent('device.notify', data, trace, args); }
    /**
     * @param data Message
     * @param trace Trace info (object needed)
    */
    event(data, trace, ...args) { return this.makeEvent('device.event', data, trace, args); }
    /**
     * @param data Message
     * @param trace Trace info (object needed)
    */
    alert(data, trace, ...args) { return this.makeEvent('device.alert', data, trace, args); }
    /**
     * @param data Message
     * @param trace Trace info (object needed)
    */
    error(data, trace, ...args) {
        if (trace instanceof Error)
            trace = CoreError_1.default.objectify(trace);
        return this.makeEvent('device.error', data, trace, args);
    }
    /**
     * Make & emit device event
     *
     * @param type event type
     * @param data event data string
     * @param trace additional information
    */
    makeEvent(type, data, trace, args) {
        const nEvent = { device: this.id, data, trace };
        return this.Container.emit(type, nEvent);
    }
    /**
     * Adding processing for the incoming port
     *
     * @param name Port name in 'port.name' format
     * @param action CallBack function to execute
    */
    addInputHandler(name, action) {
        name = ImportManager_1.default.camelize('input.' + name);
        const a = this;
        a[name] = action;
    }
    /**
     * Adding a handle for the action
     *
     * @param name Action name in the format 'action.name'
     * @param action CallBack function to execute
    */
    addActionHandler(name, action) {
        name = ImportManager_1.default.camelize('action.' + name);
        const a = this;
        a[name] = action;
    }
    /**
     * Informs the rack that the unit cannot continue to operate.
     * and a critical error has occurred
     *
     * Requires DeviceError to be created
    */
    terminate(error, action) {
        return this.makeEvent('device.terminate', action, error, []);
    }
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
    getDB(id = 'DB') {
        return this.Container.Bootstrap.getBootClass(id, BootDatabase_1.default);
    }
}
exports.default = Device;
