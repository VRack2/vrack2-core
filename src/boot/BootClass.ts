/*
 * Copyright © 2024 Boris Bobylev. All rights reserved.
 * Licensed under the Apache License, Version 2.0
*/

import Container from '../Container';
import BasicType from '../validator/types/BasicType';
import Validator from '../validator/Validator';

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
export default class BootClass {

    /** 
     * A unique identifier that will be filled in when the class is created within Bootstrap. 
     * Can be used to refer to the class directly
     * 
     * @example 'DeviceName'
     * */
    id: string;

    /**
     * The path to a VRack2-style class that will be populated when the class is created inside Bootstrap. 
     * Can be used to determine class membership
     * 
     * @example 'vrack.KeyManager'
    */
    type: string;

    /** 
     * Container for which Boot classes are loaded
     * */
    Container: Container;

    /**
     * Boot class parameters that will be passed from the settings of the list of boot classes
     * 
     * @see checkOptions()
    */
    options: { [key: string]: any } = {};

    /**
     * Method returns rules for validation of boot class options
     * 
     * @example 
     * ```ts
     *   return {
     *       keysPath: Rule.string().require().default('./keys.json')
     *   }
     * ```
    */
    checkOptions(): { [key: string]: BasicType; } {
        return {}
    }

    /**
     * @param id Unique ID
     * @param type Device type string 
     * @param Container Active loader container
    */
    constructor(id: string, type: string, Container: Container, options: { [key: string]: any } ) {
        this.id = id
        this.type = type
        this.Container = Container
        this.options = options
        
        // Validating
        const rules = this.checkOptions()
        Validator.validate(rules, this.options)
    }   


    /**
     * The method is the entry point to start the boot class
    */
    process() { return }

    /**
     * Similar to `process` but asynchronous, 
     * the bootstrap loader will wait for the execution of all 
     * the  `processPromise` methods of all bootstrap classes.
    */
    async processPromise() { return }

    /**
     * Method for calling container system errors
     */
    error(error: Error){
        this.Container.emit('system.error', error)
    }
}
