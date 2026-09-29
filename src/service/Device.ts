/*
 * Copyright © 2022 Boris Bobylev. All rights reserved.
 * Licensed under the Apache License, Version 2.0
*/

import BasicType from "../validator/types/BasicType";
import BootDatabase from "../boot/BootDatabase";
import Container from '../Container';
import BasicAction from "../actions/BasicAction";
import BasicPort from "../ports/BasicPort";
import DevicePort from "./DevicePort";
import IDeviceEvent from "./IDeviceEvent";
import CoreError from "../errors/CoreError";
import BasicMetric from "../metrics/BasicMetric";
import ImportManager from "../ImportManager";

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
     * CONT_DEVICE_STOPPED error (the Container checks its `started` set).
     */
    get running(): boolean {
        return this.Container.isRunning(this.id)
    }

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
     * Without a field the default is an empty `{}`; writes in the
     * constructor / `onRegister()` work as well.
     *
     * @see render()
     */
    shares: Record<string, any> = {}

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
     * Hook: run before every device action — after argument validation, before
     * the action handler. Override to veto the action: return `false` and the
     * action is rejected with `CONT_DEVICE_ACTION_VETOED`.
     *
     * The Container emits `device.action.before` right before calling this
     * (event data: action name, trace: action arguments).
     *
     * @param action Device action name (without the `action.` prefix)
     * @param data Action arguments (already validated)
     * @returns `true` to allow the action, `false` to veto it
     */
    onBeforeAction(action: string, data: any) { return true }

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
     * Registration hook: the entry point to start device initialization.
     * Runs in `Container.registerDevice()`, before ports and connections are
     * created — use it to assign functions for dynamic ports.
     *
     * Emits the `device.register` event.
     */
    onRegister() { return }

    /**
     * Sync start hook: the entry point to start device operation. Runs in
     * `Container.runStart()` / `startDevice()` after ports and connections
     * are wired — start basic operation here (timers, subscriptions,
     * connections).
     *
     * Emits the `device.start` event.
     */
    onStart() { return }

    /**
     * Async start hook: the asynchronous part of startup. The Container awaits
     * this method for every device (staged start, after all sync `onStart()`
     * calls). Use it for async initialization (file databases, connections,
     * etc.).
     *
     * Emits the `device.startAsync` event.
     */
    async onStartAsync() { return }

    /**
     * Sync stop hook: the synchronous part of device stopping. Called by the
     * Container (`stopDevice()` / `stopAll()`) when the device is running.
     * The device is **not destroyed** — it can be started again with
     * `Container.startDevice()`.
     *
     * Use it to pause the device work: stop timers, pause consumers, etc.
     *
     * Emits the `device.stop` event.
     */
    onStop() { return }

    /**
     * Async stop hook: the asynchronous part of stopping — the Container
     * awaits it before the device is considered stopped. Use it for async
     * cleanup that must complete before the device is stopped: closing
     * reusable connections, flushing pending work, etc.
     */
    async onStopAsync() { return }

    /**
     * Destruction hook: called by the Container (`removeDevice()`) right
     * before the device is removed from the container. Not called by
     * `stopDevice()` — a stopped device is reusable.
     *
     * The device is about to be destroyed — close everything, flush, save.
     * Note: it may not be called at all (depends on how the service exits).
     */
    onDestroy() { return }

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
    render(): boolean {
        return this.makeEvent('device.render', 'shares', this.shares, [])
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
    getDB(id = 'DB'): BootDatabase {
        return this.Container.Bootstrap.getBootClass(id, BootDatabase) as BootDatabase
    }

}
