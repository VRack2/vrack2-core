/*
 * Copyright © 2022 Boris Bobylev. All rights reserved.
 * Licensed under the Apache License, Version 2.0
*/

import BasicType from "../validator/types/BasicType";
import Container from '../Container';
import BasicAction from "../actions/BasicAction";
import BasicPort from "../ports/BasicPort";
import DevicePort from "./DevicePort";
import IDeviceEvent from "./IDeviceEvent";
import CoreError from "../errors/CoreError";
import BasicMetric from "../metrics/BasicMetric";
import ImportManager from "../ImportManager";
import ReactiveRef from "../ReactiveRef";

export enum EDeviceMessageTypes {
    terminal = "terminal",
    info = "info",
    error = "error",
    event = "event",
    action = "action",
    alert = "alert",
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
     * Device running state (managed by the Container — do not set it directly).
     *
     * `true` from construction (as the old `works` was) — so a not-started
     * device and a device that is starting up (inside `process()` /
     * `processPromise()`) accept port data: startup traffic (for example
     * command registration) flows. `Container.startDevice()` / `runProcess()`
     * restore it before `process()` runs (restart after a stop).
     *
     * `false` after `Container.stopDevice()` / `stopAll()` (`stop()` +
     * `stopPromise()`) and after `removeDevice()` — a stopped device
     * accepts no port data (pushes are dropped silently) and its actions
     * are rejected with the CTR_DEVICE_STOPPED error.
     *
     * Actions on a device that is not started are rejected with the
     * CTR_DEVICE_STOPPED error (the Container checks its `started` set).
     */
    running: boolean

    /**
     * Allows access to port management. 
    */
    ports: {
        input: { [key: string]: DevicePort }
        output: { [key: string]: DevicePort }
    }

    /** 
     * Active loader container
     * */
    Container: Container;

    /**
     * Device options
     * 
     * @see checkOptions()
    */
    options: { [key: string]: any } = {};

    /**
     * @param id Unique ID
     * @param type Device type string 
     * @param Container Active loader container
    */
    constructor(id: string, type: string, Container: Container) {
        this.id = id
        this.type = type
        this.Container = Container
        this.running = true
        this.ports = {
            input: {},
            output: {}
        }
    }

    /**
     * Device settings
     *  
     * Needs to be finalized
    */
    settings(): IDeviceSettings {
        return {
            channels: ['terminal', 'notify', 'event', 'action', 'alert', 'error', 'render', 'status']
        }
    }

    /** 
     * Short device description. Can use markdown markup
     * 
     * @return {string} Device description
     * */
    description(): string {
        return ''
    }

    /**
     * Reactive storage backing `shares` (a deep-reactive plain object).
     * Internal: the reactive accessors installed on Device.prototype read/write it.
     */
    _sharesRef = new ReactiveRef<Record<string, any>>({})

    /**
     * This is a fast updating data object - it will be sent
     * to subscribers after the render() call.
     * After preProcess() the Container attaches auto-render: any change of shares
     * (a property write, a new property, delete, or a full reassignment) triggers render().
     *
     * A subclass declares its shape as a plain class field - inside the class
     * `this.shares` keeps the declared typing (not Record<string, any>):
     * ```ts
     * class MyDevice extends Device {
     *     shares = { data: 1, name: 'x' }          // initial state + its type
     *     work() { const n: number = this.shares.data }   // fully typed in the IDE
     * }
     * ```
     * The field's value becomes the default shares: right after preProcess() the
     * Container imports it into the reactive ref (refinements made in preProcess() are
     * preserved) and drops the shadow, so reactivity takes over. Without a field the
     * default is an empty `{}`; writes in constructor/preProcess() work as well.
     *
     * @see render()
     */
    declare shares: Record<string, any>

    /**
     * True while the Container-attached auto-render watcher is active
     */
    private _sharesRenderAttached = false

    /**
     * True while `render()` is emitting (re-entrancy guard)
     */
    private _rendering = false

    /**
     * This data will be loaded for the specific instance of the device. 
     * The device itself determines this data and saves it at the right moment
     * 
     * The structure is determined by the device
    */
    storage: any = {}

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
    actions(): { [key: string]: BasicAction } { return {} }

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
    metrics(): { [key: string]: BasicMetric } { return {} }


    /**
     * Run before each device action
     * 
     * @param action "device.action" like string
     * @param data  data for action
    */
    beforeAction(action: string, data: any) { return true }

    /**
     * Prepare options 
     * 
     * this method call before validating options
    */
    prepareOptions() { return }

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
    checkOptions(): { [key: string]: BasicType } { return {} }

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
    inputs(): { [key: string]: BasicPort } { return {} }

    /**
     * Device output list
     * 
     * @see inputs
    */
    outputs(): { [key: string]: BasicPort } { return {} }

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
    preProcess() { return }

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
    process() { return }

    /**
     * Similar to `process` but asynchronous, the loader will wait for the execution of all the 
     * `processPromise` methods of all devices.
     * 
     * Used when there is a need to execute before starting the rack
     * and wait for asynchronous code to execute (initialization of some file databases, etc.)
    */
    async processPromise() { return }

    /**
     * The synchronous part of device stopping.
     *
     * Called by the Container (`stopDevice()` / `stopAll()`) when the device
     * is running. The device is **not destroyed** — it can be started again
     * with `Container.startDevice()` (which re-runs `process()` + `processPromise()`).
     *
     * Use it to pause the device work: stop timers, pause consumers, etc.
     */
    stop() { return }

    /**
     * Similar to `stop` but asynchronous — the Container awaits it
     * before the device is considered stopped.
     *
     * Use it for async cleanup that must complete before the device is
     * stopped: closing reusable connections, flushing pending work, etc.
     */
    async stopPromise() { return }

    /**
     * Destruction hook: called by the Container (`removeDevice()`)
     * right before the device is removed from the container.
     * Not called by `stopDevice()` — a stopped device is reusable.
     *
     * The device is about to be destroyed — close everything, flush, save.
     * Note: it may not be called at all (depends on how the service exits)
     */
    beforeTerminate(){ return }

    /**
     * Queues device shares data updates for external consumers
     * The `trace` of the emitted `device.render` event is a deep plain snapshot
     * of `shares` (no reactive proxies), so it stays read-only for subscribers
     * and can safely cross a worker boundary (structured clone / postMessage).

     * 
     * @see shares
    */
    render(): boolean {
        if (this._rendering) return false
        this._rendering = true
        try {
            return this.makeEvent('device.render', 'shares', this._sharesRef.snapshot(), [])
        } finally {
            this._rendering = false
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
        if (this._sharesRenderAttached) return
        this._sharesRenderAttached = true

        // A subclass may declare `shares = {...}` as a class field. Under ES2022
        // class-field semantics (native Node, esbuild target es2022+, tsc
        // useDefineForClassFields) that creates an own data property which SHADOWS
        // the `shares` accessor, so the declared value would stay inert. Import the
        // field's current value (including any refinement done in preProcess())
        // into the reactive ref and drop the shadow; on legacy transpilers the
        // field was already routed through the setter, so this is a no-op.
        const fieldDesc = Object.getOwnPropertyDescriptor(this, 'shares')
        if (fieldDesc && 'value' in fieldDesc) {
            const fieldValue = fieldDesc.value as Record<string, any>
            Reflect.deleteProperty(this, 'shares')
            if (fieldValue != null) this._sharesRef.set(fieldValue)
        }

        this._sharesRef.watch(() => this.render())
    }

    /**
     * Detach the auto-render watcher (called by the Container in `removeDevice()`).
     * Explicit `render()` calls keep working after detaching.
     *
     * @see shares
    */
    detachSharesRender() {
        if (!this._sharesRenderAttached) return
        this._sharesRenderAttached = false
        this._sharesRef.unwatch()
    }

    /**
     * Save device storage
     * 
     * @see storage
    */
    save() { return this.makeEvent('device.save', 'storage', this.storage, []) }

    /**
     * Write metric value
     * 
     * @param path Registered metric path
     * @param value value record
     * @param modify Write modify 'last' | 'first' | 'max' | 'min' | 'avg' | 'sum'
    */
    metric(path: string, value: number, modify: 'last' | 'first' | 'max' | 'min' | 'avg' | 'sum' = 'last') {
        return this.makeEvent('device.metric', path, { value, modify }, [])
    }

    /**
     * @param data Message
     * @param trace Trace info (object needed)
    */
    terminal(data: string, trace: { [key: string]: any }, ...args: any[]) { return this.makeEvent('device.terminal', data, trace, args) }

    /**
     * @param data Message
     * @param trace Trace info (object needed)
    */
    notify(data: string, trace: { [key: string]: any }, ...args: any[]) { return this.makeEvent('device.notify', data, trace, args) }

    /**
     * @param data Message
     * @param trace Trace info (object needed)
    */
    event(data: string, trace: { [key: string]: any }, ...args: any[]) { return this.makeEvent('device.event', data, trace, args) }

    /**
     * @param data Message
     * @param trace Trace info (object needed)
    */
    alert(data: string, trace: { [key: string]: any }, ...args: any[]) { return this.makeEvent('device.alert', data, trace, args) }

    /**
     * @param data Message
     * @param trace Trace info (object needed)
    */
    error(data: string, trace: { [key: string]: any }, ...args: any[]) {
        if (trace instanceof Error) trace = CoreError.objectify(trace)
        return this.makeEvent('device.error', data, trace, args)
    }

    /**
     * Make & emit device event
     * 
     * @param type event type
     * @param data event data string
     * @param trace additional information
    */
    protected makeEvent(type: string, data: string, trace: { [key: string]: any }, args: any[]) {
        const nEvent: IDeviceEvent = { device: this.id, data, trace }
        return this.Container.emit(type, nEvent)
    }

    /**
     * Adding processing for the incoming port
     * 
     * @param name Port name in 'port.name' format
     * @param action CallBack function to execute
    */
    addInputHandler(name: string, action: (data: any) => any) {
        name = ImportManager.camelize('input.' + name)
        const a = this as any
        a[name] = action
    }

    /**
     * Adding a handle for the action
     * 
     * @param name Action name in the format 'action.name'
     * @param action CallBack function to execute
    */
    addActionHandler(name: string, action: (data: any) => any) {
        name = ImportManager.camelize('action.' + name)
        const a = this as any
        a[name] = action
    }

    /**
     * Informs the rack that the unit cannot continue to operate.
     * and a critical error has occurred
     * 
     * Requires DeviceError to be created
    */
    terminate(error: Error, action: string) {
        return this.makeEvent('device.terminate', action, error, [])
    }
    
}



// Reactive accessors live on the prototype (not in the class body) so that a subclass
// may shadow `shares` with its own typed class field without TS2610 — for the type model
// it is a plain property, exactly like such a field. The Container normalizes a subclass
// field at attachSharesRender() time: imports its value into _sharesRef and drops the shadow.
Object.defineProperty(Device.prototype, 'shares', {
    enumerable: false,
    configurable: true,
    get(this: Device) { return this._sharesRef.value },
    set(this: Device, value: Record<string, any>) { this._sharesRef.set(value) }
})
