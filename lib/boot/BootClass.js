"use strict";
/*
 * Copyright © 2024 Boris Bobylev. All rights reserved.
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
     *       keysPath: Rule.string().require().default('./keys.json')
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
     * The method is the entry point to start the boot class
    */
    process() { return; }
    /**
     * Similar to `process` but asynchronous,
     * the bootstrap loader will wait for the execution of all
     * the  `processPromise` methods of all bootstrap classes.
    */
    processPromise() {
        return __awaiter(this, void 0, void 0, function* () { return; });
    }
    /**
     * Method for calling container system errors
     */
    error(error) {
        this.Container.emit('system.error', error);
    }
}
exports.default = BootClass;
