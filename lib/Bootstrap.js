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
const _1 = require(".");
const BootClass_1 = __importDefault(require("./boot/BootClass"));
const ImportManager_1 = __importDefault(require("./ImportManager"));
_1.ErrorManager.register('Bootstrap', 'yNHeX5fwDH5P', 'BTSP_CLASS_ID_NOT_FOUND', 'Bootstrap class id not found', {
    id: _1.Rule.string().description('Class identify')
});
_1.ErrorManager.register('Bootstrap', 'ack6kwHSBtcf', 'BTSP_INSTANCE_OF_INCORRECT', 'Bootstrap class id is not a class defined by check', {
    id: _1.Rule.string().description('Class identify')
});
_1.ErrorManager.register('Bootstrap', 'DMloqbZG9J36', 'BTSP_MUST_BE_BOOTCLASS', 'The class must be inherited from BootClass', {
    path: _1.Rule.string().description('Class path')
});
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
class Bootstrap {
    constructor(config) {
        /**
         * Loaded class list
         *
         * ```ts
         * { UniqueID: Classinstance }
         * ```
        */
        this.loaded = {};
        this.config = config;
    }
    /**
     * Load bootclasses
     *
     * Bootclass has some analogy to devices within VRack services.
     * They also have options, process, processPromise methods similar to devices
     *
     * @param Container Container for which loading is performed
    */
    loadBootList(Container) {
        return __awaiter(this, void 0, void 0, function* () {
            for (const cn in this.config) {
                const conf = this.config[cn];
                const ExClass = yield ImportManager_1.default.importClass(conf.path);
                this.loaded[cn] = new ExClass(cn, ImportManager_1.default.importClassName(conf.path), Container, conf.options);
                if (!(this.loaded[cn] instanceof BootClass_1.default)) {
                    throw _1.ErrorManager.make('BTSP_INSTANCE_OF_INCORRECT', { path: conf.path });
                }
            }
            for (const bc in this.loaded)
                this.loaded[bc].process();
            for (const bc in this.loaded)
                yield this.loaded[bc].processPromise();
        });
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
    getBootClass(id, cs) {
        if (!this.loaded[id])
            throw _1.ErrorManager.make('BTSP_CLASS_ID_NOT_FOUND', { id });
        if (!(this.loaded[id] instanceof cs))
            throw _1.ErrorManager.make('BTSP_INSTANCE_OF_INCORRECT', { id });
        return this.loaded[id];
    }
}
exports.default = Bootstrap;
