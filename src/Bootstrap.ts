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

ErrorManager.register('Bootstrap', 'yNHeX5fwDH5P', 'BTSP_CLASS_ID_NOT_FOUND',
    'Bootstrap class id not found', {
    id: Rule.string().description('Class identify')
})

ErrorManager.register('Bootstrap', 'ack6kwHSBtcf', 'BTSP_INSTANCE_OF_INCORRECT',
    'Bootstrap class id is not a class defined by check', {
    id: Rule.string().description('Class identify')
})

ErrorManager.register('Bootstrap', 'DMloqbZG9J36', 'BTSP_MUST_BE_BOOTCLASS',
    'The class must be inherited from BootClass', {
    path: Rule.string().description('Class path')
})

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
     * Loaded class list
     * 
     * ```ts
     * { UniqueID: Classinstance }
     * ```
    */
    protected loaded: { [key: string]: BootClass } = {}

    /**
     * List of downloadable classes and their settings
     * 
     * @see IBootListConfig
    */
    protected config: IBootListConfig

    constructor(config: IBootListConfig){
        this.config = config
    }

    /**
     * Load bootclasses
     * 
     * Bootclass has some analogy to devices within VRack services.
     * They also have options, process, processPromise methods similar to devices
     * 
     * @param Container Container for which loading is performed 
    */
    async loadBootList(Container: Container) {
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
}
