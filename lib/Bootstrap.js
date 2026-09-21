"use strict";
/*
 * Copyright © 2024 Boris Bobylev. All rights reserved.
 * Licensed under the Apache License, Version 2.0
*/
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.mergeBootList = mergeBootList;
const _1 = require(".");
const BootClass_1 = __importDefault(require("./boot/BootClass"));
const ImportManager_1 = __importDefault(require("./ImportManager"));
const ErrorManager_1 = __importDefault(require("./errors/ErrorManager"));
/**
 * Merge boot list config layers, low priority → high priority.
 *
 * Per id the higher layer wins:
 * - entry with `path` — adds or fully replaces the entry;
 * - entry without `path` — shallow-merges `options` over the lower-layer entry
 *   (higher-layer option values win); the id must exist in a lower layer,
 *   otherwise a `BS_BAD_BOOTLIST` error is thrown;
 * - `null` — removes the id from the result (even if a lower layer had it);
 * - first insertion order of the id is preserved.
 *
 * The returned object is a fresh deep-ish copy; input layers are not mutated.
 * Nullish (`null`/`undefined`) layers are skipped.
 * Used by `MainProcess` to combine core defaults, service file, conf file and
 * constructor bootstrap into one list.
 */
ErrorManager_1.default.registerMany('Bootstrap', [
    {
        short: 'BS_BAD_BOOTLIST',
        description: 'Bad bootstrap list configuration (malformed entry, or an entry without path does not match any lower layer)',
        rules: {
            id: _1.Rule.string().description('Class identify'),
            entry: _1.Rule.object().description('The bad entry'),
        }
    }
]);
function mergeBootList(layers) {
    const result = {};
    for (const layer of layers) {
        if (layer == null)
            continue;
        for (const [id, entry] of Object.entries(layer)) {
            if (entry === null) {
                delete result[id];
                continue;
            }
            if (typeof entry !== 'object') {
                throw ErrorManager_1.default.make('BS_BAD_BOOTLIST', { id, entry });
            }
            if (entry.options == null || typeof entry.options !== 'object') {
                throw ErrorManager_1.default.make('BS_BAD_BOOTLIST', { id, entry });
            }
            const existing = result[id];
            if (entry.path != null) {
                // Full add or replace
                result[id] = { path: entry.path, options: { ...entry.options } };
            }
            else if (existing != null) {
                // Options-only override over a lower-layer entry
                result[id] = { ...existing, options: { ...existing.options, ...entry.options } };
            }
            else {
                throw ErrorManager_1.default.make('BS_BAD_BOOTLIST', { id, entry: { options: entry.options, reason: 'entry without path does not match any lower layer' } });
            }
        }
    }
    return result;
}
ErrorManager_1.default.registerMany('Bootstrap', [
    {
        short: 'BTSP_CLASS_ID_NOT_FOUND',
        description: 'Bootstrap class id not found',
        rules: { id: _1.Rule.string().description('Class identify') }
    },
    {
        short: 'BTSP_INSTANCE_OF_INCORRECT',
        description: 'Bootstrap class id is not a class defined by check',
        rules: { id: _1.Rule.string().description('Class identify') }
    },
    {
        short: 'BTSP_MUST_BE_BOOTCLASS',
        description: 'The class must be inherited from BootClass',
        rules: { path: _1.Rule.string().description('Class path') }
    },
    {
        short: 'BTSP_TERMINATE_FAILED',
        description: 'Failed to stop a boot class',
        rules: { id: _1.Rule.string().description('Class identify'), message: _1.Rule.string().description('Underlying error message') }
    },
]);
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
         * { UniqueID: ClassInstance }
         * ```
        */
        this.loaded = {};
        /**
         * True once `loadBootList()` has been executed (idempotency guard).
         * Re-running it would re-instantiate the boot classes and re-subscribe
         * their container event handlers (duplicate listeners).
         */
        this.booted = false;
        /**
         * True once `terminateAll()` has been executed (idempotency guard).
         * Re-running it would re-invoke `terminate()` on boot classes that have
         * already released their resources.
         */
        this.terminated = false;
        this.config = config;
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
    async loadBootList(Container) {
        if (this.booted)
            return;
        this.booted = true;
        this.Container = Container;
        for (const cn in this.config) {
            const conf = this.config[cn];
            if (conf == null || typeof conf.path !== 'string') {
                throw ErrorManager_1.default.make('BS_BAD_BOOTLIST', { id: cn, entry: conf });
            }
            const ExClass = await ImportManager_1.default.importClass(conf.path);
            this.loaded[cn] = new ExClass(cn, ImportManager_1.default.importClassName(conf.path), Container, conf.options);
            if (!(this.loaded[cn] instanceof BootClass_1.default)) {
                throw ErrorManager_1.default.make('BTSP_INSTANCE_OF_INCORRECT', { path: conf.path });
            }
        }
        for (const bc in this.loaded)
            this.loaded[bc].process();
        for (const bc in this.loaded)
            await this.loaded[bc].processPromise();
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
            throw ErrorManager_1.default.make('BTSP_CLASS_ID_NOT_FOUND', { id });
        if (!(this.loaded[id] instanceof cs))
            throw ErrorManager_1.default.make('BTSP_INSTANCE_OF_INCORRECT', { id });
        return this.loaded[id];
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
        if (this.terminated)
            return;
        this.terminated = true;
        for (const bc in this.loaded) {
            try {
                await this.loaded[bc].terminate();
            }
            catch (e) {
                this.Container?.emit('system.error', ErrorManager_1.default.make('BTSP_TERMINATE_FAILED', { id: bc, message: e?.message }));
            }
        }
    }
}
exports.default = Bootstrap;
