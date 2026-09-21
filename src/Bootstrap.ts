/*
 * Copyright © 2024 Boris Bobylev. All rights reserved.
 * Licensed under the Apache License, Version 2.0
*/

import { ErrorManager, Rule } from '.';
import BootClass from './boot/BootClass';
import Container from './Container';
import ImportManager from './ImportManager';


/**
 * Defines a list of bootstrap classes to load
 *
 * {
 *   'ClassID': { 
 *      path: 'importclass.path', 
 *      options: {} 
 *    }
 * }
*/
export interface IBootListConfig {
    [key: string]: {
        /** VRack-style bootclass path */
        path: string,
        /** Options for this bootclass */
        options: { [key: string]: any },
    }
}

ErrorManager.registerMany('Bootstrap', [
    {
        short: 'BTSP_CLASS_ID_NOT_FOUND',
        description: 'Bootstrap class id not found',
        rules: { id: Rule.string().description('Class identify') }
    },
    {
        short: 'BTSP_INSTANCE_OF_INCORRECT',
        description: 'Bootstrap class id is not a class defined by check',
        rules: { id: Rule.string().description('Class identify') }
    },
    {
        short: 'BTSP_MUST_BE_BOOTCLASS',
        description: 'The class must be inherited from BootClass',
        rules: { path: Rule.string().description('Class path') }
    },
    {
        short: 'BTSP_TERMINATE_FAILED',
        description: 'Failed to stop a boot class',
        rules: { id: Rule.string().description('Class identify'), message: Rule.string().description('Underlying error message') }
    },
])

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
    protected Container: Container | undefined

    /**
     * Loaded class list
     * 
     * ```ts
     * { UniqueID: ClassInstance }
     * ```
    */
    protected loaded: { [key: string]: BootClass } = {}

    /**
     * List of downloadable classes and their settings
     * 
     * @see IBootListConfig
    */
    protected config: IBootListConfig

    /**
     * True once `loadBootList()` has been executed (idempotency guard).
     * Re-running it would re-instantiate the boot classes and re-subscribe
     * their container event handlers (duplicate listeners).
     */
    protected booted = false

    /**
     * True once `terminateAll()` has been executed (idempotency guard).
     * Re-running it would re-invoke `terminate()` on boot classes that have
     * already released their resources.
     */
    protected terminated = false

    constructor(config: IBootListConfig){
        this.config = config
    }

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
    async loadBootList(Container: Container) {
        if (this.booted) return
        this.booted = true
        this.Container = Container
        for (const cn in this.config) {
            const conf = this.config[cn]
            const ExClass = await ImportManager.importClass(conf.path)
            this.loaded[cn] = new ExClass(cn, ImportManager.importClassName(conf.path), Container, conf.options) 
            if (!(this.loaded[cn] instanceof  BootClass)) {
                throw ErrorManager.make('BTSP_INSTANCE_OF_INCORRECT', { path: conf.path }) 
            }
        }
        for (const bc in this.loaded) this.loaded[bc].process()
        for (const bc in this.loaded) await this.loaded[bc].processPromise()
    }

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
    getBootClass (id: string, cs: any ) {
        if (!this.loaded[id]) throw ErrorManager.make('BTSP_CLASS_ID_NOT_FOUND', { id })
        if (!(this.loaded[id] instanceof cs)) throw ErrorManager.make('BTSP_INSTANCE_OF_INCORRECT', { id })
        return this.loaded[id] as typeof cs
    }

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
    async terminateAll() {
        if (this.terminated) return
        this.terminated = true
        for (const bc in this.loaded) {
            try {
                await this.loaded[bc].terminate()
            } catch (e: any) {
                this.Container?.emit('system.error',
                    ErrorManager.make('BTSP_TERMINATE_FAILED', { id: bc, message: e?.message }))
            }
        }
    }
}
