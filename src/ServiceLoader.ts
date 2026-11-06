/*
 * Copyright © 2025 Boris Bobylev. All rights reserved.
 * Licensed under the Apache License, Version 2.0
 */

import Device from "./service/Device";
import DeviceManager from "./boot/DeviceManager";
import Bootstrap from "./Bootstrap";
import type Container from "./Container";
import IServiceStructure from "./IServiceStructure";
import IStructureDevice from "./IStructureDevice";
import ICheckResult from "./ICheckResult";
import ErrorManager from "./errors/ErrorManager";
import CoreError from "./errors/CoreError";
import Validator from "./validator/Validator";
import Rule from "./validator/Rule";
import Utility from "./Utility";
import ImportManager from "./ImportManager";
import { existsSync } from "fs";

/***** ********      LOADER ERROR      ********************/

ErrorManager.registerMany('ServiceLoader', [
    {
        short: 'SLDR_ERROR_INIT_DEVICE',
        description: 'Device initialization error',
        rules: { deviceConfig: Rule.object().description('Device configuration') }
    },
    {
        short: 'SLDR_ERROR_INIT_CONNECTION',
        description: 'Connection initialization error',
        rules: { connection: Rule.string().description('Connection string') }
    },
    {
        short: 'SLDR_CONF_EXTENDS_PROBLEM',
        description: 'Problem with extending service configuration.'
    },
    {
        short: 'SLDR_CONF_DEVICE_INVALID',
        description: 'A conf-file device entry is not a valid new device (missing or invalid "type")',
        rules: { device: Rule.string().description('Device ID') }
    },
    {
        short: 'SLDR_INCORRECT_DEVICE_ID',
        description: 'Incorrect device id'
    },
    {
        short: 'SLDR_ERROR_PREPARE_OPTIONS',
        description: 'An error occurred while preparing options',
        rules: { message: Rule.string().description('Exception error string') }
    },
    {
        short: 'SLDR_BAD_RESOURCE_MAP',
        description: 'Malformed "publish" / "resolve" map in a device configuration',
        rules: {
            device: Rule.string().description('Device ID'),
            field: Rule.string().description('Map field name')
        }
    },
    {
        short: 'SLDR_RESOURCE_DUPLICATE',
        description: 'Two devices publish the same resource registry name',
        rules: {
            device: Rule.string().description('Device ID'),
            alias: Rule.string().description('Registry name'),
            providedBy: Rule.string().description('Device that already provides this name')
        }
    },
    {
        short: 'SLDR_RESOURCE_MISSING',
        description: 'A required resource is not published by any other device',
        rules: {
            device: Rule.string().description('Device ID'),
            key: Rule.string().description('Resource key'),
            alias: Rule.string().description('Registry name')
        }
    },
    {
        short: 'SLDR_RESOURCE_MISMATCH',
        description: 'A required resource name is provided under a different resource key',
        rules: {
            device: Rule.string().description('Device ID'),
            key: Rule.string().description('Resource key'),
            alias: Rule.string().description('Registry name'),
            providedKey: Rule.string().description('Key the name is provided under')
        }
    },
])

/**
 * Сборка сервиса из JSON.
 *
 * Владеет конфигом сервиса: находит классы устройств (`vendor.Class`),
 * проверяет опции, создаёт устройства, соединяет порты, добавляет/удаляет
 * устройства в работающем сервисе и эмитит `service.loaded` — сигнал
 * «структура изменилась», который запускает сохранение структуры.
 *
 * **`Container`** при этом владеет регистрацией, состоянием соединений,
 * ступенчатым стартом и runtime-действиями (`registerDevice`,
 * `addConnection`, `startDevice`, ...). Лоадер создаётся вместе с Container
 * и структурой сервиса; `load()` материализует все устройства и соединения
 * и эмитит `service.loaded`.
 *
 * @example
 * ```js
 * import ServiceLoader, Container from 'vrack2-core'
 *
 * const c = new Container('main')
 * const loader = new ServiceLoader(c, serviceJson)
 * await loader.load()
 * ```
 */
export default class ServiceLoader {

    /** Container this loader builds devices for */
    Container: Container

    /** Bootstrap (DeviceManager, etc.) used to resolve device classes */
    Bootstrap: Bootstrap

    /** Service structure (devices + connections) this loader loads */
    service: IServiceStructure

    /** Optional conf file that overrides device options */
    confFile?: string

    /** True after `load()` has run once (idempotency guard) */
    inited: boolean

    /** Guard against concurrent adds of the same device id */
    pending: Set<string>

    constructor(container: Container, service: IServiceStructure, confFile?: string) {
        this.Container = container
        this.Bootstrap = container.Bootstrap
        this.service = service
        this.confFile = confFile
        this.inited = false
        this.pending = new Set()
    }

    /**
     * Load the full structure from `this.service` into the container.
     *
     * This re-homes the previous `Container.init()`:
     * 1. `service.configure` event, then `fillConfFile()` (override options of
     *    existing devices and add devices declared only in the conf file;
     *    failures wrapped in `SLDR_CONF_EXTENDS_PROBLEM`).
     * 2. `service.init.begin` / `service.init` events, then for each device:
     *    `device.register` event + `createDevice()` +
     *    `Container.registerDevice()` (failures wrapped in
     *    `SLDR_ERROR_INIT_DEVICE`).
     * 3. `service.init.end` / `service.connect.begin` / `service.connect`
     *    events, then wire every device connection (`service.connection`
     *    event) and `service.connections` entry (failures wrapped in
     *    `SLDR_ERROR_INIT_CONNECTION`).
     * 4. `service.connect.end` event.
     * 5. **`service.loaded`** — the finalization signal. Listeners such as
     *    `StructureStorage` react to it by persisting the structure once.
     *
     * Idempotent — a second call is a no-op.
     */
    async load(): Promise<void> {
        if (this.inited) return
        this.inited = true
        this.Container.emit('service.configure')
        try {
            this.fillConfFile()
        } catch (err) {
            if (err instanceof Error) {
                const ner = ErrorManager.make('SLDR_CONF_EXTENDS_PROBLEM', {}).setTrace(err as Error).add(err)
                throw ner
            }
            throw err
        }
        this.Container.emit('service.init.begin')
        this.Container.emit('service.init')
        this.validateResources()
        for (const device of this.service.devices) {
            try {
                this.Container.emit('device.register', device)
                const dev = await this.createDevice(device)
                this.Container.registerDevice(dev)
            } catch (error) {
                const ner = ErrorManager.make('SLDR_ERROR_INIT_DEVICE', { deviceConfig: device })
                ner.add(error as Error)
                throw ner
            }
        }
        this.Container.emit('service.init.end')
        this.Container.emit('service.connect.begin')
        this.Container.emit('service.connect')
        for (const device of this.service.devices) {
            if (!device.connections) continue
            for (const conn of device.connections) {
                this.Container.emit('service.connection', conn)
                this.initConnection(conn)
            }
        }
        if (Array.isArray(this.service.connections)) {
            for (const conn of this.service.connections) {
                this.initConnection(conn)
            }
        }
        this.Container.emit('service.connect.end')

        // Structure finalization — triggers persistence (StructureStorage, ...)
        this.Container.emit('service.loaded')
    }

    /**
     * Wire one connection during `load()`, wrapping any failure in
     * `SLDR_ERROR_INIT_CONNECTION` (preserves the original init behavior).
     */
    private initConnection(conn: string) {
        try {
            this.Container.addConnection(conn)
        } catch (error) {
            const ner = ErrorManager.make('SLDR_ERROR_INIT_CONNECTION', { connection: conn })
            if (error instanceof CoreError) ner.add(error)
            throw ner
        }
    }

    /**
     * Validate declared resource maps (`publish` / `resolve`) of all devices
     * in the service configuration, before any device is created.
     *
     * Rules:
     *  - each map is an object of string → string (`SLDR_BAD_RESOURCE_MAP`);
     *  - every published registry name is unique across the service
     *    (`SLDR_RESOURCE_DUPLICATE`);
     *  - every required name exists in another device's `publish` under the
     *    same resource key (`SLDR_RESOURCE_MISSING` / `SLDR_RESOURCE_MISMATCH`).
     */
    private validateResources() {
        const devices = this.service.devices ?? []
        const provided = new Map<string, { device: string, key: string }>()

        for (const d of devices) {
            for (const field of ['publish', 'resolve'] as const) {
                const map = d[field]
                if (map === undefined) continue
                if (typeof map !== 'object' || map === null || Array.isArray(map)) {
                    throw ErrorManager.make('SLDR_BAD_RESOURCE_MAP', { device: d.id, field })
                }
                for (const [key, alias] of Object.entries(map)) {
                    if (typeof alias !== 'string' || !alias) {
                        throw ErrorManager.make('SLDR_BAD_RESOURCE_MAP', { device: d.id, field })
                    }
                    if (field === 'publish') {
                        const owner = provided.get(alias)
                        if (owner) {
                            throw ErrorManager.make('SLDR_RESOURCE_DUPLICATE', { device: d.id, alias, providedBy: owner.device })
                        }
                        provided.set(alias, { device: d.id, key })
                    }
                }
            }
        }

        for (const d of devices) {
            if (!d.resolve) continue
            for (const [key, alias] of Object.entries(d.resolve)) {
                const owner = provided.get(alias)
                if (!owner || owner.device === d.id) {
                    throw ErrorManager.make('SLDR_RESOURCE_MISSING', { device: d.id, key, alias })
                }
                if (owner.key !== key) {
                    throw ErrorManager.make('SLDR_RESOURCE_MISMATCH', { device: d.id, key, alias, providedKey: owner.key })
                }
            }
        }
    }

    /**
      * Hot-add a device: create it, register it in the container, and emit
      * `device.register` + `device.add` + `service.loaded`.
     *
      * The device is registered (structure, ports, actions, metrics) but is
     * **not** started. Start it with `Container.startDevice(id)`.
     *
     * Not part of the public contract — internal mechanics of the dynamic
     * device management; behavior may change without notice.
     *
     * @param dconf Device configuration
     * @returns The registered (not yet started) device
     * @internal
     */
    async addDevice(dconf: IStructureDevice): Promise<Device> {
        if (dconf.id in this.Container.devices || this.pending.has(dconf.id)) {
            throw ErrorManager.make('CONT_DEVICE_DUPLICATE')
        }
        this.pending.add(dconf.id)
        try {
            this.Container.emit('device.register', dconf)
            const dev = await this.createDevice(dconf)
            this.Container.registerDevice(dev)
            this.Container.emit('device.add', dconf.id)
            this.Container.emit('service.loaded')
            return dev
        } finally {
            this.pending.delete(dconf.id)
        }
    }

    /**
     * Hot-remove a device from the container and emit `service.loaded`.
     *
     * If the device is running, it is stopped first
     * (`onStop()` + `await onStopAsync()`) and then destroyed
     * (`onDestroy()` + cleanup).
     *
     * Not part of the public contract — internal mechanics of the dynamic
     * device management; behavior may change without notice.
     *
     * @param id Device ID
     * @internal
     */
    async removeDevice(id: string): Promise<void> {
        await this.Container.removeDevice(id)
        this.pending.delete(id)
        this.Container.emit('service.loaded')
    }

    /**
     * Hot-add a connection and emit `service.loaded`.
     *
     * Not part of the public contract — internal mechanics of the dynamic
     * device management; behavior may change without notice.
     *
     * @param conn Device connection string like "DevID.port -> DevIDTO.port"
     * @internal
     */
    addConnection(conn: string): void {
        this.Container.addConnection(conn)
        this.Container.emit('service.loaded')
    }

    /**
     * Extend the service configuration from the conf file.
     *
     * Re-homed from `Container.fillConfFile()`. Per conf-file device entry:
     *  - **Override** — the `id` already exists in the service file: the entry's
     *    `options` are shallow-merged over the existing device and, when the
     *    entry carries `connections`, they replace the device's own connections.
     *  - **Addition** — the `id` is absent from the service file: the entry is
     *    appended to `this.service.devices` as a **full device**, so it is
     *    created, validated and wired exactly like devices declared in the
     *    service file. Such an entry must declare a valid string `type`
     *    (otherwise `SLDR_CONF_DEVICE_INVALID`); `options` default to `{}` and
     *    `connections` / `publish` / `resolve` are carried over when present.
     *
     * Entries without a usable string `id` are ignored. Conf-file additions run
     * before the load loop, so added devices (and the connections that reference
     * them) are seen by every later step of `load()` (resource validation,
     * device creation, connection wiring, `service.loaded` persistence).
     */
    protected fillConfFile() {
        if (!this.confFile || !existsSync(this.confFile)) return
        const conf = ImportManager.importJSON(this.confFile)
        if (conf.devices === undefined || !Array.isArray(conf.devices)) conf.devices = []
        for (const device of conf.devices) {
            if (!device || typeof device !== 'object' || !device.id || typeof device.id !== 'string') continue
            const existing = this.service.devices.find((cdev) => cdev.id === device.id)
            if (existing) {
                // Override: merge options over an existing device, replace its connections
                if (device.options !== undefined && typeof device.options === 'object') {
                    for (const pname in device.options) existing.options[pname] = device.options[pname]
                }
                if (device.connections) existing.connections = device.connections
            } else {
                // Addition: a full device declared only in the conf file
                if (!device.type || typeof device.type !== 'string') {
                    throw ErrorManager.make('SLDR_CONF_DEVICE_INVALID', { device: device.id })
                }
                const added: IStructureDevice = {
                    id: device.id,
                    type: device.type,
                    options: (device.options !== undefined && typeof device.options === 'object') ? device.options : {},
                }
                if (Array.isArray(device.connections)) added.connections = device.connections
                if (device.publish) added.publish = device.publish
                if (device.resolve) added.resolve = device.resolve
                this.service.devices.push(added)
            }
        }
    }

    /**
     * Create and validate a device instance from its configuration.
     *
     * Steps:
     * 1. Resolve the device class via DeviceManager
     * 2. Validate the device id
     * 3. Guard against a duplicate id
     * 4. Instantiate the device
     * 5. Fill & `prepareOptions()`
     * 6. Validate options against `checkOptions()`
     *
     * The returned device is **not** registered in the container.
     *
     * @param dconf Device configuration
     * @returns A validated, unregistered Device instance
     */
    async createDevice(dconf: IStructureDevice): Promise<Device> {
        const DM = this.Bootstrap.getBootClass('DeviceManager', DeviceManager) as DeviceManager
        const cs = await DM.get(dconf.type)

        if (dconf.id === undefined || !dconf.id || typeof dconf.id !== 'string' || !Utility.isDeviceName(dconf.id)) {
            throw ErrorManager.make('SLDR_INCORRECT_DEVICE_ID')
        }
        // Device id is duplicated
        if (dconf.id in this.Container.devices) throw ErrorManager.make('CONT_DEVICE_DUPLICATE')

        // Create device instance (not yet registered)
        const dev = new cs(dconf.id, dconf.type, this.Container) as Device

        // Declared resource maps (validated at load; copied onto the device)
        if (dconf.publish) dev.resourcePublish = { ...dconf.publish }
        if (dconf.resolve) dev.resourceResolve = { ...dconf.resolve }

        // Fill options
        for (const key in dconf.options) dev.options[key] = dconf.options[key]

        // try prepare options
        try {
            dev.prepareOptions()
        } catch (error) {
            let message = ''
            if (error instanceof Error) message = error.toString()
            const ner = ErrorManager.make('SLDR_ERROR_PREPARE_OPTIONS', { message })
            if (error instanceof CoreError) ner.add(error)
            throw ner
        }

        // Validating
        const rules = dev.checkOptions()
        Validator.validate(rules, dev.options)

        return dev
    }

    /**
     * Dry-run validation of a device configuration.
     *
     * Builds a throwaway instance to exercise `prepareOptions()` and option
     * validation, then discards it. It has **no side effects** on the container
     * (nothing is registered).
     *
     * > Device constructors and `prepareOptions()` should be side-effect free.
     *
     * @param dconf Device configuration
     * @returns `ICheckResult` describing validity (and problems, if any)
     */
    async checkDevice(dconf: IStructureDevice): Promise<ICheckResult> {
        try {
            await this.createDevice(dconf)
            return { valid: true }
        } catch (error) {
            return this.toResult(error)
        }
    }

    /**
     * Dry-run validation of a connection (delegates to Container).
     *
     * @param conn Device connection string like "DevID.port -> DevIDTO.port"
     * @returns `ICheckResult` describing validity
     */
    checkConnection(conn: string): ICheckResult {
        return this.Container.checkConnection(conn)
    }

    /**
     * Convert a thrown error into an `ICheckResult`
     */
    protected toResult(error: any): ICheckResult {
        if (error instanceof CoreError) {
            const res: ICheckResult = { valid: false, error: { code: error.vShort, message: error.message } }
            const problems = (error as any).problems
            if (Array.isArray(problems) && problems.length) res.problems = problems
            return res
        }
        return {
            valid: false,
            error: { code: 'UNKNOWN', message: error instanceof Error ? error.message : String(error) }
        }
    }
}