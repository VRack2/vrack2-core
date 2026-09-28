"use strict";
/*
 * Copyright © 2024 Boris Bobylev. All rights reserved.
 * Licensed under the Apache License, Version 2.0
*/
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const Validator_1 = __importDefault(require("../validator/Validator"));
/**
 * Boot classes are designed to override behavior outside of the container.
 * They can also extend the container's capabilities.
 *
 * Boot classes are similar to devices inside the container,
 * but they do not fall into it and do not have connections.
 *
 * Boot classes are created inside a Bootstrap class.
 * To do this, you need to create a list of classes and specify them for bootstrapping,
 *
 * here is an example of such a list
 *
 * ```ts
 *      DeviceManager: { path: 'vrack2-core.DeviceManager', options: { storageDir: './storage' }},
 *      DeviceStorage: { path: 'vrack2-core.DeviceFileStorage', options: {} },
 *      StructureStorage: { path: 'vrack2-core.StructureStorage', options: {} },
 *      DeviceMetrics: { path: 'vrack2-core.DeviceMetrics', options: {} }
 * ```
 * Where:
 * ```
 *   [key: string - Unique bootclass identifier] : {
 *      path: string - Path to bootclass,
 *      options: {any} - Bootclass settings
 *   }
 * ```
 *
 * @see DeviceManager For boot class example
*/
class BootClass {
    /**
     * Method returns rules for validation of boot class options
     *
     * @example
     * ```ts
     *   return {
     *       keysPath: Rule.string().required().default('./keys.json')
     *   }
     * ```
    */
    checkOptions() {
        return {};
    }
    /**
     * @param id Unique ID
     * @param type Device type string
     * @param Container Active loader container
    */
    constructor(id, type, Container, options) {
        /**
         * Boot class parameters that will be passed from the settings of the list of boot classes
         *
         * @see checkOptions()
        */
        this.options = {};
        this.id = id;
        this.type = type;
        this.Container = Container;
        this.options = options;
        // Validating
        const rules = this.checkOptions();
        Validator_1.default.validate(rules, this.options);
    }
    /**
     * Boot-class start hook: the entry point to start the boot-class
     * operation, mirroring `Device.onStart()`.
     *
     * Runs in `Bootstrap.runBootClass()` after the class is constructed and
     * its options are filled.
     */
    onStart() { return; }
    /**
     * Async start hook: the asynchronous part of boot-class startup,
     * mirroring `Device.onStartAsync()`. The Bootstrap awaits this for every
     * boot-class (staged start). Use it for async initialization.
     */
    async onStartAsync() { return; }
    /**
     * Destruction hook: called by `Bootstrap.terminateAll()` right before the
     * boot-class is torn down, mirroring `Device.onDestroy()`.
     *
     * The boot-class is about to be destroyed — close everything, flush, save.
     * Release any resources (connections, file handles, etc.) acquired in
     * `onStartAsync()`. Implementations must be idempotent:
     * `Bootstrap.terminateAll()` may be called multiple times.
     */
    async onDestroy() { await Promise.resolve(); }
    /**
     * Method for calling container system errors
     */
    error(error) {
        this.Container.emit('system.error', error);
    }
}
exports.default = BootClass;
