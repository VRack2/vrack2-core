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
const CoreError_1 = __importDefault(require("../errors/CoreError"));
const ImportManager_1 = __importDefault(require("../ImportManager"));
const ReactiveRef_1 = __importDefault(require("../ReactiveRef"));
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
         * Reactive storage backing the `shares` accessor
         */
        this._sharesRef = new ReactiveRef_1.default({});
        /**
         * True while the Container-attached auto-render watcher is active
         */
        this._sharesRenderAttached = false;
        /**
         * True while `render()` is emitting (re-entrancy guard)
         */
        this._rendering = false;
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
        this.works = true;
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
            channels: ['terminal', 'notify', 'event', 'action', 'alert', 'error', 'render']
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
     * This is a fast updating data object - it will be sent
     * to subscribers after the render() call.
     * After preProcess() the Container attaches auto-render: any change of shares
     * (a property write, a new property, delete, or a full reassignment) triggers render().
     * A subclass may declare `shares = {...}` as a class field - the value becomes the
     * initial (default) shares: right after preProcess() the Container imports it into
     * the reactive ref (refinements made in preProcess() are preserved) and normalizes
     * it under ES2022 class-field semantics, where the field would otherwise shadow
     * this accessor.
     *
     * @see render()
     * */
    get shares() {
        return this._sharesRef.value;
    }
    set shares(value) {
        this._sharesRef.set(value);
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
     *          id: Rule.string().require().default('www').description('Some id')
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
     * Должен вызываться перед завершением сервиса
     * Но может не вызываться (зависит от реализации)
    */
    beforeTerminate() { return; }
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
     * - Linking device Shares
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
     * Maybe todo?
     *
     * stop() { return }
     * async stopPromise() { return }
    */
    /**
     * Queues device shares data updates for external consumers
     * The `trace` of the emitted `device.render` event is a deep plain snapshot
     * of `shares` (no reactive proxies), so it stays read-only for subscribers
     * and can safely cross a worker boundary (structured clone / postMessage).

     *
     * @see shares
    */
    render() {
        if (this._rendering)
            return false;
        this._rendering = true;
        try {
            return this.makeEvent('device.render', 'shares', this._sharesRef.snapshot(), []);
        }
        finally {
            this._rendering = false;
        }
    }
    /**
     * Attach the auto-render watcher: from this moment on any change of `shares`
     * (property write, new property, `delete`, or a full reassignment)
     * automatically triggers `render()`.
     *
     * Called by the Container right after `preProcess()`, so the initialization
     * writes inside `preProcess()` do not render.
     *
     * @see shares
    */
    attachSharesRender() {
        if (this._sharesRenderAttached)
            return;
        this._sharesRenderAttached = true;
        // A subclass may declare `shares = {...}` as a class field. Under ES2022
        // class-field semantics (native Node, esbuild target es2022+, tsc
        // useDefineForClassFields) that creates an own data property which SHADOWS
        // the `shares` accessor, so the declared value would stay inert. Import the
        // field's current value (including any refinement done in preProcess())
        // into the reactive ref and drop the shadow; on legacy transpilers the
        // field was already routed through the setter, so this is a no-op.
        const fieldDesc = Object.getOwnPropertyDescriptor(this, 'shares');
        if (fieldDesc && 'value' in fieldDesc) {
            const fieldValue = fieldDesc.value;
            Reflect.deleteProperty(this, 'shares');
            if (fieldValue != null)
                this._sharesRef.set(fieldValue);
        }
        this._sharesRef.watch(() => this.render());
    }
    /**
     * Detach the auto-render watcher (called by the Container in `removeDevice()`).
     * Explicit `render()` calls keep working after detaching.
     *
     * @see shares
    */
    detachSharesRender() {
        if (!this._sharesRenderAttached)
            return;
        this._sharesRenderAttached = false;
        this._sharesRef.unwatch();
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
}
exports.default = Device;
