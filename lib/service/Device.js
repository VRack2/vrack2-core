"use strict";
/*
 * Copyright © 2022 Boris Bobylev. All rights reserved.
 * Licensed under the Apache License, Version 2.0
*/
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EDeviceMessageTypes = void 0;
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
})(EDeviceMessageTypes = exports.EDeviceMessageTypes || (exports.EDeviceMessageTypes = {}));
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
         * This is a fast updating data object - it will be sent
         * to subscribers after the render() call
         *
         * @see render()
         * */
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
        this.works = true;
        this.ports = {
            input: {},
            output: {}
        };
    }
    /**
     * Device settings
     *
     * Needs to be finalized"
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
     *    'group.portname': Port.standart(),
     *    'group.portname': Port.standart()
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
     * - Assigning device prameters
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
     * - Assigning device prameters
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
    processPromise() {
        return __awaiter(this, void 0, void 0, function* () { return; });
    }
    /**
     * Myby todo?
     *
     * stop() { return }
     * async stopPromise() { return }
    */
    /**
     * Queues device shares data updates for external consumers
     *
     * @see shares
    */
    render() { return this.makeEvent('device.render', 'shares', this.shares, []); }
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
