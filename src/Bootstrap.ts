/*
 * Copyright © 2024 Boris Bobylev. All rights reserved.
 * Licensed under the Apache License, Version 2.0
*/

import { Rule } from '.';
import BootClass from './boot/BootClass';
import Container from './Container';
import ImportManager from './ImportManager';
import ErrorManager from './errors/ErrorManager';


/**
 * One boot-class entry in a boot list config.
 *
 * `path` may be omitted: in layered merge (see `mergeBootList`) an entry
 * without `path` is an **options override** — the id must already be present
 * in a lower layer, whose `path` is kept. An entry without `path` that does
 * not match any lower-layer id is a configuration error.
 */
export interface IBootstrapEntry {
    /** VRack-style bootclass path. Optional — options-only override */
    path?: string,
    /** Options for this bootclass */
    options: { [key: string]: any },
}

/**
 * Defines a list of bootstrap classes to load
 *
 * {
 *   'ClassID': { 
 *      path: 'importclass.path', 
 *      options: {} 
 *    }
 * }
 *
 * In layered merge a value of `null` removes the id from the merged list.
 */
export interface IBootListConfig {
    [key: string]: IBootstrapEntry | null
}

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
ErrorManager.registerMany('Bootstrap', [
    {
        short: 'BS_BAD_BOOTLIST',
        description: 'Bad bootstrap list configuration (malformed entry, or an entry without path does not match any lower layer)',
        rules: {
            id: Rule.string().description('Class identify'),
            entry: Rule.object().description('The bad entry'),
        }
    }
])

export function mergeBootList(layers: Array<IBootListConfig | null | undefined>): IBootListConfig {
    const result: IBootListConfig = {}
    for (const layer of layers) {
        if (layer == null) continue
        for (const [id, entry] of Object.entries(layer)) {
            if (entry === null) {
                delete result[id]
                continue
            }
            if (typeof entry !== 'object') {
                throw ErrorManager.make('BS_BAD_BOOTLIST', { id, entry })
            }
            if (entry.options == null || typeof entry.options !== 'object') {
                throw ErrorManager.make('BS_BAD_BOOTLIST', { id, entry })
            }
            const existing = result[id]
            if (entry.path != null) {
                // Full add or replace
                result[id] = { path: entry.path, options: { ...entry.options } }
            } else if (existing != null) {
                // Options-only override over a lower-layer entry
                result[id] = { ...existing, options: { ...existing.options, ...entry.options } }
            } else {
                throw ErrorManager.make('BS_BAD_BOOTLIST', { id, entry: { options: entry.options, reason: 'entry without path does not match any lower layer' } })
            }
        }
    }
    return result
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
        short: 'BTSP_TERMINATE_FAILED',
        description: 'Failed to stop a boot class',
        rules: { id: Rule.string().description('Class identify'), message: Rule.string().description('Underlying error message') }
    },
])

/**
 * Загрузка и запуск boot-классов (служебных модулей сервиса).
 *
 * `Bootstrap` идёт по списку, находит каждый класс, создаёт модуль и
 * передаёт ему контейнер. Boot-классы — служебные модули «над» контейнером
 * (хранилище, метрики, структура, база данных): они «слушают» события и
 * обслуживают сервис, но **не** знают об устройствах. `DeviceManager` —
 * обязательный boot-класс, без которого контейнер не работает.
 *
 * Публичный API и описание boot-классов —
 * [07-Bootstrap](docs/07-Bootstrap.md).
 *
 * @example
 * ```js
 * import Bootstrap from 'vrack2-core'
 *
 * const bs = new Bootstrap({ list: { DM: { path: 'vrack2-core.DeviceManager', options: {} } } })
 * bs.loadBootList()
 * ```
 */
export default class Bootstrap {

    /**
     * Container for which boot classes are loaded (set by `loadBootList()`).
     * Used to report `destroyAll()` failures as `system.error` events.
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
     * True once `loadBootList()` has been **called** — even if the attempt
     * failed. It is an idempotency guard against re-calls, not a "load
     * succeeded" indicator: a re-call would re-instantiate the boot classes
     * and re-subscribe their container event handlers (duplicate listeners).
     * A failed attempt does not reset the guard — the error propagates to
     * the host and the process/worker is being killed anyway.
     */
    protected loadAttempted = false

    /**
     * True once `destroyAll()` has been executed (idempotency guard).
     * Re-running it would re-invoke `onDestroy()` on boot classes that have
     * already released their resources.
     */
    protected destroyed = false

    constructor(config: IBootListConfig){
        this.config = config
    }

    /**
     * Load bootclasses
     * 
     * Bootclass has some analogy to devices within VRack services.
     * They also have options and lifecycle hooks (onStart, onStartAsync, onDestroy)
     * similar to devices
     * 
     * Idempotent: a second call is a no-op — boot classes are not re-instantiated
     * and their event handlers are not re-subscribed.
     * 
     * @param Container Container for which loading is performed 
    */
    async loadBootList(Container: Container) {
        if (this.loadAttempted) return
        this.loadAttempted = true
        this.Container = Container
        for (const cn in this.config) {
            const conf = this.config[cn]
            if (conf == null || typeof conf.path !== 'string') {
                throw ErrorManager.make('BS_BAD_BOOTLIST', { id: cn, entry: conf })
            }
            const ExClass = await ImportManager.importClass(conf.path)
            this.loaded[cn] = new ExClass(cn, ImportManager.importClassName(conf.path), Container, conf.options) 
        if (!(this.loaded[cn] instanceof BootClass)) {
            throw ErrorManager.make('BTSP_INSTANCE_OF_INCORRECT', { id: cn })
        }
        }
        for (const bc in this.loaded) {
            this.loaded[bc].onStart()
        }
        for (const bc in this.loaded) {
            await this.loaded[bc].onStartAsync()
        }
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
     * one by one — `destroyAll()` stops the entire set at once. There is
     * deliberately no public "terminate one boot class" entry point: closing
     * a single shared resource while the service is still running would leave
     * the rest of the service without it.
     *
     * Calls `onDestroy()` on every loaded boot class. All calls are awaited;
     * a single failure is reported as `system.error` and does not prevent the
     * remaining boot classes from terminating — the process is exiting anyway.
     *
     * One-way: once called, the flag is latched and further calls are no-ops
     * (mirrors the `loadAttempted` idempotency guard of `loadBootList()`).
     *
     * The termination order is the **reverse** of the load order (mirrors
     * `Container.stopAll()`): later-loaded (upper) classes are released
     * first, so shared resources owned by earlier classes (for example a
     * database) stay alive while the classes that depend on them finish.
     */
    async destroyAll() {
        if (this.destroyed) return
        this.destroyed = true
        for (const bc of Object.keys(this.loaded).reverse()) {
            try {
                await this.loaded[bc].onDestroy()
            } catch (e: any) {
                this.Container?.emit('system.error',
                    ErrorManager.make('BTSP_TERMINATE_FAILED', { id: bc, message: e?.message }))
            }
        }
    }
}
